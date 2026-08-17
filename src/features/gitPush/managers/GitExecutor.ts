// Git 子进程执行器：双池信号量限流（网络/本地命令独立并发池）+ abort 生命周期管理
import type { ChildProcess } from "node:child_process"
import { getNodeProcessModules } from "@/utils/nodeModules"
import type { GitPushStorage } from "../types/storage"
import { clampGitConcurrency } from "../types/storage"

export class GitExecutor {
  private storage: GitPushStorage
  /** 当前正在执行的 git 子进程数 */
  private gitRunning = 0
  /** 外部只读：当前活跃 git 操作数 */
  get activeGitOps(): number { return this.gitRunning }
  /** 最大并发 git 子进程数（从存储加载，可通过 setGitConcurrency 修改） */
  private gitMaxConcurrent = 3
  /** 等待队列（关联 signal + reject 以便 abort/destroy 时精准拒绝） */
  private gitWaitQueue: { run: () => void, reject: (e: Error) => void, signal?: AbortSignal }[] = []
  /** 识别网络 IO 类 git 命令，自动路由到独立并发池 */
  private static readonly NETWORK_COMMANDS = new Set(["fetch", "push", "pull", "clone", "ls-remote"])
  /** 网络命令最大并发（常量，避免被 GitHub/Gitee 限流） */
  private readonly networkMaxConcurrent = 2
  /** 当前正在执行的网络类 git 子进程数 */
  private networkRunning = 0
  /** 网络命令等待队列 */
  private networkWaitQueue: { run: () => void, reject: (e: Error) => void, signal?: AbortSignal }[] = []
  /** 记录当前正在执行的子进程引用（用于取消操作时 kill） */
  private activeProcesses: Set<ChildProcess> = new Set()
  /** 项目 push/pull 的 AbortController 数组（同项目多操作不覆盖） */
  private abortControllers: Map<string, AbortController[]> = new Map()
  /** execFile maxBuffer 10MB（防止全量 diff / 大仓库 status 超 Node 默认 1MB 报错） */
  private static readonly MAX_BUFFER = 10 * 1024 * 1024

  constructor(storage: GitPushStorage) {
    this.storage = storage
  }

  /** 从存储加载并发上限（init 时调用） */
  async loadGitConcurrency(): Promise<void> {
    this.gitMaxConcurrent = await this.storage.gitConcurrency.loadOrDefault()
  }

  /** 获取当前 git 并发上限 */
  getGitConcurrency(): number {
    return this.gitMaxConcurrent
  }

  /** 设置 git 并发上限并持久化 */
  async setGitConcurrency(n: number): Promise<void> {
    const clamped = clampGitConcurrency(n)
    this.gitMaxConcurrent = clamped
    await this.storage.gitConcurrency.save(clamped)
  }

  /** 获取 child_process 模块（简写） */
  private getProcess() {
    return getNodeProcessModules()?.child_process
  }

  /** 注册 AbortController 并在操作完成后自动清理（remoteOpAll/remoteOpSingle 共用） */
  async withAbortController<T>(
    id: string,
    action: "push" | "pull",
    fn: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const key = `${id}:${action}`
    const ac = new AbortController()
    const list = this.abortControllers.get(key) || []
    list.push(ac)
    this.abortControllers.set(key, list)
    try {
      return await fn(ac.signal)
    } finally {
      const existing = this.abortControllers.get(key)
      if (existing) {
        const filtered = existing.filter((a) => a !== ac)
        if (filtered.length > 0) {
          this.abortControllers.set(key, filtered)
        } else {
          this.abortControllers.delete(key)
        }
      }
    }
  }

  /**
   * 取消正在进行的推送/拉取操作
   * @param id 项目 ID
   * @param action 操作类型，不传则取消该项目所有操作（用于插件卸载清理）
   */
  cancelOp(id: string, action?: "push" | "pull"): void {
    if (action) {
      const key = `${id}:${action}`
      const list = this.abortControllers.get(key)
      if (list && list.length > 0) {
        for (const ac of list) { ac.abort() }
        this.abortControllers.delete(key)
      }
    } else {
      // 未指定 action 时取消该项目的所有操作
      for (const a of ["push", "pull"] as const) {
        this.cancelOp(id, a)
      }
    }
  }

  /**
   * 从 args 中提取实际命令名（跳过前导 -c <value> / -C <value> 全局参数对，
   * 以及 --no-pager / --no-optional-locks 等无参数前导选项）
   */
  private static getCommandName(args: string[]): string {
    let i = 0
    while (i < args.length && (args[i] === "-c" || args[i] === "-C")) {
      i += 2
    }
    // 跳过无参数的前导选项（以 -- 开头且不包含 =），避免网络命令被误判为本地命令
    while (i < args.length && /^--[^=]+$/.test(args[i])) {
      i++
    }
    return args[i] || ""
  }

  /**
   * 调度队列中下一个可运行项（跳过并 reject 已中止项，防止池饥饿/死锁）
   */
  private scheduleNext(isNetwork: boolean): void {
    const queue = isNetwork ? this.networkWaitQueue : this.gitWaitQueue
    while (queue.length > 0) {
      const item = queue.shift()!
      if (item.signal?.aborted) {
        item.reject(new Error("操作已取消"))
        continue
      }
      item.run()
      return
    }
  }

  /**
   * 执行 git 命令（双池信号量限流：网络命令与本地命令独立并发池）
   * @param signal 可选 AbortSignal，触发后 kill 子进程并清等待队列
   * @param timeoutMs 子进程超时（默认 30 秒；clone 等长耗时操作可传更大值）
   * @param onOutput 可选流式输出回调，实时回传 stdout/stderr 原始块（clone --progress 等长任务日志展示）
   * @param options 可选额外参数（如 rebase 编辑器所需环境变量）
   */
  async execGit(cwd: string, args: string[], signal?: AbortSignal, timeoutMs = 30000, onOutput?: (chunk: string) => void, options?: { env?: Record<string, string> }): Promise<string> {
    const isNetwork = GitExecutor.NETWORK_COMMANDS.has(GitExecutor.getCommandName(args))

    return new Promise<string>((resolve, reject) => {
      let killed = false

      const run = () => {
        if (signal?.aborted) {
          reject(new Error("操作已取消"))
          this.scheduleNext(isNetwork)
          return
        }

        const cp = this.getProcess()
        if (!cp) {
          reject(new Error("Node 环境不可用"))
          this.scheduleNext(isNetwork)
          return
        }
        if (isNetwork) {
          this.networkRunning++
        } else {
          this.gitRunning++
        }

        const child = cp.execFile(
          "git", args,
          {
            cwd,
            timeout: timeoutMs,
            encoding: "utf8",
            windowsHide: true,
            maxBuffer: GitExecutor.MAX_BUFFER,
            ...(options?.env ? { env: { ...process.env, ...options.env } } : {}),
          },
          (error: Error & { code?: number } | null, stdout: string, stderr: string) => {
            if (isNetwork) {
              this.networkRunning--
            } else {
              this.gitRunning--
            }
            this.activeProcesses.delete(child)
            this.scheduleNext(isNetwork)

            // 正常完成时移除 abort 监听器，防止泄漏
            if (signal) {
              signal.removeEventListener("abort", onAbort)
            }

            if (killed) { reject(new Error("操作已取消")); return }
            if (error) {
              reject(new Error(stderr || error.message))
            } else {
              resolve(stdout.replace(/[\r\n]+$/, ""))
            }
          },
        )
        this.activeProcesses.add(child)

        // 流式输出：execFile 的完成回调仍收全量缓冲，此处额外逐块回传（git progress 走 stderr）
        if (onOutput) {
          child.stdout?.on("data", (d: Buffer | string) => onOutput(String(d)))
          child.stderr?.on("data", (d: Buffer | string) => onOutput(String(d)))
        }

        const onAbort = () => {
          killed = true
          try { child.kill("SIGTERM") } catch {}
          // 过滤并 reject 与当前 signal 关联的排队项，防止僵尸 Promise
          const removeFromQueue = (queue: typeof this.gitWaitQueue): typeof this.gitWaitQueue => {
            const remaining: typeof this.gitWaitQueue = []
            for (const item of queue) {
              if (item.signal === signal) {
                item.reject(new Error("操作已取消"))
              } else {
                remaining.push(item)
              }
            }
            return remaining
          }
          this.gitWaitQueue = removeFromQueue(this.gitWaitQueue)
          this.networkWaitQueue = removeFromQueue(this.networkWaitQueue)
        }
        if (signal) {
          signal.addEventListener("abort", onAbort, { once: true })
        }
      }

      if (isNetwork) {
        if (this.networkRunning < this.networkMaxConcurrent) {
          run()
        } else {
          this.networkWaitQueue.push({ run, reject, signal })
        }
      } else {
        if (this.gitRunning < this.gitMaxConcurrent) {
          run()
        } else {
          this.gitWaitQueue.push({ run, reject, signal })
        }
      }
    })
  }

  destroy() {
    // 取消所有进行中的操作
    for (const list of this.abortControllers.values()) {
      for (const ac of list) { ac.abort() }
    }
    this.abortControllers.clear()
    // kill 所有活跃子进程（无 signal 的 execGit 不会被 abortController 覆盖）
    for (const child of this.activeProcesses) {
      try { child.kill("SIGTERM") } catch {}
    }
    this.activeProcesses.clear()
    // 拒绝排队中的 Promise 后清空队列，防止插件卸载后僵尸 Promise 泄漏
    for (const item of this.gitWaitQueue) { item.reject(new Error("操作已取消")) }
    for (const item of this.networkWaitQueue) { item.reject(new Error("操作已取消")) }
    this.gitWaitQueue.length = 0
    this.networkWaitQueue.length = 0
  }
}
