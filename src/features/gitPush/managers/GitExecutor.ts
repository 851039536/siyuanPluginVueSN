// Git 子进程执行器：双池信号量限流（网络/本地命令独立并发池）+ abort 生命周期管理
import type { ChildProcess } from "node:child_process"
import { getNodeProcessModules } from "@/utils/nodeModules"
import type { GitPushStorage } from "../types/storage"
import { clampGitConcurrency, clampLocalTimeout, clampNetworkTimeout, DEFAULT_GIT_CONCURRENCY, DEFAULT_LOCAL_TIMEOUT, DEFAULT_NETWORK_TIMEOUT } from "../types/storage"
import { isNetworkGitCommand } from "../utils/pushProfile"

/** 等待队列条目（本地池/网络池共用结构） */
interface WaitQueueItem {
  run: () => void
  reject: (e: Error) => void
  signal?: AbortSignal
}

/** 单个子命令的调用统计（只读诊断，不做任何耗时开销控制） */
export interface GitCallStat {
  /** 调用次数（含排队等待后失败/取消的） */
  calls: number
  /** 失败次数（异常/超时/取消都计入） */
  failures: number
  /** 累计墙钟耗时（含排队），ms */
  totalMs: number
}

/** 进程计数快照（供 `window.__gitdeskGitStats` 与单测断言） */
export interface GitStatsSnapshot {
  /** 统计起点时间戳 */
  since: number
  /** 全部子命令调用总数 */
  total: number
  /** 按子命令分组 */
  byCommand: Record<string, GitCallStat>
}

/**
 * 取 git 子命令名（跳过 `-c k=v` / `-C <dir>` 这类前置选项及其值）。
 *
 * 用途有两个：① 进程计数按子命令归类；② 判断该命令是否只读（决定能否注入
 * `GIT_OPTIONAL_LOCKS=0`）。写死的选项值对必须与调用点实际用法一致，漏一个就会把
 * 选项值当成子命令名（分类错位比崩溃更难查）。
 */
export function gitSubcommand(args: string[]): string {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (!arg) continue
    if (arg === "-c" || arg === "--config-env" || arg === "-C" || arg === "--git-dir" || arg === "--work-tree") {
      i++ // 跳过该选项的值
      continue
    }
    if (arg.startsWith("-")) continue
    return arg
  }
  return ""
}

/**
 * git 子进程环境解析器（由 GitPushManager 注入）。
 * 按 cwd 与命令参数返回账号环境；返回 undefined 表示不覆盖父进程环境。
 */
export type GitEnvResolver = (
  cwd: string,
  args: string[],
) => Promise<Record<string, string> | undefined> | Record<string, string> | undefined

export class GitExecutor {
  private storage: GitPushStorage
  /** 当前正在执行的 git 子进程数 */
  private gitRunning = 0
  /** 最大并发 git 子进程数（从存储加载，可通过 setGitConcurrency 修改） */
  private gitMaxConcurrent = DEFAULT_GIT_CONCURRENCY
  /** 网络命令超时（ms，从存储加载，可通过 setNetworkTimeout 修改；默认 240s） */
  private networkTimeoutMs = DEFAULT_NETWORK_TIMEOUT * 1000
  /** 本地命令超时（ms，从存储加载，可通过 setLocalTimeout 修改；默认 60s） */
  private localTimeoutMs = DEFAULT_LOCAL_TIMEOUT * 1000
  /** 等待队列（关联 signal + reject 以便 abort/destroy 时精准拒绝） */
  private gitWaitQueue: WaitQueueItem[] = []
  /** 账号环境解析器（推送账号按项目路径注入 GIT_CONFIG_COUNT / GIT_SSH_COMMAND 等） */
  private envResolver: GitEnvResolver | null = null
  /** 网络命令当前并发（动态跟随 gitMaxConcurrent；双池分离使本地命令洪流不挤占 push/fetch 通道） */
  private networkRunning = 0
  /** 网络命令等待队列 */
  private networkWaitQueue: WaitQueueItem[] = []
  /** 记录当前正在执行的子进程引用（用于取消操作时 kill） */
  private activeProcesses: Set<ChildProcess> = new Set()
  /**
   * 已销毁标记。
   *
   * destroy() 之后必须拒绝新命令：Dock 面板泄漏期间（修复前）或异步链在卸载后才恢复，
   * 仍可能调用 execGit；此时旧的子进程会被 kill 后又无限制地 spawn 新 git，CPU 无法归零。
   */
  private destroyed = false
  /** 项目 push/pull 的 AbortController 数组（同项目多操作不覆盖） */
  private abortControllers: Map<string, AbortController[]> = new Map()
  /** execFile maxBuffer 10MB（防止全量 diff / 大仓库 status 超 Node 默认 1MB 报错） */
  private static readonly MAX_BUFFER = 10 * 1024 * 1024
  /**
   * 是否给命令注入 `GIT_OPTIONAL_LOCKS=0`（默认开）。
   *
   * 为什么：后台/只读调用（尤其 `git status`）会「顺手」刷新并回写 index ——
   * 一次回写就改掉 `.git/index` 的 mtime，触发文件监听标脏 → 又一轮 status，
   * 并且与 commit/stash/discard/push 抢 `index.lock`。Git 官方文档对后台脚本的建议
   * 正是 `git --no-optional-locks status`（等价环境变量 `GIT_OPTIONAL_LOCKS=0`）。
   * 该变量只抑制**可选**加锁子操作，写命令真正必需的锁不受影响，故可全局注入。
   *
   * 保留开关是为了 A/B 对照（设置面板/单测可临时关掉比较 status 耗时）。
   */
  private optionalLocksDisabled = true
  /** 进程计数（按子命令；只读诊断，永不参与业务判定） */
  private callStats = new Map<string, GitCallStat>()
  /** 统计起点（reset 时更新） */
  private statsSince = Date.now()

  constructor(storage: GitPushStorage) {
    this.storage = storage
    this.exposeStats()
  }

  /**
   * 把只读诊断挂到 `window.__gitdeskGitStats`（开发排查用，不进任何 UI）。
   *
   * 存在的理由：审查里所有「减了多少进程」原本只能靠猜。挂上后可以在真实项目集合上
   * 前后对照（`__gitdeskGitStats.snapshot()` / `.reset()`），比读代码估算可靠。
   * Node 单测环境没有 window，静默跳过（单测直接调 `getGitStats()`）。
   */
  private exposeStats(): void {
    if (typeof window === "undefined") return
    try {
      ;(window as unknown as Record<string, unknown>).__gitdeskGitStats = {
        snapshot: () => this.getGitStats(),
        reset: () => this.resetGitStats(),
      }
    } catch {
      // 只读诊断，挂不上不影响业务
    }
  }

  /** 进程计数快照（按子命令） */
  getGitStats(): GitStatsSnapshot {
    const byCommand: Record<string, GitCallStat> = {}
    let total = 0
    for (const [command, stat] of this.callStats) {
      byCommand[command] = { ...stat }
      total += stat.calls
    }
    return {
      since: this.statsSince,
      total,
      byCommand,
    }
  }

  /** 清零计数（A/B 对照的起点） */
  resetGitStats(): void {
    this.callStats.clear()
    this.statsSince = Date.now()
  }

  /** 记录一次调用结束（含失败），command 为空时归入 "(unknown)" */
  private recordCall(command: string, startedAt: number, ok: boolean): void {
    const key = command || "(unknown)"
    let stat = this.callStats.get(key)
    if (!stat) {
      stat = {
        calls: 0,
        failures: 0,
        totalMs: 0,
      }
      this.callStats.set(key, stat)
    }
    stat.calls++
    if (!ok) stat.failures++
    stat.totalMs += Date.now() - startedAt
  }

  /** 开关 `GIT_OPTIONAL_LOCKS=0` 注入（A/B 对照用） */
  setOptionalLocksDisabled(disabled: boolean): void {
    this.optionalLocksDisabled = disabled
  }

  /** 当前是否注入 `GIT_OPTIONAL_LOCKS=0` */
  isOptionalLocksDisabled(): boolean {
    return this.optionalLocksDisabled
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

  /** 从存储加载本地命令超时（秒 → ms，init 时调用） */
  async loadLocalTimeout(): Promise<void> {
    this.localTimeoutMs = (await this.storage.localTimeout.loadOrDefault()) * 1000
  }

  /** 获取当前本地命令超时（秒，供设置面板显示） */
  getLocalTimeout(): number {
    return Math.round(this.localTimeoutMs / 1000)
  }

  /** 设置本地命令超时（秒）并持久化 */
  async setLocalTimeout(n: number): Promise<void> {
    const clamped = clampLocalTimeout(n)
    this.localTimeoutMs = clamped * 1000
    await this.storage.localTimeout.save(clamped)
  }

  /** 设置账号环境解析器（传 null 取消；插件卸载时由 destroy 自行失效） */
  setEnvResolver(resolver: GitEnvResolver | null): void {
    this.envResolver = resolver
  }

  /** 解析环境：解析器异常不能阻断 git 命令（回退系统配置，交由 git 自身报错） */
  private async resolveEnv(cwd: string, args: string[]): Promise<Record<string, string> | undefined> {
    if (!this.envResolver) return undefined
    try {
      return await this.envResolver(cwd, args)
    } catch (e) {
      console.warn("[gitPush] 解析推送账号环境失败，本次使用系统 Git 配置", e)
      return undefined
    }
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
   * @param timeoutMs 显式超时（不传时自动路由：网络命令默认按设置项（240s），本地命令默认按设置项（60s）；clone 等长耗时操作可传更大值）
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
    if (this.destroyed) return Promise.reject(new Error("插件已卸载，git 操作已取消"))
    const isNetwork = isNetworkGitCommand(args)
    const command = gitSubcommand(args)
    const startedAt = Date.now()
    const effectiveTimeout = timeoutMs ?? (isNetwork ? this.networkTimeoutMs : this.localTimeoutMs)
    // 账号环境在排队前快照：入队后项目绑定被修改不应影响已提交的命令
    const resolverEnv = await this.resolveEnv(cwd, args)
    const mergedEnv = this.buildEnv(resolverEnv, options?.env)

    const task = new Promise<string>((resolve, reject) => {
      let killed = false

      const run = () => {
        // 排队期间可能已 destroy：此时队列被清空、run 不会再被调度，
        // 必须在入口补一次判定，否则这个 Promise 永不 settle（调用方永久挂起）
        if (this.destroyed) {
          reject(new Error("插件已卸载，git 操作已取消"))
          this.scheduleNext(isNetwork)
          return
        }
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
            ...(mergedEnv ? { env: mergedEnv } : {}),
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

    // 计数在 Promise 边界统一记：成功/失败/取消都走到这里，不会因为新增 reject 分支漏记
    return task.then(
      (out) => {
        this.recordCall(command, startedAt, true)
        return out
      },
      (e: unknown) => {
        this.recordCall(command, startedAt, false)
        throw e
      },
    )
  }

  /**
   * 合并子进程环境：父进程 + 账号环境 + 调用方环境，并按需注入 `GIT_OPTIONAL_LOCKS=0`。
   *
   * 调用方（或账号解析器）显式给了 `GIT_OPTIONAL_LOCKS` 时以它为准：
   * A/B 对照与现场排障都要能覆盖默认值，否则「关了还生效」会被当成玄学。
   */
  private buildEnv(
    resolverEnv: Record<string, string> | undefined,
    callerEnv: Record<string, string> | undefined,
  ): Record<string, string> | undefined {
    const inject = this.optionalLocksDisabled
      && !resolverEnv?.GIT_OPTIONAL_LOCKS
      && !callerEnv?.GIT_OPTIONAL_LOCKS
    if (!resolverEnv && !callerEnv && !inject) return undefined
    return {
      ...process.env,
      ...resolverEnv,
      ...(inject ? { GIT_OPTIONAL_LOCKS: "0" } : {}),
      ...callerEnv,
    }
  }

  /**
   * 解析当前分支名（单一真源）：detached HEAD 归一化为空串。
   *
   * 首选 `git branch --show-current`（git 2.22+）：**一次进程**同时覆盖三种情形 ——
   *   正常分支 → 分支名；空仓库(unborn) → 待建立的分支名；detached → 空串（退出码仍为 0）。
   * 原实现先 `rev-parse --abbrev-ref HEAD`（detached 返回 "HEAD"）再补 `symbolic-ref`，
   * 最坏要两次进程，而这是轮询热路径上每个项目都要走的解析。
   * 旧版 git 不认识该选项会直接抛错，此时回落原来的两步逻辑（行为完全不变）。
   */
  async getCurrentBranch(cwd: string): Promise<string> {
    try {
      // 成功即信任：空串只可能来自 detached（不支持该选项的旧 git 会抛错，落到下方兜底）
      return (await this.execGit(cwd, ["branch", "--show-current"])).trim()
    } catch {
      // 旧版 git（< 2.22）或不支持该选项的环境，走兜底
    }
    try {
      const branch = await this.execGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"])
      if (branch && branch !== "HEAD") return branch
    } catch { /* unborn branch：走下方 symbolic-ref 兜底 */ }
    try {
      const branch = await this.execGit(cwd, ["symbolic-ref", "--short", "HEAD"])
      return branch || ""
    } catch {
      return ""
    }
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
    if (this.destroyed) return Promise.reject(new Error("插件已卸载，git 操作已取消"))
    const timeoutMs = options?.timeoutMs ?? 600000
    const command = gitSubcommand(args)
    const startedAt = Date.now()
    const mergedEnv = this.buildEnv(undefined, options?.env)
    const task = new Promise<Buffer>((resolve, reject) => {
      let killed = false
      let settled = false
      let stderrTail = ""

      const run = () => {
        // 排队期间可能已 destroy（队列被清空后 run 不会再被调度）：入口补判定，
        // 否则该 Promise 永不 settle（调用方永久挂起）
        if (this.destroyed) {
          if (!settled) {
            settled = true
            reject(new Error("插件已卸载，git 操作已取消"))
          }
          this.scheduleNext(false)
          return
        }
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
            ...(mergedEnv ? { env: mergedEnv } : {}),
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

    return task.then(
      (out) => {
        this.recordCall(command, startedAt, true)
        return out
      },
      (e: unknown) => {
        this.recordCall(command, startedAt, false)
        throw e
      },
    )
  }

  destroy() {
    this.destroyed = true
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
