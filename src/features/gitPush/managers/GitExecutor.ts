// Git 子进程执行器：双池信号量限流（网络/本地命令独立并发池）+ abort 生命周期管理
import type { ChildProcess } from "node:child_process"
import { getNodeProcessModules } from "@/utils/nodeModules"
import type { GitPushStorage } from "../types/storage"
import { clampGitConcurrency, clampNetworkTimeout, DEFAULT_NETWORK_TIMEOUT } from "../types/storage"

/** 等待队列条目（本地池/网络池共用结构） */
interface WaitQueueItem {
  run: () => void
  reject: (e: Error) => void
  signal?: AbortSignal
}

export class GitExecutor {
  private storage: GitPushStorage
  /** 当前正在执行的 git 子进程数 */
  private gitRunning = 0
  /** 最大并发 git 子进程数（从存储加载，可通过 setGitConcurrency 修改） */
  private gitMaxConcurrent = 3
  /** 网络命令超时（ms，从存储加载，可通过 setNetworkTimeout 修改；默认 240s） */
  private networkTimeoutMs = DEFAULT_NETWORK_TIMEOUT * 1000
  /** 等待队列（关联 signal + reject 以便 abort/destroy 时精准拒绝） */
  private gitWaitQueue: WaitQueueItem[] = []
  /** 识别网络 IO 类 git 命令，自动路由到独立并发池 */
  private static readonly NETWORK_COMMANDS = new Set(["fetch", "push", "pull", "clone", "ls-remote"])
  /** 网络命令当前并发（动态跟随 gitMaxConcurrent；双池分离使本地命令洪流不挤占 push/fetch 通道） */
  private networkRunning = 0
  /** 网络命令等待队列 */
  private networkWaitQueue: WaitQueueItem[] = []
  /** 记录当前正在执行的子进程引用（用于取消操作时 kill） */
  private activeProcesses: Set<ChildProcess> = new Set()
  /** 项目 push/pull 的 AbortController 数组（同项目多操作不覆盖） */
  private abortControllers: Map<string, AbortController[]> = new Map()
  /** execFile maxBuffer 10MB（防止全量 diff / 大仓库 status 超 Node 默认 1MB 报错） */
  private static readonly MAX_BUFFER = 10 * 1024 * 1024
  /** 本地命令默认超时 */
  private static readonly DEFAULT_TIMEOUT_MS = 30000

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

  /** 从存储加载网络命令超时（秒 → ms，init 时调用） */
  async loadNetworkTimeout(): Promise<void> {
    this.networkTimeoutMs = (await this.storage.networkTimeout.loadOrDefault()) * 1000
  }

  /** 获取当前网络命令超时（秒，供设置面板显示） */
  getNetworkTimeout(): number {
    return Math.round(this.networkTimeoutMs / 1000)
  }

  /** 设置网络命令超时（秒）并持久化 */
  async setNetworkTimeout(n: number): Promise<void> {
    const clamped = clampNetworkTimeout(n)
    this.networkTimeoutMs = clamped * 1000
    await this.storage.networkTimeout.save(clamped)
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
   * @param timeoutMs 显式超时（不传时自动路由：网络命令默认按设置项（240s），本地命令默认 30s；clone 等长耗时操作可传更大值）
   * @param onOutput 可选流式输出回调，实时回传 stdout/stderr 原始块（clone --progress 等长任务日志展示）
   * @param options 可选额外参数（如 rebase 编辑器所需环境变量、视为成功的退出码白名单）
   */
  async execGit(
    cwd: string,
    args: string[],
    signal?: AbortSignal,
    timeoutMs?: number,
    onOutput?: (chunk: string) => void,
    options?: {
      env?: Record<string, string>
      /** 视为成功的退出码白名单（如 git diff --no-index 有差异时退出码为 1）；仅匹配数字型 code，spawn/超时/缓冲区错误不受影响 */
      allowExitCodes?: number[]
    },
  ): Promise<string> {
    const isNetwork = GitExecutor.NETWORK_COMMANDS.has(GitExecutor.getCommandName(args))
    const effectiveTimeout = timeoutMs ?? (isNetwork ? this.networkTimeoutMs : GitExecutor.DEFAULT_TIMEOUT_MS)

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
            timeout: effectiveTimeout,
            encoding: "utf8",
            windowsHide: true,
            maxBuffer: GitExecutor.MAX_BUFFER,
            ...(options?.env ? { env: { ...process.env, ...options.env } } : {}),
          },
          (error: (Error & { code?: number | string, killed?: boolean }) | null, stdout: string, stderr: string) => {
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
            // 白名单退出码视为正常结束：git diff --no-index 发现差异时退出码为 1（等同 --exit-code 语义），属预期而非失败。
            // 只认数字型 code，ENOENT / maxBuffer 等字符串码错误仍走下方 reject 分支。
            const exitCode = error?.code
            const allowedExit = typeof exitCode === "number" && (options?.allowExitCodes?.includes(exitCode) ?? false)
            if (error && !allowedExit) {
              // 错误信息自带超时/退出码标识：execFile 超时以 SIGTERM 终止（killed=true）时 stderr 可能为空，
              // 否则用户只能看到通用 "Command failed" 文案，无从得知是超时
              // "timed out" 字样同时供用户识别超时（超时不参与 RemoteOps 网络错误重试）
              const reason = error.killed
                ? `git 命令超时（timed out, ${effectiveTimeout}ms，已终止子进程）`
                : `git 命令执行失败（exit code: ${error.code ?? "未知"}）`
              // index.lock 残留（超时硬终止 commit/add 等可导致）附加解法指引，避免后续写操作全部失败却无从下手
              const lockHint = /index\.lock|another git process/i.test(`${stderr}\n${error.message}`)
                ? "\n检测到 index.lock 冲突：若确认无其他 git 进程运行（IDE/终端），可删除仓库下 .git/index.lock 后重试"
                : ""
              // 超时附加解法指引：指向设置面板可调的网络超时项（大仓库弱网络超时的直接对应解法）
              const timeoutHint = error.killed
                ? "\n推送/拉取大仓库时网络较慢易超时，可在 gitPush 设置中调大「网络超时」后重试"
                : ""
              reject(new Error((stderr ? `${reason}\n${stderr}` : `${reason}: ${error.message}`) + lockHint + timeoutHint))
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
          const removeFromQueue = (queue: WaitQueueItem[]): WaitQueueItem[] => {
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
        if (this.networkRunning < this.gitMaxConcurrent) {
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

  /**
   * 执行 git 命令（stdin 流式长驻进程）：全量 input 写入 stdin，进程退出后返回 stdout 原始字节。
   * 供 fast-import / cat-file --batch 等需要 stdin 批量输入的 plumbing 命令使用（历史重写用）；
   * 与 execGit 共用本地并发池与 activeProcesses 生命周期（destroy 时统一 kill）。
   * 全程持续消费 stdout/stderr，防止管道缓冲写满导致进程在写侧阻塞死锁。
   * @returns stdout 全量原始字节（tree 内容为二进制，由调用方自行解析，不做 UTF-8 解码）
   */
  async execGitStreaming(
    cwd: string,
    args: string[],
    input: string | Buffer,
    options?: { timeoutMs?: number, env?: Record<string, string> },
  ): Promise<Buffer> {
    const timeoutMs = options?.timeoutMs ?? 600000
    return new Promise<Buffer>((resolve, reject) => {
      let killed = false
      let settled = false
      let stderrTail = ""

      const run = () => {
        const cp = this.getProcess()
        if (!cp) {
          reject(new Error("Node 环境不可用"))
          this.scheduleNext(false)
          return
        }
        this.gitRunning++

        const child = cp.spawn(
          "git", args,
          {
            cwd,
            windowsHide: true,
            ...(options?.env ? { env: { ...process.env, ...options.env } } : {}),
          },
        )
        this.activeProcesses.add(child)

        const timer = setTimeout(() => {
          killed = true
          try { child.kill("SIGTERM") } catch { /* 忽略 */ }
        }, timeoutMs)

        const stdoutChunks: Buffer[] = []
        child.stdout?.on("data", (d: Buffer) => { stdoutChunks.push(d) })
        child.stderr?.on("data", (d: Buffer | string) => {
          stderrTail = (stderrTail + String(d)).slice(-2000)
        })

        // 进程提前退出时 stdin 写入触发 EPIPE，此处吞掉由 close 统一按退出码报错
        child.stdin?.on("error", () => { /* 由 close 统一处理 */ })

        child.on("error", (err: Error) => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          this.activeProcesses.delete(child)
          this.gitRunning--
          this.scheduleNext(false)
          reject(new Error(killed ? "操作已取消" : `git 命令执行失败: ${err.message}`))
        })

        child.on("close", (code: number | null) => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          this.activeProcesses.delete(child)
          this.gitRunning--
          this.scheduleNext(false)
          const stdout = Buffer.concat(stdoutChunks)
          if (killed) {
            reject(new Error(`git 命令超时（timed out, ${timeoutMs}ms，已终止子进程）${stderrTail ? `\n${stderrTail}` : ""}`))
          } else if (code !== 0) {
            reject(new Error(`git 命令执行失败（exit code: ${code ?? "未知"}）${stderrTail ? `\n${stderrTail}` : ""}`))
          } else {
            resolve(stdout)
          }
        })

        // 全量写入后立即关闭写端（Node 内部处理背压排队，不阻塞事件循环）
        child.stdin?.end(input)
      }

      if (this.gitRunning < this.gitMaxConcurrent) {
        run()
      } else {
        this.gitWaitQueue.push({ run, reject: (e: Error) => { if (!settled) { settled = true; reject(e) } } })
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
