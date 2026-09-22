// gitPush git 命令输出文本解析（纯函数）：工作区状态 / 提交日志 / 提交文件 / stash / 分支
import type {
  BranchInfo,
  CommitLogEntry,
  CommitStat,
  FileChange,
  FileChangeStatus,
  StashEntry,
} from "../types"

/** porcelain v1 的 unmerged 状态组合（两位状态码均为冲突标记，须整体判定而非逐位解读） */
const UNMERGED_CODES = new Set(["DD", "AU", "UD", "UA", "DU", "AA", "UU"])

/** 单字符状态码 → 变更类型（状态归属按「先暂存位 X、后工作区位 Y」回退取值的查表源） */
const STATUS_BY_CHAR: Record<string, FileChangeStatus> = {
  M: "modified",
  A: "added",
  D: "deleted",
  R: "renamed",
  C: "copied",
  U: "unmerged",
}

/** 工作区变更解析结果（文件列表 + 三类计数，与 WorkingTreeInfo 对应字段同形） */
export interface WorktreeStatusParse {
  files: FileChange[]
  stagedCount: number
  unstagedCount: number
  untrackedCount: number
}

/**
 * 解析 `git status --porcelain`（v1）输出。
 * 基于 core.quotepath=false + 文本解析；路径含换行等极端字符仍有局限，未用 -z 是权衡。
 * git porcelain 仅对含特殊字符的路径加引号（core.quotepath=false 下非 ASCII 不加），去引号按 -> 拆分后分别处理。
 */
export function parseWorktreeStatus(raw: string): WorktreeStatusParse {
  let stagedCount = 0
  let unstagedCount = 0
  let untrackedCount = 0
  const files: FileChange[] = []

  const unquote = (s: string): string => {
    const t = s.trim()
    return t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t
  }

  for (const line of raw.split("\n").filter(Boolean)) {
    const statusCode = line.substring(0, 2)
    const rawPath = line.substring(2).trim()
    if (!rawPath) continue

    // porcelain v1 两位状态码：X = 暂存区相对 HEAD，Y = 工作区相对暂存区（?? 表示未跟踪）
    const x = statusCode.charAt(0)
    const y = statusCode.charAt(1) || " "
    const staged = x !== " " && x !== "?"
    const unstaged = y !== " " && y !== "?"

    let status: FileChange["status"] = "modified"

    // 状态归属按 X 位优先、Y 位回退判定：AM（新增已暂存 + 工作区又改动）应为「新增」而非「已修改」，
    // RM 应为「重命名」（旧逻辑 xy.includes("M") 会把这两类都吞成「已修改」并连带跳过重命名路径拆分）
    if (x === "?" && y === "?") { status = "untracked"; untrackedCount++ }
    else if (UNMERGED_CODES.has(`${x}${y}`)) { status = "unmerged" }
    else { status = STATUS_BY_CHAR[x] || STATUS_BY_CHAR[y] || "modified" }

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

    files.push({ path: actualPath, status, staged, oldPath, unstaged })
  }

  return {
    files,
    stagedCount,
    unstagedCount,
    untrackedCount,
  }
}

/** 解析 `git stash list` 输出（`stash@{n}: message`），无法识别的行忽略 */
export function parseStashList(raw: string): StashEntry[] {
  const entries: StashEntry[] = []
  for (const line of raw.split("\n").filter(Boolean)) {
    const match = line.match(/^stash@\{(\d+)\}:\s*(.+)$/)
    if (match) {
      entries.push({ index: Number.parseInt(match[1], 10), message: match[2] })
    }
  }
  return entries
}

/**
 * 解析 `git log --format=%h%n%s%n%an%n%ar%n%aI%n%p`（固定 6 行一条）输出。
 * 依赖 %s(subject) 单行，勿加入 %b(body) 等多行字段，否则固定切分错位；
 * %p（父 hash 列表）用于识别 merge 提交（父数 > 1）。
 */
export function parseCommitLog(raw: string): CommitLogEntry[] {
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
}

/**
 * 解析 `git log --shortstat --format=%x01%h` 输出为「短 hash → 变更规模」映射。
 *
 * 用 0x01（%x01）作记录分隔而非换行：shortstat 是**可选行**（merge 提交与空改动提交没有该行），
 * 固定行数切分必然错位；0x01 是 git format 明确支持的不可打印分隔符，且不会出现在 hash 中。
 *
 * 三种记录形态：
 *   - 仅一行 hash（merge 提交 / 无文件变更）→ 不产出条目，UI 不展示悬停提示
 *   - " N files changed, X insertions(+), Y deletions(-)"  → 完整统计
 *   - " N files changed, X insertions(+)" / " N files changed, Y deletions(-)" → 缺项按 0
 *
 * 单复数与缺项都用独立的 /\d+/ 提取，不依赖 "insertions" 的复数拼写（git 在 1 时输出 "insertion"）。
 */
export function parseCommitShortStats(raw: string): Map<string, CommitStat> {
  const stats = new Map<string, CommitStat>()
  if (!raw) return stats
  for (const record of raw.split("\x01")) {
    const trimmed = record.trim()
    if (!trimmed) continue
    // 首行是 hash，其余行是（至多一行的）shortstat
    const [firstLine, ...rest] = trimmed.split("\n")
    const hash = firstLine.trim()
    if (!hash) continue
    const statLine = rest.map((l) => l.trim()).find((l) => l.includes("changed"))
    // merge / 空改动提交：无 shortstat 行 ⇒ 不登记（UI 据此跳过提示）
    if (!statLine) continue
    const files = /(\d+)\s+files?\s+changed/.exec(statLine)
    const insertions = /(\d+)\s+insertions?\(\+\)/.exec(statLine)
    const deletions = /(\d+)\s+deletions?\(-\)/.exec(statLine)
    stats.set(hash, {
      files: files ? Number.parseInt(files[1], 10) : 0,
      insertions: insertions ? Number.parseInt(insertions[1], 10) : 0,
      deletions: deletions ? Number.parseInt(deletions[1], 10) : 0,
    })
  }
  return stats
}

/** 解析 `git show --name-status --format=` 输出为文件变更列表（merge/无文件提交的空输入返回空数组） */
export function parseCommitFiles(raw: string): FileChange[] {
  const files: FileChange[] = []
  for (const line of raw.split("\n")) {
    const parts = line.split("\t")
    if (parts.length < 2) continue
    // 状态首字母映射；R/C 行带相似度数字（如 "R100"），路径按 tab 切分（rename 为 旧名\t新名）
    let status: FileChangeStatus
    switch ((parts[0] || "").charAt(0).toUpperCase()) {
      case "A": status = "added"; break
      case "D": status = "deleted"; break
      case "R": status = "renamed"; break
      case "C": status = "copied"; break
      case "U": status = "unmerged"; break
      default: status = "modified"; break
    }
    const oldPath = (status === "renamed" || status === "copied") && parts.length > 2 ? parts[1] : undefined
    files.push({
      path: parts[parts.length - 1],
      status,
      staged: false,
      oldPath,
    })
  }
  return files
}

/** 解析 `git branch --format=%(refname:short)%00%(HEAD)` 输出为本地分支列表（NUL 分隔名与当前标记） */
export function parseBranches(raw: string): BranchInfo[] {
  return raw.split("\n").filter(Boolean).map((line) => {
    const [name, head] = line.split("\0")
    return { name, current: head === "*" }
  })
}
