// Git 子进程执行器：双池信号量限流（网络/本地命令独立并发池）+ abort 生命周期管理
import { getNodeProcessModules } from "@/utils/nodeModules"
import type { GitPushStorage } from "../types/storage"

export class GitExecutor {
  private storage: GitPushStorage
  /** 当前正在执行的 git 子进程数 */
  private gitRunning = 0
  /** 外部只读：当前活跃 git 操作数 */
  get activeGitOps(): number { return this.gitRunning }
  /** 最大并发 git 子进程数（从存储加载，可通过 setGitConcurrency 修改） */
  private gitMaxConcurrent = 3
  /** 等待队列（关联 signal 以便 abort 时精准过滤） */
  private gitWaitQueue: { run: () => void, signal?: AbortSignal }[] = []
  /** 识别网络 IO 类 git 命令，自动路由到独立并发池 */
  private static readonly NETWORK_COMMANDS = new Set(["fetch", "push", "pull", "clone", "ls-remote"])
  /** 网络命令最大并发（常量，避免被 GitHub/Gitee 限流） */
  private readonly networkMaxConcurrent = 2
  /** 当前正在执行的网络类 git 子进程数 */
  private networkRunning = 0
  /** 网络命令等待队列 */
  private networkWaitQueue: { run: () => void, signal?: AbortSignal }[] = []
  /** 记录当前正在执行的子进程引用（用于取消操作时 kill） */
  private activeProcesses: Set<any> = new Set()
  /** 项目 push/pull 的 AbortController 数组（同项目多操作不覆盖） */
  private abortControllers: Map<string, AbortController[]> = new Map()

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
    const clamped = Math.max(1, Math.min(10, n))
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
   * 执行 git 命令（双池信号量限流：网络命令与本地命令独立并发池）
   * @param signal 可选 AbortSignal，触发后 kill 子进程并清等待队列
   */
  async execGit(cwd: string, args: string[], signal?: AbortSignal): Promise<string> {
    const isNetwork = GitExecutor.NETWORK_COMMANDS.has(args[0])

    return new Promise<string>((resolve, reject) => {
      let killed = false

      const run = () => {
        if (signal?.aborted) {
          reject(new Error("操作已取消"))
          return
        }

        const cp = this.getProcess()
        if (!cp) { reject(new Error("Node 环境不可用")); return }
        if (isNetwork) {
          this.networkRunning++
        } else {
          this.gitRunning++
        }

        const child = cp.execFile(
          "git", args,
          { cwd, timeout: 30000, encoding: "utf8", windowsHide: true },
          (error: any, stdout: string, stderr: string) => {
            if (isNetwork) {
              this.networkRunning--
            } else {
              this.gitRunning--
            }
            this.activeProcesses.delete(child)
            const next = isNetwork ? this.networkWaitQueue.shift() : this.gitWaitQueue.shift()
            if (next) { next.run() }

            if (killed) { reject(new Error("操作已取消")); return }
            if (error) {
              reject(new Error(stderr || error.message))
            } else {
              resolve(stdout.replace(/[\r\n]+$/, ""))
            }
          },
        )
        this.activeProcesses.add(child)

        const onAbort = () => {
          killed = true
          try { child.kill("SIGTERM") } catch {}
          // 清空两个池中与当前 signal 关联的排队项，避免残留
          this.gitWaitQueue = this.gitWaitQueue.filter((item) => item.signal !== signal)
          this.networkWaitQueue = this.networkWaitQueue.filter((item) => item.signal !== signal)
        }
        if (signal) {
          if (signal.aborted) {
            onAbort()
            reject(new Error("操作已取消"))
            return
          }
          signal.addEventListener("abort", onAbort, { once: true })
        }
      }

      if (isNetwork) {
        if (this.networkRunning < this.networkMaxConcurrent) {
          run()
        } else {
          this.networkWaitQueue.push({ run, signal })
        }
      } else {
        if (this.gitRunning < this.gitMaxConcurrent) {
          run()
        } else {
          this.gitWaitQueue.push({ run, signal })
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
    // 清空等待队列中所有闭包，防止插件卸载后僵尸 Promise 持有闭包引用导致内存泄漏
    this.gitWaitQueue.length = 0
    this.networkWaitQueue.length = 0
  }
}
