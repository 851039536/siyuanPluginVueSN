// gitPush git 命令输出文本解析（纯函数）：工作区状态 / 提交日志 / 提交文件 / stash / 分支
// 直连 types/storage 而非 "../types" 桶（桶含 GitPushManager 运行时模块），保证本模块
// 及其测试可在 Node 环境加载。
import type {
  BranchInfo,
  CommitLogEntry,
  CommitStat,
  FileChange,
  FileChangeStatus,
  StashEntry,
} from "../types/storage"

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

    files.push({
      path: actualPath,
      status,
      staged,
      oldPath,
      unstaged,
    })
  }

  return {
    files,
    stagedCount,
    unstagedCount,
    untrackedCount,
  }
}

/** v2 工作区解析结果（在 v1 同形字段之外，附带一次 git 调用才能拿到的分支信息） */
export interface WorktreeStatusV2Parse extends WorktreeStatusParse {
  /**
   * 当前分支名。detached HEAD / 空仓库时为**空串**。
   *
   * ⚠️ v2 的 `# branch.head` 在 detached 时输出字面量 `(detached)`，而旧路径
   * `rev-parse --abbrev-ref HEAD` 返回 `HEAD` —— 两者都**不是**合法分支名。
   * 下游 `checkPushStatus` 依赖「分支名为空串 ⇒ 提前返回」来避免构造
   * `remote/HEAD...HEAD` 触发 ambiguous argument 而被误判成 noUpstream（虚假 needsPush），
   * 故此处统一归一化为空串，切勿原样透传 `(detached)`。
   */
  branch: string
}

/** v2 相对 v1 的差异：未跟踪项直接以 `?` 开头（v1 是 `?? `） */
const V2_UNTRACKED_PREFIX = "? "

/**
 * 解析 `git status --porcelain=v2 --branch` 输出（一次调用同时拿工作区状态与分支名）。
 *
 * 为什么要有 v2 版本：旧实现每个项目要发两次进程 —— `rev-parse --abbrev-ref HEAD`
 * 取分支名 + `status --porcelain` 取工作区。而 v2 的 `# branch.head` 已含分支名，
 * 合并后每项目省掉一次进程（实测本机单次 git 进程启动约 0.6~1.3s，故接近减半）。
 *
 * 格式差异（均为实测确认，勿凭直觉推断）：
 *   头部行 `# branch.oid <oid|(initial)>` / `# branch.head <name|(detached)>`
 *           / `# branch.upstream <ref>` / `# branch.ab +N -M`
 *   普通项 `1 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <path>`
 *   重命名 `2 <XY> <sub> ... <X><score> <path><TAB><origPath>`  ← **新路径在前**，与 v1 的 `old -> new` 相反
 *   冲突   `u <XY> <sub> <m1> <m2> <m3> <mW> <h1> <h2> <h3> <path>`
 *   未跟踪 `? <path>`
 *   忽略   `! <path>`
 *
 * 计数与状态归属规则与 v1 版本（parseWorktreeStatus）**逐条对齐**：AM/RM 按 X 位优先，
 * 冲突项两位都非空格但只记入 files 不计入 staged/unstaged 计数，未跟踪单独计数。
 */
export function parseWorktreeStatusV2(raw: string): WorktreeStatusV2Parse {
  let stagedCount = 0
  let unstagedCount = 0
  let untrackedCount = 0
  const files: FileChange[] = []
  let branch = ""

  for (const line of raw.split("\n")) {
    if (!line) continue

    // ── 头部行：只取分支名，其余（oid/upstream/ab）本函数不用 ──
    if (line.startsWith("# branch.head ")) {
      const name = line.slice("# branch.head ".length).trim()
      // detached 与空仓库统一归一化为空串（见 WorktreeStatusV2Parse.branch 注释）
      branch = name && name !== "(detached)" ? name : ""
      continue
    }
    // 其余头部行（# branch.oid / # branch.upstream / # branch.ab）跳过
    if (line.startsWith("# ")) continue

    // ── 未跟踪项 ──
    if (line.startsWith(V2_UNTRACKED_PREFIX)) {
      const path = line.slice(V2_UNTRACKED_PREFIX.length)
      if (!path) continue
      untrackedCount++
      files.push({
        path,
        status: "untracked",
        staged: false,
        oldPath: undefined,
        unstaged: false,
      })
      continue
    }
    // 被忽略项不在工作区变更中呈现
    if (line.startsWith("! ")) continue

    const kind = line.charAt(0)
    let statusCode: string
    let rawPath: string

    if (kind === "1") {
      // 1 XY sub mH mI mW hH hI path —— 前 7 个字段之后才是 path（path 可含空格，故按字段切）
      const parts = line.split(" ")
      if (parts.length < 9) continue
      statusCode = parts[1]
      rawPath = parts.slice(8).join(" ")
    } else if (kind === "2") {
      // 2 XY sub mH mI mW hH hI Xscore path<TAB>origPath
      // 注意：字段比 kind=1 多一个 Xscore，故 path 从第 9 个字段开始
      const parts = line.split(" ")
      if (parts.length < 10) continue
      statusCode = parts[1]
      const rest = parts.slice(9).join(" ")
      const tabIdx = rest.indexOf("\t")
      rawPath = tabIdx === -1 ? rest : rest.substring(0, tabIdx)
    } else if (kind === "u") {
      // u XY sub m1 m2 m3 mW h1 h2 h3 path —— 比 kind=1 多三个 hash
      const parts = line.split(" ")
      if (parts.length < 11) continue
      statusCode = parts[1]
      rawPath = parts.slice(10).join(" ")
    } else {
      // 未知行类型：跳过而非抛错，避免未来 git 新增行类型时整块解析失败
      continue
    }

    if (!rawPath) continue

    const x = statusCode.charAt(0)
    const y = statusCode.charAt(1) || " "
    // v2 里冲突项首字符固定为 u（kind 已判定），XY 仍可能是 UU/AA 等
    const isUnmerged = kind === "u"
    const staged = !isUnmerged && x !== "." && x !== " "
    const unstaged = !isUnmerged && y !== "." && y !== " "

    let status: FileChange["status"]
    if (isUnmerged) {
      status = "unmerged"
    } else {
      // v2 用 "." 表示「该侧无变更」，转成 v1 的空格语义后再查表
      const xChar = x === "." ? " " : x
      const yChar = y === "." ? " " : y
      status = STATUS_BY_CHAR[xChar] || STATUS_BY_CHAR[yChar] || "modified"
    }

    // 与 v1 一致：冲突项只进 files，不计 staged/unstaged（由 ConflictSection 单独呈现）
    if (staged) stagedCount++
    if (unstaged) unstagedCount++

    // 重命名/复制：v2 的 origPath 就是旧路径，直接取，无需解析 "->"
    let oldPath: string | undefined
    if (kind === "2") {
      const tabIdx = line.indexOf("\t")
      if (tabIdx !== -1) oldPath = line.substring(tabIdx + 1)
    }

    files.push({
      path: rawPath,
      status,
      staged,
      oldPath,
      unstaged,
    })
  }

  return {
    files,
    stagedCount,
    unstagedCount,
    untrackedCount,
    branch,
  }
}

/**
 * 解析 `git for-each-ref --format=%(refname:short)%00%(ahead-behind:HEAD) refs/remotes` 输出，
 * 得到「远程跟踪 ref 短名 → { ahead, behind }」映射（一次调用覆盖全部远程，取代逐远程 rev-list）。
 *
 * 字段顺序经真实分叉仓库实测确认为 **`<behind> <ahead>`**（与 `rev-list --left-right --count A...B`
 * 的左=behind、右=ahead 一致），切勿按直觉当成 ahead/behind 颠倒。
 *
 * 用 NUL（%00）分隔 refname 与计数而非空格：分支名可含空格，按空格切分会错位。
 *
 * ref 不存在（noUpstream：远程分支尚未建立）时 for-each-ref **不报错**、仅不产出该行
 * （退出码 0，空输出）——调用方按「映射中无该 ref」判定 noUpstream，
 * 比原先匹配 rev-list 的多套英文报错措辞更稳妥。
 */
export function parseAheadBehind(raw: string): Map<string, { ahead: number, behind: number }> {
  const result = new Map<string, { ahead: number, behind: number }>()
  if (!raw) return result
  for (const line of raw.split("\n")) {
    if (!line) continue
    const sep = line.indexOf("\x00")
    if (sep < 0) continue
    const refName = line.substring(0, sep).trim()
    if (!refName) continue
    // ahead-behind 输出形如 "3 2"（behind ahead）或 "0 0"
    const parts = line.substring(sep + 1).trim().split(/\s+/)
    const behind = Number.parseInt(parts[0] || "0", 10)
    const ahead = Number.parseInt(parts[1] || "0", 10)
    result.set(refName, {
      ahead: Number.isFinite(ahead) ? ahead : 0,
      behind: Number.isFinite(behind) ? behind : 0,
    })
  }
  return result
}

/** 解析 `git stash list` 输出（`stash@{n}: message`），无法识别的行忽略 */
export function parseStashList(raw: string): StashEntry[] {
  const entries: StashEntry[] = []
  for (const line of raw.split("\n").filter(Boolean)) {
    const match = line.match(/^stash@\{(\d+)\}:\s*(.+)$/)
    if (match) {
      entries.push({
        index: Number.parseInt(match[1], 10),
        message: match[2],
      })
    }
  }
  return entries
}

/**
 * 解析 `git log --format=%H%n%s%n%an%n%ar%n%aI%n%p`（固定 6 行一条）输出。
 * 依赖 %s(subject) 单行，勿加入 %b(body) 等多行字段，否则固定切分错位；
 * %p（父 hash 列表）用于识别 merge 提交（父数 > 1）。
 * hash 为 %H 完整 40 位：UI 短展示自行截取，后续 git 定位（修正/删除/打 Tag）直接用完整值。
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
 * 解析 `git log --shortstat --format=%x01%H` 输出为「完整 hash → 变更规模」映射。
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
    return {
      name,
      current: head === "*",
    }
  })
}
