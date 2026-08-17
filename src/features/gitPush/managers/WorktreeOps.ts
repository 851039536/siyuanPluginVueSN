// 工作区本地操作：状态/差异/暂存/提交/stash/分支/提交日志
import type {
  BranchInfo,
  CommitLogEntry,
  FileChange,
  StashEntry,
  WorkingTreeInfo,
} from "../types/storage"
import type { GitExecutor } from "./GitExecutor"

export class WorktreeOps {
  private executor: GitExecutor

  constructor(executor: GitExecutor) {
    this.executor = executor
  }

  /**
   * 获取工作区变更状态
   */
  async getWorkingTreeStatus(projectPath: string, opts?: { skipRefresh?: boolean, branch?: string }): Promise<WorkingTreeInfo> {
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
      if (!opts?.skipRefresh) {
        await this.executor.execGit(projectPath, ["update-index", "--refresh", "-q"]).catch(() => {})
      }
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
      await this.executor.execGit(projectPath, ["reset", "HEAD", "--", file]).catch(() => {})
      await this.executor.execGit(projectPath, ["checkout", "--", file]).catch(() => {})
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
    const wtInfo = await this.getWorkingTreeStatus(projectPath, { skipRefresh: true })
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
  async getCommitLog(projectPath: string, count = 30): Promise<CommitLogEntry[]> {
    try {
      // 依赖 %s(subject) 单行，勿加入 %b(body) 等多行字段，否则 5 行固定切分错位
      const format = "%h%n%s%n%an%n%ar%n%aI"
      const raw = await this.executor.execGit(projectPath, ["log", `-${count}`, `--format=${format}`])
      if (!raw) return []

      const allLines = raw.split("\n")
      const entries: CommitLogEntry[] = []
      for (let i = 0; i + 4 < allLines.length; i += 5) {
        entries.push({
          hash: allLines[i],
          message: allLines[i + 1],
          author: allLines[i + 2],
          relativeDate: allLines[i + 3],
          date: allLines[i + 4],
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
}
