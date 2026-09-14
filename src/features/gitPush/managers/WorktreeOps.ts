// 工作区本地操作：状态/差异/暂存/提交/stash/分支/提交日志
import type {
  BranchInfo,
  CommitLogEntry,
  FileChange,
  StashEntry,
  WorkingTreeInfo,
} from "../types/storage"
import { getNodeFsPathOs } from "@/utils/nodeModules"
import {
  buildDiffContext,
  parseBranches,
  parseCommitFiles,
  parseCommitLog,
  parseStashList,
  parseWorktreeStatus,
} from "../utils"
import type { GitExecutor } from "./GitExecutor"
import { HistoryRewriter } from "./HistoryRewriter"

export class WorktreeOps {
  private executor: GitExecutor
  /** 提交历史 DAG 重建器（消息改写 / 提交删除共享骨架） */
  private historyRewriter: HistoryRewriter

  constructor(executor: GitExecutor) {
    this.executor = executor
    this.historyRewriter = new HistoryRewriter(executor)
  }

  /**
   * 获取工作区变更状态
   */
  async getWorkingTreeStatus(projectPath: string, opts?: { branch?: string }): Promise<WorkingTreeInfo> {
    const empty: WorkingTreeInfo = {
      branch: "",
      files: [],
      stagedCount: 0,
      unstagedCount: 0,
      untrackedCount: 0,
      hasChanges: false,
    }

    let branch = ""
    try {
      branch = opts?.branch ?? await this.executor.execGit(projectPath, ["rev-parse", "--abbrev-ref", "HEAD"])
    } catch {
      return empty
    }

    try {
      // git status 内部自带 index stat 刷新（无 --no-optional-locks 时会回写 index），
      // 无需先跑 update-index --refresh——那等于对工作区做两次全量扫描
      const raw = await this.executor.execGit(projectPath, ["-c", "core.quotepath=false", "status", "--porcelain"])
      if (!raw) { return { ...empty, branch } }

      // porcelain v1 文本解析（状态归属 / 未跟踪计数 / 重命名路径拆分）见 utils/gitOutput.parseWorktreeStatus
      const { files, stagedCount, unstagedCount, untrackedCount } = parseWorktreeStatus(raw)
      return {
        branch,
        files,
        stagedCount,
        unstagedCount,
        untrackedCount,
        hasChanges: files.length > 0,
      }
    } catch {
      // 解析失败按「无变更」呈现（分支名已取到则保留）
      return { ...empty, branch }
    }
  }

  /**
   * 获取文件差异（失败返回空串，不产出面向用户的文案——空态/加载态由视图层经 i18n 呈现）。
   * 常规 `git diff` 对未跟踪文件恒为空（该文件不在 index 中），此时若文件也不在 HEAD 中，
   * 回退 `git diff --no-index -- /dev/null <file>` 展示完整的新增内容（有差异时退出码为 1，需白名单容忍）。
   */
  async getFileDiff(projectPath: string, file: string, staged = false): Promise<string> {
    try {
      const args = ["-c", "core.quotepath=false", "diff", "--text"]
      if (staged) args.push("--cached")
      args.push("--", file)
      const text = await this.executor.execGit(projectPath, args)
      if (text) return text
      // 空差异按比较基线判定是否兜底：工作区范围比 index、暂存范围比 HEAD——
      // 文件在基线中而 diff 为空 = 真无差异；不在基线中（未跟踪 / git rm --cached / 新增未提交）则回退 --no-index
      const inBaseline = staged
        ? await this.isFileInHead(projectPath, file)
        : await this.isFileInIndex(projectPath, file)
      if (inBaseline) return ""
      return await this.executor.execGit(
        projectPath,
        ["-c", "core.quotepath=false", "diff", "--no-index", "--text", "--", "/dev/null", file],
        undefined,
        undefined,
        undefined,
        { allowExitCodes: [1] },
      )
    } catch {
      return ""
    }
  }

  /** 文件是否已存在于 HEAD（无提交 / 命令失败按 false 处理，使新仓库提交前的新增文件同样可见内容） */
  private async isFileInHead(projectPath: string, file: string): Promise<boolean> {
    try {
      const raw = await this.executor.execGit(projectPath, ["ls-tree", "HEAD", "--", file])
      return !!raw.trim()
    } catch {
      return false
    }
  }

  /** 文件是否已存在于 index（`git rm --cached` 后移出 index 但仍在 HEAD，命令失败按 false 处理） */
  private async isFileInIndex(projectPath: string, file: string): Promise<boolean> {
    try {
      // --error-unmatch：路径不命中 index 时退出码非 0，由 execGit reject 后按 false 处理
      await this.executor.execGit(projectPath, ["ls-files", "--error-unmatch", "--", file])
      return true
    } catch {
      return false
    }
  }

  async stageFile(projectPath: string, file: string): Promise<void> {
    await this.executor.execGit(projectPath, ["add", "--", file])
  }

  async stageAll(projectPath: string): Promise<void> {
    await this.executor.execGit(projectPath, ["add", "-A"])
  }

  async unstageFile(projectPath: string, file: string): Promise<void> {
    await this.executor.execGit(projectPath, ["reset", "HEAD", "--", file])
  }

  async unstageAll(projectPath: string): Promise<void> {
    await this.executor.execGit(projectPath, ["reset", "HEAD"])
  }

  async discardFile(projectPath: string, file: string, staged: boolean, status: string): Promise<void> {
    if (staged) {
      // 破坏性操作失败必须向上抛（由调用方呈现），不得静默吞错——否则用户以为已丢弃实际未丢弃。
      // 新增类（A/AM/AD）不在 HEAD 中：reset 退出 index 后文件变未跟踪，checkout 会报 pathspec 错误 ⇒ 走 clean 删工作区文件
      if (await this.isFileInHead(projectPath, file)) {
        await this.executor.execGit(projectPath, ["reset", "HEAD", "--", file])
        await this.executor.execGit(projectPath, ["checkout", "--", file])
      } else {
        await this.executor.execGit(projectPath, ["reset", "HEAD", "--", file])
        await this.executor.execGit(projectPath, ["clean", "-f", "--", file])
      }
    } else if (status === "untracked") {
      await this.executor.execGit(projectPath, ["clean", "-f", "--", file])
    } else {
      await this.executor.execGit(projectPath, ["checkout", "--", file])
    }
  }

  async commit(projectPath: string, message: string): Promise<string> {
    return await this.executor.execGit(projectPath, ["-c", "core.quotepath=false", "commit", "-m", message])
  }

  /**
   * 切换分支
   */
  async switchBranch(projectPath: string, branch: string): Promise<string> {
    const wtInfo = await this.getWorkingTreeStatus(projectPath)
    if (wtInfo.hasChanges) {
      throw new Error(
        `工作区有 ${wtInfo.stagedCount + wtInfo.unstagedCount + wtInfo.untrackedCount} 个未提交的变更，请先提交或暂存`,
      )
    }
    return await this.executor.execGit(projectPath, ["checkout", branch])
  }

  /** 暂存当前工作区变更 */
  async stashSave(projectPath: string, message?: string): Promise<void> {
    const args = ["stash", "push", "--include-untracked"]
    if (message) args.push("-m", message)
    await this.executor.execGit(projectPath, args)
  }

  /** 列出所有 stash 条目 */
  async stashList(projectPath: string): Promise<StashEntry[]> {
    try {
      const raw = await this.executor.execGit(projectPath, ["stash", "list"])
      if (!raw) return []
      return parseStashList(raw)
    } catch {
      return []
    }
  }

  /** 恢复最近一次 stash（pop） */
  async stashPop(projectPath: string, index = 0): Promise<void> {
    await this.executor.execGit(projectPath, ["stash", "pop", `stash@{${index}}`])
  }

  /** 应用 stash 但不删除 */
  async stashApply(projectPath: string, index = 0): Promise<void> {
    await this.executor.execGit(projectPath, ["stash", "apply", `stash@{${index}}`])
  }

  /** 删除 stash 条目 */
  async stashDrop(projectPath: string, index = 0): Promise<void> {
    await this.executor.execGit(projectPath, ["stash", "drop", `stash@{${index}}`])
  }

  /**
   * 获取当前分支最近 N 条提交记录
   */
  async getCommitLog(projectPath: string, count: number | "all" = 30): Promise<CommitLogEntry[]> {
    try {
      // 每行一条的格式串（含 %p 父 hash 列表以识别 merge）；解析见 utils/gitOutput.parseCommitLog
      const format = "%h%n%s%n%an%n%ar%n%aI%n%p"
      // "all" 加 -n 5000 保护上限：全量输出在大仓库可能超 10MB maxBuffer 直接 reject
      const args = count === "all"
        ? ["log", "-n", "5000", `--format=${format}`]
        : ["log", `-${count}`, `--format=${format}`]
      const raw = await this.executor.execGit(projectPath, args)
      if (!raw) return []
      return parseCommitLog(raw)
    } catch {
      return []
    }
  }

  /**
   * 获取本地分支列表
   */
  async getBranches(projectPath: string): Promise<BranchInfo[]> {
    try {
      const raw = await this.executor.execGit(projectPath, ["branch", "--format=%(refname:short)%00%(HEAD)"])
      if (!raw) return []
      return parseBranches(raw)
    } catch {
      return []
    }
  }

  async getBranch(projectPath: string): Promise<string> {
    try {
      return await this.executor.execGit(projectPath, ["rev-parse", "--abbrev-ref", "HEAD"])
    } catch {
      return ""
    }
  }

  /** 列出全部远程跟踪分支短名（如 origin/main），供一致性比对（本地读取，失败返回 []） */
  async getRemoteTrackingRefs(projectPath: string): Promise<string[]> {
    try {
      const raw = await this.executor.execGit(projectPath, [
        "for-each-ref", "refs/remotes", "--format=%(refname:short)",
      ])
      // 排除 origin/HEAD 之类的符号 ref（其 short 名为 origin -> origin/HEAD 形式或直接以 /HEAD 结尾）
      return raw.split("\n").map((l) => l.trim()).filter((l) => l && !l.endsWith("/HEAD"))
    } catch {
      return []
    }
  }

  /**
   * 计算 localBranch 相对 remoteRef 的领先/落后提交数
   * rev-list --left-right --count remoteRef...localBranch：左侧(remote)独有计入 behind，右侧(local)独有计入 ahead
   * 调换 ... 两侧会静默反转 ahead/behind，切勿改动顺序
   */
  async countAheadBehind(projectPath: string, remoteRef: string, localBranch: string): Promise<{ ahead: number, behind: number }> {
    const counts = await this.executor.execGit(projectPath, [
      "rev-list", "--left-right", "--count", `${remoteRef}...${localBranch}`,
    ])
    const parts = counts.split("\t")
    return {
      behind: Number.parseInt(parts[0] || "0", 10) || 0,
      ahead: Number.parseInt(parts[1] || "0", 10) || 0,
    }
  }

  async getHeadHash(projectPath: string): Promise<string> {
    try {
      return (await this.executor.execGit(projectPath, ["rev-parse", "HEAD"])).trim()
    } catch {
      return ""
    }
  }

  async checkIsGitRepo(projectPath: string): Promise<boolean> {
    try {
      await this.executor.execGit(projectPath, ["rev-parse", "--is-inside-work-tree"])
      return true
    } catch {
      return false
    }
  }

  /**
   * 获取某次提交的完整 diff 补丁（供 AI 修正/深度分析理解实际改动），失败返回空串。
   * 提交信息头原样保留不占预算；diff 部分按文件分块分配 budget（与暂存区生成的 diffContextBudget 同一配置），
   * 替代旧的 substring(0, 10000) 整体硬截断——单提交多文件时首个大文件会挤占其余文件的可见性。
   */
  async getCommitDeepContext(projectPath: string, hash: string, budget = 10000): Promise<string> {
    try {
      const text = await this.executor.execGit(projectPath, [
        "-c", "core.quotepath=false", "show", "--text", "--format=%B", hash,
      ]) || ""
      // 行首锚定匹配 diff 起点，防提交消息体恰好包含 "diff --git " 字符串时误判为 diff 开头
      const diffStart = /^diff --git /m.exec(text)?.index ?? -1
      if (diffStart < 0) { return text.substring(0, 10000) }
      return text.substring(0, diffStart) + buildDiffContext(text.substring(diffStart), budget)
    } catch {
      return ""
    }
  }

  /** 获取某次提交的完整原始提交信息（%B 含多行 body；提交日志的 %s 会把多行折叠成单行导致格式丢失），失败返回空串 */
  async getCommitFullMessage(projectPath: string, hash: string): Promise<string> {
    try {
      const raw = await this.executor.execGit(projectPath, [
        "-c", "core.quotepath=false", "show", "-s", "--format=%B", hash,
      ])
      return (raw || "").trim()
    } catch {
      return ""
    }
  }

  /** 解析某次提交涉及的文件变更列表（git show --name-status；merge/无文件提交返回空数组，UI 据 isMerge 提示） */
  async getCommitFiles(projectPath: string, hash: string): Promise<FileChange[]> {
    try {
      const raw = await this.executor.execGit(projectPath, [
        "-c", "core.quotepath=false", "show", "--name-status", "--format=", hash,
      ])
      if (!raw) return []
      return parseCommitFiles(raw)
    } catch {
      return []
    }
  }

  /** 获取某次提交对指定文件的补丁（git show --format= <hash> -- <path>），无内容/失败返回空串 */
  async getCommitFilePatch(projectPath: string, hash: string, filePath: string): Promise<string> {
    try {
      return await this.executor.execGit(projectPath, [
        "-c", "core.quotepath=false", "show", "--format=", hash, "--", filePath,
      ])
    } catch {
      return ""
    }
  }

  /** 修改当前 HEAD 提交信息（仅允许最近一次提交，调用方负责前置校验） */
  async amendCommitMessage(projectPath: string, message: string): Promise<string> {
    return await this.executor.execGit(projectPath, [
      "-c", "core.quotepath=false", "commit", "--amend", "-m", message,
    ])
  }

  /** 仓库是否处于 rebase 中断状态（rebase-merge/rebase-apply 目录存在，如上次重写失败的残留） */
  async isInRebaseState(projectPath: string): Promise<boolean> {
    const node = getNodeFsPathOs()
    if (!node) return false
    const { fs, path } = node
    try {
      // --git-path 无论目录是否存在都返回相对 projectPath 的路径，需 existsSync 判定
      const [mergeDir, applyDir] = await Promise.all([
        this.executor.execGit(projectPath, ["rev-parse", "--git-path", "rebase-merge"]),
        this.executor.execGit(projectPath, ["rev-parse", "--git-path", "rebase-apply"]),
      ])
      return [mergeDir, applyDir].some((d) => !!d.trim() && fs.existsSync(path.resolve(projectPath, d.trim())))
    } catch {
      return false
    }
  }

  /** 是否 merge 提交（存在第二父；批量修正弹窗据此标记不可修正项），无法解析时按非 merge 处理 */
  async isMergeCommit(projectPath: string, hash: string): Promise<boolean> {
    const fullHash = (await this.executor.execGit(projectPath, ["rev-parse", `${hash}^{commit}`]).catch(() => "")).trim()
    if (!fullHash) return false
    const secondParent = (await this.executor.execGit(projectPath, ["rev-parse", "--verify", `${fullHash}^2`]).catch(() => "")).trim()
    return !!secondParent
  }

  /**
   * 重写指定提交信息（个人项目安全版）：
   * - 目标是 HEAD 时直接 amend；
   * - 历史提交用 fast-import 单进程流式重建提交图（纯消息改写：树与父子结构原样保留），
   *   不走 rebase——线性 rebase 会拍平下游 merge 的侧链导致必现冲突，且重放触碰
   *   工作区文件（可能被 IDE/资源管理器占用）；fast-import 全程只建对象不碰工作区，
   *   失败时引用未被更新，仓库保持原状。
   */
  async rewriteCommitMessage(
    projectPath: string,
    hash: string,
    message: string,
    preserveDate = false,
    onProgress?: (current: number, total: number) => void,
  ): Promise<string> {
    // 前置检测：仓库处于 rebase 中断状态（如用户终端操作残留）时直接报错，避免在其上叠加改写
    if (await this.isInRebaseState(projectPath)) {
      throw new Error("仓库处于 rebase 中断状态（可能由上次操作失败残留），请先在终端执行 git rebase --abort 恢复后重试")
    }

    // 解析完整 hash，避免短 hash 在后续定位中匹配错误
    const fullHash = (await this.executor.execGit(projectPath, ["rev-parse", `${hash}^{commit}`])).trim()
    if (!fullHash) throw new Error("找不到指定提交")

    // merge 提交直接拒绝：其消息由 git 自动生成（非用户书写），修正无意义
    const secondParent = (await this.executor.execGit(projectPath, ["rev-parse", "--verify", `${fullHash}^2`]).catch(() => "")).trim()
    if (secondParent) {
      throw new Error("该提交是 merge 提交，不支持修正：merge 消息由 git 自动生成")
    }

    const headHash = (await this.getHeadHash(projectPath)).trim()
    // HEAD 直接走 amend，无后代需重建
    if (headHash === fullHash) {
      if (preserveDate) {
        // 保留原提交的 committer date，避免 GitHub 显示为当前时间
        const originalDate = (await this.executor.execGit(projectPath, ["log", "-1", "--format=%cI", fullHash])).trim()
        if (originalDate) {
          return await this.executor.execGit(
            projectPath,
            ["-c", "core.quotepath=false", "commit", "--amend", "-m", message],
            undefined,
            30000,
            undefined,
            { env: { GIT_COMMITTER_DATE: originalDate } },
          )
        }
      }
      return await this.amendCommitMessage(projectPath, message)
    }

    return await this.historyRewriter.rewriteMessage(projectPath, fullHash, headHash, message, preserveDate, onProgress)
  }

  /**
   * 删除指定历史提交（记录级删除、内容不变语义，个人项目安全版）：
   * 目标提交从历史跳过，其变更并入下一提交（后代以原树重建、父指针重指向目标的父），
   * 最终 HEAD 的 tree 与删除前完全一致；后代 hash 必然重写，已推送需 --force-with-lease 强推。
   * 走 fast-import 图重建（同 rewriteCommitMessage，不碰工作区，失败时引用未更新仓库保持原状）。
   */
  async dropCommit(
    projectPath: string,
    hash: string,
    onProgress?: (current: number, total: number) => void,
  ): Promise<string> {
    // 前置检测：仓库处于 rebase 中断状态（如用户终端操作残留）时直接报错，避免在其上叠加改写
    if (await this.isInRebaseState(projectPath)) {
      throw new Error("仓库处于 rebase 中断状态（可能由上次操作失败残留），请先在终端执行 git rebase --abort 恢复后重试")
    }

    // 解析完整 hash，避免短 hash 在后续定位中匹配错误
    const fullHash = (await this.executor.execGit(projectPath, ["rev-parse", `${hash}^{commit}`])).trim()
    if (!fullHash) throw new Error("找不到指定提交")

    const headHash = (await this.getHeadHash(projectPath)).trim()
    // HEAD 拒绝：删 HEAD = reset 语义（记录与内容一并丢失），与"内容不变"语义相悖
    if (headHash === fullHash) {
      throw new Error("不支持删除最新提交（HEAD）：该操作会同时丢失其内容变更，请使用丢弃变更或重置功能")
    }
    // merge 拒绝：多父提交被跳过后，子提交的父指向存在歧义（该接第一父还是合并两侧？）
    if (await this.isMergeCommit(projectPath, fullHash)) {
      throw new Error("该提交是 merge 提交，不支持删除：跳过后子提交的父指向存在歧义")
    }
    // 祖先校验：目标不在 HEAD 历史上时重建范围抓不到它的后代，操作会静默无效，必须显式报错
    if (!(await this.isAncestorOfHead(projectPath, fullHash))) {
      throw new Error("该提交不在当前分支的历史上（可能在其他分支），无法从当前分支删除")
    }

    return await this.historyRewriter.drop(projectPath, fullHash, headHash, onProgress)
  }

  /** 目标提交是否为当前 HEAD 的祖先（hash 支持短/完整；merge-base --is-ancestor 退出码判定；解析失败按否处理） */
  async isAncestorOfHead(projectPath: string, hash: string): Promise<boolean> {
    try {
      const fullHash = (await this.executor.execGit(projectPath, ["rev-parse", `${hash}^{commit}`])).trim()
      if (!fullHash) return false
      const headHash = await this.getHeadHash(projectPath)
      await this.executor.execGit(projectPath, ["merge-base", "--is-ancestor", fullHash, headHash])
      return true
    } catch {
      return false
    }
  }
}
