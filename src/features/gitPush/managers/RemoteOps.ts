// 远程网络操作：push/pull/fetch 全平台与单平台执行、推送状态检查、智能跳过
import type {
  GitProject,
  GitRemoteInfo,
  PushStatusInfo,
} from "../types/storage"
import type { GitPushStorage } from "../types/storage"
import type { PlatformKey } from "../types/meta"
import { PLATFORM_META } from "../types/meta"
import type { GitExecutor } from "./GitExecutor"
import type { ProjectStore } from "./ProjectStore"
import { getProjectRemoteNames, resolveValidPath } from "../utils"
import { getErrorMessage } from "@/utils/stringUtils"

/** 远程操作结果 */
export interface RemoteOpResult {
  ok: boolean
  stdout: string
  stderr: string
  skipped?: boolean
}

/** 全平台操作结果类型 */
export interface AllPlatformResult {
  success: boolean
  github: RemoteOpResult
  gitee: RemoteOpResult
  gitea: RemoteOpResult
  cnb: RemoteOpResult
}

export class RemoteOps {
  private executor: GitExecutor
  private store: ProjectStore
  private storage: GitPushStorage
  /** 推送分支模式：all=全部分支, head=仅当前分支 */
  private pushBranchMode: "all" | "head" = "all"
  /** 推送状态缓存（用于智能跳过） */
  private pushStatusCache: Record<string, PushStatusInfo> = {}

  constructor(executor: GitExecutor, store: ProjectStore, storage: GitPushStorage) {
    this.executor = executor
    this.store = store
    this.storage = storage
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

  /** 判断远程仓库是否为已知平台 */
  private isKnownRemote(remote: GitRemoteInfo, platform: PlatformKey): boolean {
    if (platform === "github") return remote.isGithub
    if (platform === "gitee") return remote.isGitee
    if (platform === "cnb") return remote.isCnb
    return remote.isGitea
  }

  /** 获取项目的远程名称（按平台类型） */
  private getRemoteName(project: GitProject, target: PlatformKey): string {
    switch (target) {
      case "github": return project.githubRemote || "github"
      case "gitee": return project.giteeRemote || "gitee"
      case "cnb": return project.cnbRemote || "cnb"
      default: return project.giteaRemote || "gitea"
    }
  }

  /** 推送操作的单个远程结果（已跳过） */
  private static readonly skippedResult: RemoteOpResult = {
    ok: false,
    stdout: "",
    stderr: "",
    skipped: true,
  }

  /** 通用远程操作辅助函数（push/pull 共用，含失败重试） */
  private async tryRemoteOp(
    projectPath: string,
    remoteName: string | undefined,
    action: "push" | "pull",
    signal?: AbortSignal,
  ): Promise<RemoteOpResult> {
    if (!remoteName) return RemoteOps.skippedResult

    let args: string[]
    if (action === "push") {
      args = this.pushBranchMode === "head"
        ? ["push", remoteName, "HEAD"]
        : ["push", remoteName, "--all"]
    } else {
      args = ["pull", remoteName, "--ff-only"]
    }

    const tryExec = async (): Promise<RemoteOpResult> => {
      try {
        const stdout = await this.executor.execGit(projectPath, args, signal)
        return { ok: true, stdout: stdout || "", stderr: "" }
      } catch (e: unknown) {
        let msg = getErrorMessage(e) || String(e)
        // --ff-only 分叉时给用户更友好的提示
        if (action === "pull" && /fast-forward|non-fast-forward/i.test(msg)) {
          msg = `拉取失败（远程有新提交且与本地有分叉）。\n请先使用 Stash 暂存本地修改，然后重新拉取。\n原始错误: ${msg}`
        }
        // 判断是否为瞬态网络错误（可重试）
        const isNetworkErr = /(could not resolve|timed out|connection refused|connection reset|unable to access|early EOF|RPC failed)/i.test(msg)
        if (!isNetworkErr) {
          return { ok: false, stdout: "", stderr: msg }
        }
        // 重试 1 次（1s 延迟）
        if (signal?.aborted) {
          return { ok: false, stdout: "", stderr: "操作已取消" }
        }
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, 1000)
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
          return { ok: false, stdout: "", stderr: getErrorMessage(e2) || String(e2) }
        }
      }
    }

    return tryExec()
  }

  /** "项目未找到" 错误结果模板 */
  private get notFoundResult(): AllPlatformResult {
    const err: RemoteOpResult = { ok: false, stdout: "", stderr: "项目未找到" }
    return {
      success: false,
      github: err,
      gitee: err,
      gitea: err,
      cnb: err,
    }
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

  /** 全平台 push/pull 通用实现（并行 + 智能跳过） */
  private async remoteOpAll(id: string, action: "push" | "pull"): Promise<AllPlatformResult> {
    const project = await this.store.getProjectById(id)
    if (!project) return this.notFoundResult

    const cwd = resolveValidPath(project)

    // 智能跳过：推送前检查缓存，跳过 ahead===0 的远程
    const cachedStatus = this.pushStatusCache[id]
    function shouldSkip(key: PlatformKey): boolean {
      if (action !== "push") return false
      if (!cachedStatus) return false
      const rs = cachedStatus.remotes[key]
      if (!rs) return false
      return rs.ahead === 0 && !rs.noUpstream
    }

    return this.executor.withAbortController(id, action, async (signal) => {
      // 智能跳过的静态结果
      const skippedResults: Record<string, RemoteOpResult> = {}
      const entries: { key: PlatformKey, remoteName: string | undefined }[] = []
      for (const { key, name } of getProjectRemoteNames(project)) {
        if (shouldSkip(key)) {
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

      const results = await Promise.allSettled(
        entries.map(({ key, remoteName }) =>
          this.tryRemoteOp(cwd, remoteName, action, signal).then((r) => ({ key, ...r })),
        ),
      )

      // 单次遍历建 Map，避免 4 次 results.find() O(4N) 开销
      const resultMap = new Map<PlatformKey, RemoteOpResult>()
      let rejectedError = ""
      for (const r of results) {
        if (r.status === "fulfilled") {
          const val = r.value as any
          const { key, ...rest } = val
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

      const github = build("github")
      const gitee = build("gitee")
      const gitea = build("gitea")
      const cnb = build("cnb")

      return {
        success: github.ok || gitee.ok || gitea.ok || cnb.ok,
        github,
        gitee,
        gitea,
        cnb,
      }
    })
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

    const cwd = resolveValidPath(project)
    const remoteName = this.getRemoteName(project, target)

    return this.executor.withAbortController(id, action, async (signal) => {
      const result = await this.tryRemoteOp(cwd, remoteName, action, signal)
      return {
        ok: result.ok,
        stdout: result.stdout,
        stderr: result.stderr,
      }
    })
  }

  /**
   * Fetch 单个远程（仅更新远程跟踪分支，不合并代码）
   */
  private async fetchRemote(cwd: string, remoteName: string): Promise<string> {
    return await this.executor.execGit(cwd, ["fetch", remoteName])
  }

  /**
   * Fetch 项目所有已配置远程，仅更新跟踪分支不合并代码
   */
  async fetchAllForProject(id: string): Promise<{ fetched: string[]; errors: string[] }> {
    const project = await this.store.getProjectById(id)
    if (!project) return { fetched: [], errors: [] }

    const cwd = resolveValidPath(project)
    const remotesToFetch = getProjectRemoteNames(project).map((r) => r.name)

    if (remotesToFetch.length === 0) {
      return { fetched: [], errors: [] }
    }

    const fetched: string[] = []
    const errors: string[] = []
    const results = await Promise.allSettled(
      remotesToFetch.map((name) => this.fetchRemote(cwd, name).then(() => name)),
    )

    for (const r of results) {
      if (r.status === "fulfilled") { fetched.push(r.value) }
      else { errors.push(r.reason?.message || String(r.reason)) }
    }

    return { fetched, errors }
  }

  /**
   * 检查项目各远程的推送状态
   * @param opts.fetchFirst 是否先 fetch 远程再检查（默认 false，手动刷新时传 true）
   */
  async checkPushStatus(id: string, opts?: { branch?: string; fetchFirst?: boolean }): Promise<PushStatusInfo> {
    const project = await this.store.getProjectById(id)
    const emptyResult: PushStatusInfo = {
      branch: "",
      remotes: {},
      needsPush: false,
    }

    if (!project) return emptyResult

    const cwd = resolveValidPath(project)

    const status: PushStatusInfo = {
      branch: "",
      remotes: {},
      needsPush: false,
    }

    try {
      status.branch = opts?.branch ?? await this.executor.execGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"])
    } catch {
      return emptyResult
    }

    // 如果指定 fetchFirst，先并行 fetch 所有已配置远程以更新跟踪分支
    if (opts?.fetchFirst) {
      await this.fetchAllForProject(id)
    }

    // 由 PLATFORM_META 驱动检查
    const remotesToCheck = getProjectRemoteNames(project).map((r) => ({ key: r.key, remoteName: r.name }))

    // 缓存 noUpstream 场景的 HEAD 提交数（Promise），多远程并发复用，避免重复 rev-list --count HEAD
    let headCommitCountPromise: Promise<number> | null = null

    const remoteChecks = remotesToCheck.map(async ({ key, remoteName }) => {
      try {
        // 直接 rev-list --left-right --count，失败则远程分支不存在（noUpstream）
        const counts = await this.executor.execGit(cwd, [
          "rev-list", "--left-right", "--count",
          `${remoteName}/${status.branch}...HEAD`,
        ])
        const parts = counts.split("\t")
        const behind = Number.parseInt(parts[0] || "0", 10)
        const ahead = Number.parseInt(parts[1] || "0", 10)

        return { key, result: { ahead, behind, noUpstream: false }, ahead }
      } catch (e: unknown) {
        const errMsg = getErrorMessage(e) || String(e)
        // 真正的"远程分支不存在"（fatal: ambiguous argument 或 no such branch）→ noUpstream
        const isNoUpstream = /no upstream|no such branch|ambiguous argument|does not have any commits|doesn't have any commits/i.test(errMsg)
        if (!isNoUpstream) {
          return { key, result: { ahead: 0, behind: 0, noUpstream: false, error: errMsg }, ahead: 0 }
        }
        // 首次计算并缓存 HEAD 提交数 Promise，后续 noUpstream 远程直接复用
        if (headCommitCountPromise === null) {
          headCommitCountPromise = this.executor.execGit(cwd, ["rev-list", "--count", "HEAD"]).then(
            (t) => Number.parseInt(t, 10) || 0,
            () => 0,
          )
        }
        const count = await headCommitCountPromise
        return { key, result: { ahead: count, behind: 0, noUpstream: true }, ahead: count }
      }
    })

    const results = await Promise.all(remoteChecks)
    for (const { key, result, ahead } of results) {
      status.remotes[key] = result
      if (ahead > 0) status.needsPush = true
    }

    // 缓存用于智能跳过
    this.pushStatusCache[id] = status
    return status
  }

  async checkCanPushToCloud(id: string): Promise<{
    canPush: boolean
    github: boolean
    gitee: boolean
    gitea: boolean
    cnb: boolean
    remotes: GitRemoteInfo[]
  }> {
    const project = await this.store.getProjectById(id)
    if (!project) {
      return { canPush: false, github: false, gitee: false, gitea: false, cnb: false, remotes: [] }
    }

    const remotes = await this.store.detectRemotes(resolveValidPath(project))
    const github = remotes.some((r) => this.isKnownRemote(r, "github"))
    const gitee = remotes.some((r) => this.isKnownRemote(r, "gitee"))
    const gitea = remotes.some((r) => this.isKnownRemote(r, "gitea"))
    const cnb = remotes.some((r) => this.isKnownRemote(r, "cnb"))
    return { canPush: github || gitee || gitea || cnb, github, gitee, gitea, cnb, remotes }
  }
}
