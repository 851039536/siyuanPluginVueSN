// 远程网络操作：push/pull/fetch 全平台与单平台执行、推送状态检查、智能跳过
import type {
  GitProject,
  PushStatusInfo,
  RemotePushStatus,
} from "../types/storage"
import type { GitPushStorage } from "../types/storage"
import type { PlatformKey } from "../types/meta"
import { PLATFORM_META } from "../types/meta"
import type { GitExecutor } from "./GitExecutor"
import type { ProjectStore } from "./ProjectStore"
import type { ProjectWriteLock } from "./ProjectWriteLock"
// 直连纯模块而非 "../utils" 桶：桶会转出依赖运行时 "siyuan" 的模块，
// 使 RemoteOps 无法在 Node 单测环境加载（fetchBehind.git.spec.ts 需要真实实例）
import { getProjectRemoteNames, hasUnpushedCommits, mayAttemptPush, orderRemotesForPullCheck } from "../utils/platform"
import { parseAheadBehind } from "../utils/gitOutput"
import { resolveValidPathWithSource } from "../utils/project"
import { getErrorMessage } from "@/utils/stringUtils"

/** 远程操作结果 */
export interface RemoteOpResult {
  ok: boolean
  stdout: string
  stderr: string
  skipped?: boolean
}

/** 全平台操作结果类型（按平台 key 索引 + 总体成功标记，新增平台无需改类型） */
export type AllPlatformResult = { success: boolean } & Record<PlatformKey, RemoteOpResult>

export class RemoteOps {
  private executor: GitExecutor
  private store: ProjectStore
  private storage: GitPushStorage
  /** 项目级写锁：push/pull 主体在锁内执行，与 commit/stash/discard 等写操作互斥（防 index.lock 竞争） */
  private writeLock: ProjectWriteLock
  /** 推送分支模式：all=全部分支, head=仅当前分支 */
  private pushBranchMode: "all" | "head" = "all"
  /** 推送状态缓存（用于智能跳过） */
  private pushStatusCache: Record<string, PushStatusInfo> = {}

  constructor(executor: GitExecutor, store: ProjectStore, storage: GitPushStorage, writeLock: ProjectWriteLock) {
    this.executor = executor
    this.store = store
    this.storage = storage
    this.writeLock = writeLock
  }

  /** 从存储加载推送分支模式（init 时调用） */
  async loadPushBranchMode(): Promise<void> {
    this.pushBranchMode = await this.storage.pushBranchMode.loadOrDefault()
  }

  /** 获取推送分支模式 */
  getPushBranchMode(): "all" | "head" {
    return this.pushBranchMode
  }

  /** 设置推送分支模式并持久化 */
  async setPushBranchMode(mode: "all" | "head"): Promise<void> {
    this.pushBranchMode = mode
    await this.storage.pushBranchMode.save(mode)
  }

  /** 获取项目的远程名称（按平台类型，未配置时返回 undefined） */
  private getRemoteName(project: GitProject, target: PlatformKey): string | undefined {
    switch (target) {
      case "github": return project.githubRemote
      case "gitee": return project.giteeRemote
      case "cnb": return project.cnbRemote
      default: return project.giteaRemote
    }
  }

  /** 推送操作的单个远程结果（已跳过） */
  private static readonly skippedResult: RemoteOpResult = {
    ok: false,
    stdout: "",
    stderr: "",
    skipped: true,
  }

  /** pull 失败时增强错误提示（首次失败与重试失败统一应用） */
  private enhancePullError(action: "push" | "pull", msg: string): string {
    if (action !== "pull") return msg
    if (/fast-forward|non-fast-forward/i.test(msg)) {
      return `拉取失败（本地与远程提交历史已分叉，无法快进合并）。\n请在终端使用 git pull --rebase 或手动 merge 解决。\n原始错误: ${msg}`
    }
    // 未能解析当前分支时退回裸 pull，非默认上游远程会报 "did not specify a branch"
    if (/did not specify a branch/i.test(msg)) {
      return `拉取失败（无法确定当前分支，且该远程不是当前分支的默认上游）。\n请确认仓库不处于 detached HEAD 或空仓库状态后重试。\n原始错误: ${msg}`
    }
    return msg
  }

  /** 通用远程操作辅助函数（push/pull 共用，含失败重试） */
  private async tryRemoteOp(
    projectPath: string,
    remoteName: string | undefined,
    action: "push" | "pull",
    signal?: AbortSignal,
    pullBranch?: string,
    opts?: { forceWithLease?: boolean, forceBranch?: string },
  ): Promise<RemoteOpResult> {
    if (!remoteName) return RemoteOps.skippedResult

    let args: string[]
    if (action === "push") {
      if (opts?.forceWithLease) {
        // 强制推送固定推当前分支，不受「全部分支/仅当前分支」设置影响
        args = ["push", "--force-with-lease", remoteName, opts.forceBranch || "HEAD"]
      } else {
        args = this.pushBranchMode === "head"
          ? ["push", remoteName, "HEAD"]
          : ["push", remoteName, "--all"]
      }
    } else {
      // 显式指定分支，避免非默认上游远程时 Git 报 "did not specify a branch" 错误
      args = pullBranch
        ? ["pull", remoteName, pullBranch, "--ff-only"]
        : ["pull", remoteName, "--ff-only"]
    }

    const tryExec = async (): Promise<RemoteOpResult> => {
      try {
        const stdout = await this.executor.execGit(projectPath, args, signal)
        return { ok: true, stdout: stdout || "", stderr: "" }
      } catch (e: unknown) {
        const msg = this.enhancePullError(action, getErrorMessage(e) || String(e))
        // 超时不重试：一次超时已等满整个超时窗口（重试会翻倍耗时才反馈），且可调大超时解决；仅 DNS/连接类瞬态抖动保留 1 次重试
        const isTimeoutErr = /(git 命令超时|timed out)/i.test(msg)
        const isNetworkErr = !isTimeoutErr && /(could not resolve|connection refused|connection reset|unable to access|early EOF|RPC failed)/i.test(msg)
        if (!isNetworkErr) {
          return { ok: false, stdout: "", stderr: msg }
        }
        // 重试 1 次（1s 延迟）
        if (signal?.aborted) {
          return { ok: false, stdout: "", stderr: "操作已取消" }
        }
        await new Promise<void>((resolve) => {
          const timer = setTimeout(() => {
            // timer 自然到期后移除 abort listener，避免残留
            if (signal) { signal.removeEventListener("abort", onAbort) }
            resolve()
          }, 1000)
          const onAbort = () => { clearTimeout(timer); resolve() }
          if (signal) { signal.addEventListener("abort", onAbort, { once: true }) }
        })
        if (signal?.aborted) {
          return { ok: false, stdout: "", stderr: "操作已取消" }
        }
        try {
          const stdout = await this.executor.execGit(projectPath, args, signal)
          return { ok: true, stdout: stdout || "", stderr: "" }
        } catch (e2: unknown) {
          return { ok: false, stdout: "", stderr: this.enhancePullError(action, getErrorMessage(e2) || String(e2)) }
        }
      }
    }

    return tryExec()
  }

  /** "项目未找到" 错误结果模板 */
  private get notFoundResult(): AllPlatformResult {
    const err: RemoteOpResult = { ok: false, stdout: "", stderr: "项目未找到" }
    const byPlatform = {} as Record<PlatformKey, RemoteOpResult>
    for (const pm of PLATFORM_META) byPlatform[pm.key] = err
    return { success: false, ...byPlatform }
  }

  /**
   * 推送到全部已配置的远程
   */
  async pushToAll(id: string): Promise<AllPlatformResult> {
    return this.remoteOpAll(id, "push")
  }

  /**
   * 从全部已配置远程拉取
   */
  async pullToAll(id: string): Promise<AllPlatformResult> {
    return this.remoteOpAll(id, "pull")
  }

  /** 全平台 push/pull 通用实现（并行 + 智能跳过；forceWithLease=true 时禁用智能跳过） */
  private async remoteOpAll(id: string, action: "push" | "pull", forceWithLease = false): Promise<AllPlatformResult> {
    const project = await this.store.getProjectById(id)
    if (!project) return this.notFoundResult

    const resolved = resolveValidPathWithSource(project)
    const cwd = resolved.path
    // 全部已知路径均不存在时 resolveValidPath 降级返回主路径（可能不存在），
    // 告警呈现到各平台输出而非伪装成底层 git 报错（ENOENT 等）
    const pathWarning = resolved.source === "fallback"
      ? "⚠ 所有已知路径均不存在，已回退主路径，请检查项目路径配置"
      : ""
    /** 仅对实际执行且失败的结果前置路径告警（成功说明回退路径可用，无需打扰；与单平台路径一致） */
    const withPathWarning = (r: RemoteOpResult): RemoteOpResult =>
      pathWarning && !r.skipped && !r.ok ? { ...r, stderr: pathWarning + (r.stderr ? `\n${r.stderr}` : "") } : r

    // 智能跳过：推送前检查缓存，跳过 ahead===0 的远程
    const cachedStatus = this.pushStatusCache[id]
    function shouldSkip(key: PlatformKey): boolean {
      if (action !== "push") return false
      if (!cachedStatus) return false
      const rs = cachedStatus.remotes[key]
      if (!rs) return false
      // 状态检查失败（error 字段存在）时不能判定为已同步，否则会静默跳过应推送的远程
      return !rs.error && !mayAttemptPush(rs)
    }

    // 写锁：push/pull 主体与本地写操作（commit/stash/discard 等）按项目路径互斥
    return this.writeLock.runExclusive(cwd, () =>
      this.executor.withAbortController(id, action, async (signal) => {
        // pull 时预解析当前分支，供 tryRemoteOp 显式指定拉取分支；强制推送时同样需要分支名
        const pullBranch = action === "pull" ? await this.executor.getCurrentBranch(cwd) : undefined
        const forceBranch = action === "push" && forceWithLease ? await this.executor.getCurrentBranch(cwd) : undefined
        if (forceWithLease && !forceBranch) {
          throw new Error("无法确定当前分支，已取消强制推送")
        }
        // 智能跳过的静态结果
        const skippedResults: Record<string, RemoteOpResult> = {}
        const entries: { key: PlatformKey, remoteName: string | undefined }[] = []
        for (const { key, name } of getProjectRemoteNames(project)) {
          if (shouldSkip(key) && !forceWithLease) {
            skippedResults[key] = { ok: true, stdout: "已同步（跳过）", stderr: "", skipped: true }
          } else {
            entries.push({ key, remoteName: name })
          }
        }
        // 处理未配置的远程：标记为 skipped
        for (const pm of PLATFORM_META) {
          if (skippedResults[pm.key] === undefined && !entries.some((e) => e.key === pm.key)) {
            skippedResults[pm.key] = RemoteOps.skippedResult
          }
        }

        type SettledEntry = { key: PlatformKey } & RemoteOpResult
        const results = await Promise.allSettled(
          entries.map(({ key, remoteName }): Promise<SettledEntry> =>
            this.tryRemoteOp(cwd, remoteName, action, signal, pullBranch, { forceWithLease, forceBranch }).then((r) => ({ key, ...r })),
          ),
        )

        // 单次遍历建 Map，避免 4 次 results.find() O(4N) 开销
        const resultMap = new Map<PlatformKey, RemoteOpResult>()
        let rejectedError = ""
        for (const r of results) {
          if (r.status === "fulfilled") {
            const { key, ...rest } = r.value
            resultMap.set(key, rest)
          } else {
            rejectedError = rejectedError || String(r.reason?.message || r.reason || "未知错误")
          }
        }

        const build = (key: PlatformKey): RemoteOpResult => {
          // 优先返回跳过结果
          if (skippedResults[key]) return skippedResults[key]
          const mapped = resultMap.get(key)
          if (mapped) return mapped
          // 已配置但 rejected → 错误
          return entries.some((e) => e.key === key)
            ? { ok: false, stdout: "", stderr: rejectedError || "未知错误" }
            : RemoteOps.skippedResult
        }

        // 按平台元数据统一投影，避免新增平台时此处漏改
        const byPlatform = {} as Record<PlatformKey, RemoteOpResult>
        for (const pm of PLATFORM_META) byPlatform[pm.key] = withPathWarning(build(pm.key))

        // push 成功后失效智能跳过缓存，保证下次 shouldSkip 走真实状态检查（commit 路径已失效，但 push 本身也需收尾）
        if (action === "push") { this.invalidatePushStatusCache(id) }

        return {
          success: Object.values(byPlatform).some((r) => r.ok),
          ...byPlatform,
        }
      }),
    )
  }

  /**
   * 使用 --force-with-lease 强制推送当前分支到全部已配置远程
   */
  async forcePushToAll(id: string): Promise<AllPlatformResult> {
    return this.remoteOpAll(id, "push", true)
  }

  /**
   * 推送到单个远程仓库
   */
  async pushSingle(
    id: string,
    target: PlatformKey,
  ): Promise<{ ok: boolean, stdout: string, stderr: string }> {
    return this.remoteOpSingle(id, target, "push")
  }

  /**
   * 从单个远程仓库拉取
   */
  async pullSingle(
    id: string,
    target: PlatformKey,
  ): Promise<{ ok: boolean, stdout: string, stderr: string }> {
    return this.remoteOpSingle(id, target, "pull")
  }

  /** 单平台 push/pull 通用实现 */
  private async remoteOpSingle(
    id: string,
    target: PlatformKey,
    action: "push" | "pull",
  ): Promise<{ ok: boolean, stdout: string, stderr: string }> {
    const project = await this.store.getProjectById(id)
    if (!project) {
      return { ok: false, stdout: "", stderr: "项目未找到" }
    }

    const resolved = resolveValidPathWithSource(project)
    const cwd = resolved.path
    // 路径回退告警只在失败时前置（成功说明回退路径实际可用，无需打扰）
    const pathWarning = resolved.source === "fallback"
      ? "⚠ 所有已知路径均不存在，已回退主路径，请检查项目路径配置"
      : ""
    const remoteName = this.getRemoteName(project, target)
    // 纵深防御：未配置该平台远程时直接返回，避免对不存在的远程执行 git 命令
    if (!remoteName) {
      return { ok: false, stdout: "", stderr: "该平台远程未配置" }
    }

    // 写锁：push/pull 主体与本地写操作（commit/stash/discard 等）按项目路径互斥
    return this.writeLock.runExclusive(cwd, () =>
      this.executor.withAbortController(id, action, async (signal) => {
        // pull 时预解析当前分支，显式指定拉取分支
        const pullBranch = action === "pull" ? await this.executor.getCurrentBranch(cwd) : undefined
        const result = await this.tryRemoteOp(cwd, remoteName, action, signal, pullBranch)
        // push 成功后失效智能跳过缓存
        if (action === "push") { this.invalidatePushStatusCache(id) }
        return {
          ok: result.ok,
          stdout: result.stdout,
          stderr: pathWarning && !result.ok ? `${pathWarning}\n${result.stderr}` : result.stderr,
        }
      }),
    )
  }

  /**
   * 按路径 fetch 指定远程（--prune 清理已删除远程分支的跟踪引用），供一致性分析与批量刷新使用
   * 支持取消（signal 触发后 kill 子进程）
   */
  async fetchRemoteAt(cwd: string, remoteName: string, opts?: { prune?: boolean, signal?: AbortSignal }): Promise<void> {
    const args = opts?.prune ? ["fetch", "--prune", remoteName] : ["fetch", remoteName]
    await this.executor.execGit(cwd, args, opts?.signal)
  }

  /**
   * 「需拉取」专用短路 fetch：按平台优先级依次 fetch。
   *
   * 用户明确的语义（勿按直觉改）：
   *   - 某平台**需要拉取**（behind > 0）⇒ **继续**执行后续平台（镜像可能有额外提交，不能停）；
   *   - 某平台**不需要拉取**（behind === 0）⇒ **跳过**后续平台（已是最新，省网络往返）；
   *   - fetch **失败**（失效/无权限/超时）⇒ 视为「未知」，继续下一个平台。
   *
   * ⚠️ 关键：`remoteBehind` 返回 `number | null`——
   *   `0` 才是「确认无需拉取」（可短路）；`null` 表示「无法判定」（detached / 空仓库 /
   *   该远程的跟踪 ref 不存在，例如远程换了默认分支或指向另一个仓库）。
   *   把「无法判定」当成 0 会跳过后面的平台，从而漏掉 github 上真实的 behind>0
   *   ——正是用户最初抱怨「明明有更新却显示没有」的同类故障。
   *
   * @returns `moved` 至少一个平台确认有更新；`attempted` 尝试的平台数；
   *          `failures` fetch 失败的平台数；`unknown` 成功 fetch 但无法判定 behind 的平台数。
   */
  async fetchUntilMoved(
    id: string,
    opts?: { timeoutMs?: number, signal?: AbortSignal },
  ): Promise<{ moved: boolean, attempted: number, failures: number, unknown: number }> {
    const project = await this.store.getProjectById(id)
    if (!project) return { moved: false, attempted: 0, failures: 0, unknown: 0 }

    const resolved = resolveValidPathWithSource(project)
    const cwd = resolved.path
    const remotes = orderRemotesForPullCheck(project)
    if (remotes.length === 0) return { moved: false, attempted: 0, failures: 0, unknown: 0 }

    // 分支名只解析一次（原来每个平台都调一次 getCurrentBranch = N 次 rev-parse）
    const branch = await this.executor.getCurrentBranch(cwd)
    let attempted = 0
    let failures = 0
    let unknown = 0
    let moved = false
    for (const { name } of remotes) {
      if (opts?.signal?.aborted) break
      attempted++
      try {
        // 短超时 fetch：不可达远程快速失败，不拖住整批
        await this.executor.execGit(cwd, ["fetch", "--prune", name], opts?.signal, opts?.timeoutMs)
      } catch {
        // 该平台不可用（已失效/网络不通/无权限）：视为「未知」，继续尝试下一个平台
        failures++
        continue
      }

      const behind = await this.remoteBehind(cwd, name, branch)
      if (behind === null) {
        // fetch 成功但无法判定（detached / ref 不存在）：**不能短路**，当作未知继续下一个平台
        unknown++
        continue
      }
      if (behind > 0) {
        // 该平台**需要拉取** ⇒ 记录结果并**继续执行后续平台**（用户要求：其他平台也要执行）
        moved = true
        continue
      }
      // 该平台确认**无需拉取** ⇒ 用户要求：跳过后续平台
      // （gitee 已是最新，镜像通常同步；继续查只会白付网络往返）
      break
    }
    return { moved, attempted, failures, unknown }
  }

  /**
   * 读取某远程跟踪 ref 相对 HEAD 的 behind。
   *
   * @param branch 已解析的当前分支（由调用方解析一次后传入，避免每平台重复 rev-parse）
   * @returns `>0` 有更新可拉取；`0` **确认**无更新（可安全短路）；
   *          `null` 无法判定（空分支/detached / ref 不存在 / 命令失败）——调用方**不得**据此短路。
   *
   * 只看该远程自己的 ref（`refs/remotes/<remote>/<branch>`），避免把其他远程的更新
   * 误算到本远程头上。
   */
  private async remoteBehind(cwd: string, remoteName: string, branch: string): Promise<number | null> {
    if (!branch) return null
    try {
      const raw = await this.executor.execGit(cwd, [
        "for-each-ref",
        "--format=%(refname:short)%00%(ahead-behind:HEAD)",
        `refs/remotes/${remoteName}/${branch}`,
      ])
      const map = parseAheadBehind(raw)
      const entry = map.get(`${remoteName}/${branch}`)
      // 格式为 <behind> <ahead>；ref 不存在时 for-each-ref 静默缺行 → 映射中无该键 → null
      return entry ? entry.behind : null
    } catch {
      return null
    }
  }

  /**
   * Fetch 项目所有已配置远程，仅更新跟踪分支不合并代码
   *
   * @param timeoutMs 单远程 fetch 超时（ms）；缺省走 GitExecutor 的网络超时设置。
   *   后台检测路径应传短超时，避免不可达远程挂满默认 240s。
   */
  async fetchAllForProject(id: string, opts?: { timeoutMs?: number }): Promise<{ fetched: string[]; errors: string[] }> {
    const project = await this.store.getProjectById(id)
    if (!project) return { fetched: [], errors: [] }

    const resolved = resolveValidPathWithSource(project)
    const cwd = resolved.path
    // 路径回退告警前置到错误列表（fetch 失败时用户先看到路径配置问题，而非底层 ENOENT）
    const pathWarning = resolved.source === "fallback"
      ? "⚠ 所有已知路径均不存在，已回退主路径，请检查项目路径配置"
      : ""
    const remotesToFetch = getProjectRemoteNames(project).map((r) => r.name)

    if (remotesToFetch.length === 0) {
      return { fetched: [], errors: [] }
    }

    const fetched: string[] = []
    const errors: string[] = []
    const results = await Promise.allSettled(
      remotesToFetch.map((name) => this.executor
        .execGit(cwd, ["fetch", "--prune", name], undefined, opts?.timeoutMs)
        .then(() => name)),
    )

    for (const r of results) {
      if (r.status === "fulfilled") { fetched.push(r.value) }
      else { errors.push(r.reason?.message || String(r.reason)) }
    }

    if (pathWarning && errors.length > 0) { errors.unshift(pathWarning) }
    return { fetched, errors }
  }

  /**
   * 检查项目各远程的推送状态（纯本地比对跟踪 ref，不发起网络请求）
   * @param opts.branch 已知分支名（调用方持有可省一次 rev-parse）
   */
  async checkPushStatus(id: string, opts?: { branch?: string }): Promise<PushStatusInfo> {
    const project = await this.store.getProjectById(id)
    const emptyResult: PushStatusInfo = {
      branch: "",
      remotes: {},
      needsPush: false,
    }

    if (!project) {
      // 项目已删除：不得保留旧分支的智能跳过状态
      delete this.pushStatusCache[id]
      return emptyResult
    }

    const resolved = resolveValidPathWithSource(project)
    const cwd = resolved.path
    const pathWarning = resolved.source === "fallback"
      ? "⚠ 所有已知路径均不存在，已回退主路径，请检查项目路径配置"
      : ""

    const status: PushStatusInfo = {
      branch: "",
      remotes: {},
      needsPush: false,
    }

    // detached HEAD 时 getCurrentBranch 返回空串并提前返回，避免构造 remote/HEAD...HEAD 触发 ambiguous argument 被误判为 noUpstream（虚假 needsPush）
    status.branch = opts?.branch ?? await this.executor.getCurrentBranch(cwd)
    if (!status.branch) {
      // 路径回退场景不再静默返回空结果（空态假象）：把告警挂到各已配置远程的 error 字段呈现
      if (pathWarning) {
        for (const { key } of getProjectRemoteNames(project)) {
          status.remotes[key] = { ahead: 0, behind: 0, noUpstream: false, error: pathWarning }
        }
      }
      // detached HEAD / 空仓库：缓存里的旧分支 ahead 已失效，必须清掉，
      // 否则 pushToAll 的智能跳过会沿用旧分支判断
      delete this.pushStatusCache[id]
      return status
    }

    // 由 PLATFORM_META 驱动检查
    const remotesToCheck = getProjectRemoteNames(project).map((r) => ({ key: r.key, remoteName: r.name }))

    /**
     * 一次性批量读取全部远程跟踪 ref 的 ahead/behind。
     *
     * 原实现逐远程 `rev-list --left-right --count <remote>/<branch>...HEAD`，即 N 个远程 = N 次 git 进程。
     * 实测（Windows / git 2.53）：每次 git 调用约 250~310ms 的**进程启动费**主导耗时，
     * 故 4 远程项目逐次调用约 1.84s，而单次 `for-each-ref` 仅约 0.29s（**6.4×**）。
     *
     * noUpstream 判定同时变得更稳：ref 不存在时 for-each-ref 不报错、仅缺该行（退出码 0），
     * 可直接按「映射中无该 ref」判定；原先靠正则匹配 rev-list 的 5 套英文报错措辞。
     * ref 不存在时仍复用一次 `rev-list --count HEAD`（ahead 记为本地提交数，保持既有语义）。
     *
     * ⚠️ 必须区分「整体失败」与「该 ref 不存在」：前者是真实故障，若也按 noUpstream 呈现，
     * 会把 git 报错伪装成「远程分支尚未建立」，并因 noUpstream 被视作待推送（platform.ts /
     * usePushStatusView.ts）而误报「领先 N 个提交」。故失败时整体回落为 error 呈现。
     */
    const aheadBehind = await this.readRemoteAheadBehind(cwd, status.branch)

    // HEAD 提交数（懒加载：仅在确有 noUpstream 远程时才发这次进程）
    let headCommitCountPromise: Promise<number> | null = null
    const headCommitCount = async (): Promise<number> => {
      if (headCommitCountPromise === null) {
        headCommitCountPromise = this.executor.execGit(cwd, ["rev-list", "--count", "HEAD"]).then(
          (t) => Number.parseInt(t, 10) || 0,
          () => 0,
        )
      }
      return await headCommitCountPromise
    }

    if (!aheadBehind.ok) {
      // 批量读取整体失败（仓库损坏 / 瞬时 IO 错误等）：与路径回退同样按错误呈现，
      // 不可退化为 noUpstream（否则真实故障会被伪装成「远程分支尚未建立」）
      for (const { key } of remotesToCheck) {
        status.remotes[key] = {
          ahead: 0,
          behind: 0,
          noUpstream: false,
          error: aheadBehind.error,
        }
      }
      this.pushStatusCache[id] = status
      return status
    }

    const results: { key: PlatformKey, result: RemotePushStatus }[] = []
    for (const { key, remoteName } of remotesToCheck) {
      const refName = `${remoteName}/${status.branch}`
      const counts = aheadBehind.map.get(refName)
      if (counts) {
        results.push({ key, result: { ahead: counts.ahead, behind: counts.behind, noUpstream: false } })
        continue
      }
      // 该远程跟踪 ref 不存在 → noUpstream（与既有语义一致：ahead 取本地提交总数）
      const count = await headCommitCount()
      results.push({ key, result: { ahead: count, behind: 0, noUpstream: true } })
    }

    for (const { key, result } of results) {
      status.remotes[key] = result
      // 聚合判据只看「有没有待推送提交」：空仓库（ahead=0 且 noUpstream）没有内容可推，
      // 不应启用「推送全部 / 强制推送」；单平台按钮仍经 mayAttemptPush 保留尝试能力。
      if (hasUnpushedCommits(result)) status.needsPush = true
    }

    // 缓存用于智能跳过
    this.pushStatusCache[id] = status
    return status
  }

  /**
   * 单次 `for-each-ref` 读取全部 `refs/remotes` 的 ahead/behind（相对 HEAD）。
   *
   * 返回判别联合：`ok: false` 表示**命令整体失败**（仓库损坏 / 瞬时 IO 错误等），
   * 与 `ok: true` 但映射中缺某 ref（该远程确实无上游）语义不同 —— 调用方必须分开处理，
   * 否则真实故障会被伪装成 noUpstream。
   */
  private async readRemoteAheadBehind(
    cwd: string,
    branch: string,
  ): Promise<
    | { ok: true, map: Map<string, { ahead: number, behind: number }> }
    | { ok: false, error: string }
  > {
    try {
      // 只遍历「<远程名>/<当前分支>」形式的 ref，而非全量 refs/remotes。
      //
      // 为什么用 ref 模式过滤而不是取全部再丢弃：
      //   refs/remotes 下除了真实分支 ref 还有符号 ref（origin/HEAD → origin/main 之类，
      //   实测 8 个条目里有 4 个是这类符号 ref），以及同远程的其他分支（feature/x）。
      //   原实现取全部再 `endsWith('/'+branch)` 过滤，遍历量与远程分支总数线性相关；
      //   交给 git 在内部按模式过滤后，输出行数直接降到「远程个数」量级。
      //
      // ⚠️ 模式必须是 `refs/remotes/*/${branch}` 且用单星号：单星号只匹配「远程名」这一段，
      //    分支名本身可含斜杠（feature/login）—— 已实测该模式对含斜杠分支名能精确匹配
      //    到全部对应远程（origin/feature/login、upstream/feature/login）。
      //    切勿写成 `**` 或自行拼接路径，否则会引入匹配面过宽/过窄的问题。
      //
      // ⚠️ 分支名可能含 glob 特殊字符（`*`/`?`/`[`，git 允许但有告警）。此时模式会匹配
      //    到非预期 ref，故下方仍保留一次 endsWith 精确过滤作为兜底 —— 双保险，
      //    代价只是对已收窄的少量结果再判一次后缀。
      const raw = await this.executor.execGit(cwd, [
        "for-each-ref",
        // %00 分隔 refname 与计数：分支名可含空格，按空格切分会错位
        "--format=%(refname:short)%00%(ahead-behind:HEAD)",
        `refs/remotes/*/${branch}`,
      ])
      const all = parseAheadBehind(raw)
      const map = new Map<string, { ahead: number, behind: number }>()
      for (const [refName, counts] of all) {
        // 兜底精确匹配（见上方 glob 特殊字符说明）
        if (refName.endsWith(`/${branch}`)) map.set(refName, counts)
      }
      return { ok: true, map }
    } catch (e: unknown) {
      // 命令失败：不得回落为空映射（那会被下游误判为「所有远程都无上游」）
      return { ok: false, error: getErrorMessage(e) || String(e) }
    }
  }

  /** 失效推送状态缓存（commit 等改变本地提交的操作后调用，防止智能跳过用到陈旧的 ahead=0） */
  invalidatePushStatusCache(id: string): void {
    delete this.pushStatusCache[id]
  }
}
