// 工作区本地操作：状态/差异/暂存/提交/stash/分支/提交日志
import type {
  BranchInfo,
  CommitLogEntry,
  FileChange,
  StashEntry,
  WorkingTreeInfo,
} from "../types/storage"
import { getNodeFsPathOs } from "@/utils/nodeModules"
import type { GitExecutor } from "./GitExecutor"

export class WorktreeOps {
  private executor: GitExecutor

  constructor(executor: GitExecutor) {
    this.executor = executor
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
    let stagedCount = 0
    let unstagedCount = 0
    let untrackedCount = 0
    const files: FileChange[] = []

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

      // 基于 core.quotepath=false + 文本解析 porcelain v1；路径含换行等极端字符仍有局限，未用 -z 是权衡
      // git porcelain 仅对含特殊字符的路径加引号（core.quotepath=false 下非 ASCII 不加），去引号需按 -> 拆分后分别处理
      const unquote = (s: string): string => {
        const t = s.trim()
        return t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t
      }
      const lines = raw.split("\n").filter(Boolean)
      for (const line of lines) {
        const statusCode = line.substring(0, 2)
        const rawPath = line.substring(2).trim()
        if (!rawPath) continue

        const xy = statusCode.trim()
        const staged = statusCode[0] !== " " && statusCode[0] !== "?"
        const unstaged = statusCode[1] !== " "

        let status: FileChange["status"] = "modified"

        if (xy === "??") { status = "untracked"; untrackedCount++ }
        else if (xy.includes("M")) { status = "modified" }
        else if (xy.includes("A")) { status = "added" }
        else if (xy.includes("D")) { status = "deleted" }
        else if (xy.includes("R")) { status = "renamed" }
        else if (xy.includes("C")) { status = "copied" }
        else if (xy.includes("U")) { status = "unmerged" }

        // unmerged（如 UU）状态码两位都非空格，避免同一冲突文件重复计入两个计数（冲突由 ConflictSection 单独呈现）
        if (staged && status !== "untracked" && status !== "unmerged") stagedCount++
        if (unstaged && status !== "untracked" && status !== "unmerged") unstagedCount++

        let actualPath: string
        let oldPath: string | undefined
        if (status === "renamed" && rawPath.includes(" -> ")) {
          const arrowIdx = rawPath.indexOf(" -> ")
          oldPath = unquote(rawPath.substring(0, arrowIdx))
          actualPath = unquote(rawPath.substring(arrowIdx + 4))
        } else {
          actualPath = unquote(rawPath)
        }

        files.push({ path: actualPath, status, staged, oldPath })
      }
    } catch {
      // 忽略
    }

    return {
      branch,
      files,
      stagedCount,
      unstagedCount,
      untrackedCount,
      hasChanges: files.length > 0,
    }
  }

  /**
   * 获取文件差异
   */
  async getFileDiff(projectPath: string, file: string, staged = false): Promise<string> {
    try {
      const args = ["-c", "core.quotepath=false", "diff", "--text"]
      if (staged) args.push("--cached")
      args.push("--", file)
      return await this.executor.execGit(projectPath, args) || "（无差异）"
    } catch {
      return "（无法获取差异）"
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
      // 破坏性操作失败必须向上抛（由调用方呈现），不得静默吞错——否则用户以为已丢弃实际未丢弃
      await this.executor.execGit(projectPath, ["reset", "HEAD", "--", file])
      await this.executor.execGit(projectPath, ["checkout", "--", file])
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
      const entries: StashEntry[] = []
      const lines = raw.split("\n").filter(Boolean)
      for (const line of lines) {
        const match = line.match(/^stash@\{(\d+)\}:\s*(.+)$/)
        if (match) {
          entries.push({ index: Number.parseInt(match[1], 10), message: match[2] })
        }
      }
      return entries
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
      // 依赖 %s(subject) 单行，勿加入 %b(body) 等多行字段，否则固定切分错位
      // %p（父 hash 列表）用于识别 merge 提交（父数 > 1）
      const format = "%h%n%s%n%an%n%ar%n%aI%n%p"
      // "all" 加 -n 5000 保护上限：全量输出在大仓库可能超 10MB maxBuffer 直接 reject
      const args = count === "all"
        ? ["log", "-n", "5000", `--format=${format}`]
        : ["log", `-${count}`, `--format=${format}`]
      const raw = await this.executor.execGit(projectPath, args)
      if (!raw) return []

      const allLines = raw.split("\n")
      const entries: CommitLogEntry[] = []
      for (let i = 0; i + 5 < allLines.length; i += 6) {
        entries.push({
          hash: allLines[i],
          message: allLines[i + 1],
          author: allLines[i + 2],
          relativeDate: allLines[i + 3],
          date: allLines[i + 4],
          isMerge: allLines[i + 5].trim().split(/\s+/).filter(Boolean).length > 1,
        })
      }
      return entries
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
      return raw.split("\n").filter(Boolean).map((line) => {
        const [name, head] = line.split("\0")
        return { name, current: head === "*" }
      })
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

  /** 获取某次提交的变更摘要（供 AI 修正提交信息时理解改动内容），失败返回空串 */
  async getCommitFixContext(projectPath: string, hash: string): Promise<string> {
    try {
      const raw = await this.executor.execGit(projectPath, [
        "-c", "core.quotepath=false", "show", "--stat", "--format=%B", hash,
      ])
      return (raw || "").substring(0, 3000)
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

  /**
   * 重写指定提交信息（个人项目安全版）：
   * - 目标是 HEAD 时直接 amend；
   * - 历史提交用 commit-tree 逐条重建提交图（纯消息改写：树与父子结构原样保留），
   *   不走 rebase——线性 rebase 会拍平下游 merge 的侧链导致必现冲突，且重放触碰
   *   工作区文件（可能被 IDE/资源管理器占用）；commit-tree 全程只建对象不碰工作区，
   *   失败时引用未被更新，仓库保持原状。
   */
  async rewriteCommitMessage(projectPath: string, hash: string, message: string, preserveDate = false): Promise<string> {
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

    return await this.rebuildHistoryWithNewMessage(projectPath, fullHash, headHash, message, preserveDate)
  }

  /**
   * commit-tree 图重建（历史提交改写核心）：
   * 按拓扑序（父先子后）遍历目标提交到 HEAD，依赖目标的后代逐条用 commit-tree 以
   * 原树/原父子结构重建（仅消息或父指针变化），侧链等无关提交保持原 hash；
   * 最后以 CAS（旧值校验）更新分支引用。全程不触碰工作区与暂存区。
   */
  private async rebuildHistoryWithNewMessage(projectPath: string, fullHash: string, headHash: string, message: string, preserveDate: boolean): Promise<string> {
    const node = getNodeFsPathOs()
    if (!node) throw new Error("Node 环境不可用")
    const { fs, os, path } = node

    // 字段：hash/tree/parents/作者三件套/提交者三件套/完整消息；\x1e 分记录
    const FMT = "%H%x00%T%x00%P%x00%an%x00%ae%x00%aI%x00%cn%x00%ce%x00%cI%x00%B%x1e"
    // 按 \x1e 单字符分割：execGit 会剥离输出末尾换行，若按 "\x1e\n" 复合分割，
    // 最后一条记录的分隔符会残缺导致 \x1e 字节泄漏进消息字段
    const parseLog = (raw: string) => raw.split("\x1e")
      .map((r, i) => (i > 0 && r.startsWith("\n") ? r.slice(1) : r))
      .filter((r) => r.trim() !== "")
      .map((record) => {
        const f = record.split("\x00")
        return {
          hash: f[0],
          tree: f[1],
          parents: f[2] ? f[2].split(" ").filter(Boolean) : [],
          an: f[3],
          ae: f[4],
          aI: f[5],
          cn: f[6],
          ce: f[7],
          cI: f[8],
          message: f[9] ?? "",
        }
      })

    const [tgtRaw, restRaw] = await Promise.all([
      this.executor.execGit(projectPath, ["log", "-1", `--format=${FMT}`, fullHash]),
      // topological + reverse = 父先子后；范围含并入的侧链提交（不依赖目标者保持原 hash）
      this.executor.execGit(projectPath, ["log", "--topo-order", "--reverse", `--format=${FMT}`, `${fullHash}..HEAD`]),
    ])
    const target = parseLog(tgtRaw)[0]
    if (!target) throw new Error("找不到指定提交")
    const rest = parseLog(restRaw)

    const branch = (await this.executor.execGit(projectPath, ["rev-parse", "--abbrev-ref", "HEAD"])).trim()
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gprw-"))
    /** 旧 hash → 新 hash 映射（含 identity 映射） */
    const map = new Map<string, string>()

    /** 以原树/映射后的父指针重建一条提交；preserveDate=true 时精确保留作者与提交者三件套 */
    const rebuild = async (rec: typeof target, msg: string) => {
      const msgFile = path.join(dir, "msg.txt")
      fs.writeFileSync(msgFile, msg.endsWith("\n") ? msg : `${msg}\n`, "utf8")
      const env: Record<string, string> = {
        GIT_AUTHOR_NAME: rec.an,
        GIT_AUTHOR_EMAIL: rec.ae,
        GIT_AUTHOR_DATE: rec.aI,
      }
      if (preserveDate) {
        env.GIT_COMMITTER_NAME = rec.cn
        env.GIT_COMMITTER_EMAIL = rec.ce
        env.GIT_COMMITTER_DATE = rec.cI
      }
      const parents = rec.parents.flatMap((p) => ["-p", map.get(p) ?? p])
      const newHash = (await this.executor.execGit(projectPath, ["commit-tree", rec.tree, ...parents, "-F", msgFile], undefined, 30000, undefined, { env })).trim()
      map.set(rec.hash, newHash)
    }

    try {
      // 1. 重建目标提交（其父提交均在范围之外，保持原样）
      await rebuild(target, message)
      // 2. 按拓扑序重建依赖目标的后代；父指针未变化的（如并入侧链）保持原 hash
      for (const rec of rest) {
        const newParents = rec.parents.map((p) => map.get(p) ?? p)
        if (newParents.join(" ") === rec.parents.join(" ")) {
          map.set(rec.hash, rec.hash)
          continue
        }
        await rebuild(rec, rec.message)
      }
      // 3. CAS 更新引用：当前值与开始时不一致（期间有其他改动）则失败，避免覆盖
      const newTip = map.get(headHash)
      if (!newTip) throw new Error("重写失败：无法定位新提交链顶端")
      if (branch === "HEAD") {
        await this.executor.execGit(projectPath, ["update-ref", "--no-deref", "HEAD", newTip, headHash])
      } else {
        await this.executor.execGit(projectPath, ["update-ref", `refs/heads/${branch}`, newTip, headHash])
      }
      return newTip
    } finally {
      try { fs.rmSync(dir, { recursive: true, force: true }) } catch { /* 忽略清理失败 */ }
    }
  }
}
