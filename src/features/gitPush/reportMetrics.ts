// gitPush 代码统计报告指标引擎：numstat 解析 + 作者/文件聚合 + 债务/热点评分（纯函数，无 Vue 依赖）
//
// 评分公式说明（确定性可复现，聚焦 churn 原始指标，思路参考 code-maat）：
// - 技术债务风险分 risk = clamp(sqrt(修改次数)*10 + 参与人数*6 + 近期修改加分)，sqrt 使 churn 边际收益递减避免高分区饱和；
//   仅统计修改 ≥门槛次（默认 3，可由偏好配置）的文件（低于门槛视为正常迭代）
// - 热度 heat = 修改次数*2.2 + 参与人数*7 + 近期修改加分（recencyBonus 与债务评分共用）；阈值 热点≥75 / 温热≥45 / 冷却≥25
import type { GitProject } from "./types"
import type {
  AuthorReportRow,
  CodeReportData,
  CommitRhythmStats,
  DailyCommitStat,
  DebtFileRow,
  DebtSeverity,
  FileStatRow,
  HotspotFileRow,
  HotspotLevel,
  HourBucketStat,
  ReportRange,
  WeekdayStat,
} from "./types/report"
import { REPORT_RANGES } from "./types/report"
import { getNodeFsPathOs, getNodeProcessModules } from "@/utils/nodeModules"
import { resolveValidPath } from "./utils"

// ── 解析：git log --numstat 输出 → 结构化提交块 ──

/** 单条提交的 numstat 解析结果 */
export interface NumstatCommit {
  /** 短 hash（7 位，仅 getCommitStatsLog 新格式解析时填充，旧格式/报告数据为 undefined） */
  hash?: string
  /** 提交主题（仅 getCommitStatsLog 新格式解析时填充，旧格式/报告数据为 undefined） */
  message?: string
  /** 作者名 */
  author: string
  /** ISO 时间戳（git %aI 输出，new Date 可直接解析） */
  date: string
  /** 本次提交的文件变更 [路径, 新增行, 删除行] */
  files: Array<{ path: string, added: number, deleted: number }>
}

/** 去除 git 路径的 C 风格引号（与 WorktreeOps 同策略：仅剥首尾引号，极端字符有限支持） */
function unquotePath(s: string): string {
  const t = s.trim()
  return t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t
}

/**
 * 解析 git log --numstat 输出（header 段数自适应，兼容两种 format）。
 * 结构：每条提交 = "<RS>header 段...\n" + 若干 "新增\t删除\t路径\n" 行，提交间以空行分隔。
 * - 旧格式（getNumstatLog，报告视图）：header = "<US>作者<US>ISO日期"（2 段），解析 author/date
 * - 新格式（getCommitStatsLog，行数统计）：header = "<US>hash<US>作者<US>ISO日期<US>主题"（4 段），额外解析 hash/message
 */
export function parseNumstatBlocks(raw: string): NumstatCommit[] {
  const commits: NumstatCommit[] = []
  const chunks = raw.split("\x1e")
  for (let i = 1; i < chunks.length; i++) {
    const chunk = chunks[i]
    const lines = chunk.split("\n")
    const header = lines[0] || ""
    const parts = header.split("\x1f")
    // 4 段新格式：hash / author / date / message（subject 内含 \x1f 时用 slice(3) 保底还原）
    if (parts.length >= 4) {
      const hash = parts[0].trim()
      const author = parts[1].trim()
      const date = parts[2].trim()
      const message = parts.slice(3).join("\x1f").trim()
      if (!author || !date) continue
      const files = parseFileLines(lines)
      commits.push({ hash, author, date, message, files })
      continue
    }
    // 2 段旧格式：author / date
    if (parts.length >= 2) {
      const author = parts[0].trim()
      const date = parts[1].trim()
      if (!author || !date) continue
      const files = parseFileLines(lines)
      commits.push({ author, date, files })
      continue
    }
  }
  return commits
}

/** 解析 numstat 块内的文件变更行（"新增\t删除\t路径"，二进制文件 git 输出 "-\t-" 跳过，无效行跳过） */
function parseFileLines(lines: string[]): NumstatCommit["files"] {
  const files: NumstatCommit["files"] = []
  for (let j = 1; j < lines.length; j++) {
    const line = lines[j]
    if (!line) continue
    const parts = line.split("\t")
    if (parts.length < 3) continue
    const added = Number.parseInt(parts[0], 10)
    const deleted = Number.parseInt(parts[1], 10)
    if (Number.isNaN(added) || Number.isNaN(deleted)) continue
    files.push({ path: unquotePath(parts.slice(2).join("\t")), added, deleted })
  }
  return files
}

// ── 聚合：单次遍历产出作者统计 + 文件统计两张表 ──

/** 作者聚合中间态 */
interface AuthorAgg {
  commits: number
  added: number
  deleted: number
  files: Set<string>
  /** 文件 → 修改次数（派生 Top 修改文件） */
  fileMods: Map<string, number>
  days: Set<string>
  firstDate: number
  lastDate: number
  /** 最早提交 ISO（保留原始格式用于展示活跃时间范围） */
  firstIso: string
  /** 最近提交 ISO */
  lastIso: string
}

/** 文件聚合中间态 */
interface FileAgg {
  modCount: number
  authors: Set<string>
  lastIso: string
  /** numstat 新增行汇总 */
  added: number
  /** numstat 删除行汇总 */
  deleted: number
}

/** 解析 ISO 日期为毫秒时间戳（无法解析返回 0） */
function parseIsoMs(iso: string): number {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? 0 : t
}

/** 按活跃天数（首个~末次提交跨度，最小 1） */
function activeDaysBetween(firstMs: number, lastMs: number): number {
  if (firstMs <= 0 || lastMs <= firstMs) return 1
  return Math.max(1, Math.round((lastMs - firstMs) / (24 * 60 * 60 * 1000)))
}

/** 聚合作者统计（提交数/行数/活跃天数/文件数；返回数组按提交数降序） */
export function aggregateAuthorStats(commits: NumstatCommit[]): AuthorReportRow[] {
  const map = new Map<string, AuthorAgg>()
  for (const c of commits) {
    let a = map.get(c.author)
    if (!a) {
      a = {
        commits: 0, added: 0, deleted: 0, files: new Set(), fileMods: new Map(),
        days: new Set(), firstDate: 0, lastDate: 0, firstIso: "", lastIso: "",
      }
      map.set(c.author, a)
    }
    a.commits++
    const ms = parseIsoMs(c.date)
    if (ms > 0) {
      if (a.firstDate === 0 || ms < a.firstDate) { a.firstDate = ms; a.firstIso = c.date }
      if (ms > a.lastDate) { a.lastDate = ms; a.lastIso = c.date }
      a.days.add(c.date.slice(0, 10))
    }
    for (const f of c.files) {
      a.added += f.added
      a.deleted += f.deleted
      a.files.add(f.path)
      a.fileMods.set(f.path, (a.fileMods.get(f.path) ?? 0) + 1)
    }
  }
  const rows: AuthorReportRow[] = []
  for (const [author, a] of map) {
    const net = a.added - a.deleted
    const activeDays = activeDaysBetween(a.firstDate, a.lastDate)
    // 修改最多的文件 Top3（按修改次数降序，供展开详情展示）
    const topFiles = [...a.fileMods.entries()]
      .sort((x, y) => y[1] - x[1])
      .slice(0, 3)
      .map(([path, count]) => ({ path, count }))
    rows.push({
      author,
      commits: a.commits,
      linesAdded: a.added,
      linesDeleted: a.deleted,
      netLines: net,
      avgCommitSize: a.commits > 0 ? Math.round(a.added / a.commits) : 0,
      frequency: round2(a.commits / Math.max(1, activeDays / 7)),
      filesTouched: a.files.size,
      activeDays,
      firstCommitAt: a.firstIso,
      lastCommitAt: a.lastIso,
      // 代码流失率：删除行/新增行（无新增为 0，避免除零）
      churnRate: a.added > 0 ? round2(a.deleted / a.added) : 0,
      topFiles,
    })
  }
  return rows.sort((x, y) => y.commits - x.commits)
}

/** 聚合文件统计（修改次数/参与人数/最后修改；返回 Map 路径→聚合态） */
export function aggregateFileStats(commits: NumstatCommit[]): Map<string, FileAgg> {
  const map = new Map<string, FileAgg>()
  for (const c of commits) {
    for (const f of c.files) {
      let agg = map.get(f.path)
      if (!agg) {
        agg = { modCount: 0, authors: new Set(), lastIso: "", added: 0, deleted: 0 }
        map.set(f.path, agg)
      }
      agg.modCount++
      agg.added += f.added
      agg.deleted += f.deleted
      agg.authors.add(c.author)
      if (c.date > agg.lastIso) agg.lastIso = c.date
    }
  }
  return map
}

// ── 行数聚合：跨项目提交分析用（单项目/单作者的增删行汇总，与 aggregateAuthorStats 同源但不做文件级派生统计）──

/** 文件路径是否应纳入统计（extensions 黑名单排除语义：空数组/undefined = 不过滤，全部通过；勾选 = 排除该格式） */
export function shouldIncludeFile(filePath: string, extensions?: string[]): boolean {
  if (!extensions || extensions.length === 0) return true
  const lower = filePath.toLowerCase()
  return !extensions.some(ext => lower.endsWith(ext.toLowerCase()))
}

/** 从 NumstatCommit[] 汇总单项目总增删行数（extensions 可选黑名单排除过滤） */
export function sumProjectLines(commits: NumstatCommit[], extensions?: string[]): { added: number, deleted: number } {
  let added = 0
  let deleted = 0
  for (const c of commits) {
    for (const f of c.files) {
      if (!shouldIncludeFile(f.path, extensions)) continue
      added += f.added
      deleted += f.deleted
    }
  }
  return { added, deleted }
}

/** 从 NumstatCommit[] 汇总每人增删行数（Map<作者名, {added, deleted}>，extensions 可选黑名单排除过滤） */
export function sumAuthorLines(commits: NumstatCommit[], extensions?: string[]): Map<string, { added: number, deleted: number }> {
  const map = new Map<string, { added: number, deleted: number }>()
  for (const c of commits) {
    let agg = map.get(c.author)
    if (!agg) {
      agg = { added: 0, deleted: 0 }
      map.set(c.author, agg)
    }
    for (const f of c.files) {
      if (!shouldIncludeFile(f.path, extensions)) continue
      agg.added += f.added
      agg.deleted += f.deleted
    }
  }
  return map
}

// ── K 线图：按日期聚合每日提交统计 ──

/** 影线外扩量（小时）：实体上下各留 0.5h 形成 K 线影线视觉 */
export const WICK_PAD_HOURS = 0.5

/** 解析 ISO 时刻为一天中的小时小数（0~24），解析失败返回 -1 */
function hourOfDay(iso: string): number {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return -1
  const d = new Date(t)
  return d.getHours() + d.getMinutes() / 60
}

/**
 * 从 NumstatCommit[] 按日期聚合每日提交统计（单次 O(n) 遍历，输出按日期升序）。
 * 忽略无法解析的 ISO 时间戳条目；无有效提交时返回空数组。
 */
export function aggregateDailyStats(commits: NumstatCommit[]): DailyCommitStat[] {
  const byDate = new Map<string, { open: number, close: number, count: number }>()
  for (const c of commits) {
    const dateKey = c.date.slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue
    const h = hourOfDay(c.date)
    if (h < 0) continue
    let agg = byDate.get(dateKey)
    if (!agg) {
      agg = { open: h, close: h, count: 0 }
      byDate.set(dateKey, agg)
    }
    if (h < agg.open) agg.open = h
    if (h > agg.close) agg.close = h
    agg.count++
  }
  return [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, a]) => ({
      date,
      open: a.open,
      close: a.close,
      // 影线钳位到 [0, 24] 时刻轴范围，避免凌晨/深夜提交时影线越界被 canvas 裁剪
      high: Math.min(24, Math.max(a.open, a.close) + WICK_PAD_HOURS),
      low: Math.max(0, Math.min(a.open, a.close) - WICK_PAD_HOURS),
      count: a.count,
    }))
}

// ── 提交节奏：星期分布 / 时段分布 / 最长连续提交 ──

/** 小时分桶步长（2 小时一桶，共 12 桶） */
const HOUR_BUCKET_STEP = 2

/**
 * 按星期聚合提交分布（单次 O(n) 遍历，输出固定 7 项，下标 0=周日 ~ 6=周六，与 Date.getDay 对齐）。
 * 解析失败的日期条目忽略；无提交的星期 count 保持 0。
 */
export function aggregateWeekdayStats(commits: NumstatCommit[]): WeekdayStat[] {
  const counts = new Array<number>(7).fill(0)
  for (const c of commits) {
    const t = parseIsoMs(c.date)
    if (t <= 0) continue
    counts[new Date(t).getDay()]++
  }
  return counts.map((count, dow) => ({ dow, count }))
}

/**
 * 按 2 小时分桶聚合时段分布（单次 O(n) 遍历，输出固定 12 桶，每桶 [start, start+2)）。
 * 解析失败/越界时刻忽略；无提交的时段 count 保持 0。
 */
export function aggregateHourlyStats(commits: NumstatCommit[]): HourBucketStat[] {
  const counts = new Array<number>(24 / HOUR_BUCKET_STEP).fill(0)
  for (const c of commits) {
    const h = hourOfDay(c.date)
    if (h < 0 || h >= 24) continue
    counts[Math.floor(h / HOUR_BUCKET_STEP)]++
  }
  return counts.map((count, i) => ({
    start: i * HOUR_BUCKET_STEP,
    end: (i + 1) * HOUR_BUCKET_STEP,
    count,
  }))
}

/**
 * 最长连续提交天数（按本地日历日去重后识别最大连续天数，O(n log n)）。
 * 思路：日期集合排序后相邻两日相差 1 天则 streak 递增，否则重置；无提交返回 0。
 */
export function maxCommitStreak(commits: NumstatCommit[]): number {
  const days = new Set<string>()
  for (const c of commits) {
    const t = parseIsoMs(c.date)
    if (t <= 0) continue
    days.add(new Date(t).toISOString().slice(0, 10))
  }
  if (days.size === 0) return 0
  const sorted = [...days].sort()
  let best = 1
  let cur = 1
  for (let i = 1; i < sorted.length; i++) {
    const gap = (Date.parse(sorted[i]) - Date.parse(sorted[i - 1])) / (24 * 60 * 60 * 1000)
    if (gap === 1) {
      cur++
      if (cur > best) best = cur
    } else {
      cur = 1
    }
  }
  return best
}

/** 提交节奏空结构（git 失败/零提交时报告填充用） */
export function emptyRhythmStats(): CommitRhythmStats {
  const weekday = Array.from({ length: 7 }, (_, dow) => ({ dow, count: 0 }))
  const hourly = Array.from({ length: 24 / HOUR_BUCKET_STEP }, (_, i) => ({
    start: i * HOUR_BUCKET_STEP,
    end: (i + 1) * HOUR_BUCKET_STEP,
    count: 0,
  }))
  return { weekday, hourly, topWeekday: weekday[1], peakHours: hourly[0], maxStreak: 0 }
}

/**
 * 组装提交节奏聚合（星期分布 + 时段分布 + 最长连续提交 + 高峰时段 + 最活跃星期）。
 * 全部为 0 时：最活跃星期取周一（dow=1），高峰时段取首桶（0-2），避免 UI 索引越界。
 */
export function buildRhythmStats(commits: NumstatCommit[]): CommitRhythmStats {
  const weekday = aggregateWeekdayStats(commits)
  const hourly = aggregateHourlyStats(commits)
  const topWeekday = weekday.reduce((best, w) => (w.count > best.count ? w : best), weekday[1])
  const peakHours = hourly.reduce((best, h) => (h.count > best.count ? h : best), hourly[0])
  return { weekday, hourly, topWeekday, peakHours, maxStreak: maxCommitStreak(commits) }
}

/**
 * 计算每日提交量的 7 日滑动平均（供 K 线图叠加趋势折线）。
 * 对每个活跃日取含当日在内的前 7 个日历日为窗口，缺失日期按 0 计入后求均值（1 位小数）。
 * 输出长度与 daily 一致（每个活跃日一个值），无窗口内提交时值为 0。
 */
export function calcMovingAverage7(daily: DailyCommitStat[]): number[] {
  const byDate = new Map(daily.map((s) => [s.date, s.count]))
  const DAY_MS = 24 * 60 * 60 * 1000
  return daily.map((s) => {
    const endMs = Date.parse(s.date)
    let sum = 0
    for (let offset = 0; offset < 7; offset++) {
      // 用本地日期切片，避免 toISOString 的 UTC 口径在西半球时区产生跨日偏移
      const d = new Date(endMs - offset * DAY_MS)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      sum += byDate.get(key) ?? 0
    }
    return Math.round((sum / 7) * 10) / 10
  })
}

// ── 通用工具 ──

/** 整数钳位到 [0, 100] */
function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

/** 保留两位小数 */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ── 文件读取工具 ──

/** 超过 2MB 的文件视为不可读（压缩包/锁文件/二进制，避免整读大文件） */
const LOC_READ_MAX_BYTES = 2 * 1024 * 1024

/** 读取仓库内文件的代码行数（按行切分计数；超大/二进制/读失败返回 null） */
export function countFileLines(project: GitProject, filePath: string): number | null {
  try {
    const modules = getNodeFsPathOs()
    const { fs, path } = modules || {}
    if (!fs || !path) return null
    const abs = path.join(resolveValidPath(project), filePath)
    const stat = fs.statSync(abs)
    if (!stat.isFile() || stat.size > LOC_READ_MAX_BYTES) return null
    const content = fs.readFileSync(abs, "utf8") as string
    const lines = content.split("\n")
    return lines.length - (lines[lines.length - 1] === "" ? 1 : 0)
  } catch {
    return null
  }
}

/**
 * 批量统计已跟踪文件的总行数（当前工作区存量，与 git log 增删增量解耦）。
 * 复用 countFileLines 的统计口径：扩展名黑名单过滤 + 2MB/二进制/读失败跳过。
 * 输入来自 git ls-files，已排除未跟踪与被 .gitignore 忽略的文件，与仓库视图一致。
 */
export function countTrackedFilesLines(project: GitProject, files: string[], extensions?: string[]): number {
  let total = 0
  for (const f of files) {
    if (!shouldIncludeFile(f, extensions)) continue
    const lines = countFileLines(project, f)
    if (lines === null) continue
    total += lines
  }
  return total
}

/**
 * 批量统计已跟踪文件的总行数并按文件分别记录（Map<路径, 行数|null>，供项目详情弹窗按文件路径查存量）。
 * 复用 countFileLines 口径：2MB/二进制/读失败/工作区已删除 → null。
 * 不做扩展名过滤（过滤属调用方口径——详情弹窗文件明细随当前扩展名配置在渲染时过滤，避免分析后改过滤导致行数缺项）。
 */
export function countTrackedFileLinesMap(project: GitProject, files: string[]): Map<string, number | null> {
  const map = new Map<string, number | null>()
  for (const f of files) map.set(f, countFileLines(project, f))
  return map
}

/** diff 输出截断上限（约 5KB 文本，约 100 行 diff，防止巨型文件撑爆 Modal） */
const DIFF_MAX_CHARS = 5000

/**
 * 获取文件最近的 git log -p 差异内容（同步 execFileSync，与 countFileLines 一致）。
 * 仅取最近 5 条提交的 patch，超长截断以控制 Modal 体积。
 * 返回 null 表示获取失败（文件不存在 / 二进制 / 命令失败）。
 */
export function fetchFileDiff(project: GitProject, filePath: string): string | null {
  try {
    const modules = getNodeProcessModules()
    if (!modules) return null
    const repoPath = resolveValidPath(project)
    const raw = modules.child_process.execFileSync(
      "git",
      ["log", "-p", "--max-count=5", "--", filePath],
      { cwd: repoPath, encoding: "utf8", maxBuffer: 2 * 1024 * 1024, timeout: 5000 },
    ) as string
    if (!raw) return null
    return raw.length > DIFF_MAX_CHARS ? raw.slice(0, DIFF_MAX_CHARS) + "\n…(truncated)" : raw
  } catch {
    return null
  }
}

/** 判断仓库内文件当前是否仍存在于工作区（过滤 git 历史中已删除的"幽灵文件"） */
export function fileExistsInRepo(project: GitProject, filePath: string): boolean {
  try {
    const modules = getNodeFsPathOs()
    const { fs, path } = modules || {}
    if (!fs || !path) return false
    return fs.statSync(path.join(resolveValidPath(project), filePath)).isFile()
  } catch {
    return false
  }
}

/** 判断是否为代码文件（排除 .md 文档：Markdown 不属于代码，不计入债务/热点/分析文件统计） */
export function isCodeFile(filePath: string): boolean {
  return !filePath.toLowerCase().endsWith(".md")
}

// ── 技术债务 ──

/** 债务门槛：修改次数低于该值的文件视为正常迭代，不构成技术债务（1-2 次提交是常态演进，参考 code-maat churn 阈值思路） */
export const DEBT_MIN_MOD_COUNT = 3

/**
 * 近期修改加分（3 天+8 / 7 天+5 / 30 天+2，仅对可解析的 ISO 时间生效）。
 * 供热度评分与技术债务评分共用：同一改动量，近期发生比久远发生更值得关注（债务"恶化趋势"信号）。
 */
function recencyBonus(lastModified: string): number {
  const ms = parseIsoMs(lastModified)
  if (ms <= 0) return 0
  const diffDays = (Date.now() - ms) / (24 * 60 * 60 * 1000)
  if (diffDays <= 3) return 8
  if (diffDays <= 7) return 5
  if (diffDays <= 30) return 2
  return 0
}

/**
 * 风险评分（技术债务"评分"列）：sqrt(修改次数)*10 + 参与人数*6 + 近期修改加分，clamp 0~100。
 * sqrt 使 churn 边际收益递减，避免线性公式在活跃文件上过早饱和（modCount 25/40/100 仍可区分）。
 */
export function debtRiskScore(modCount: number, authorCount: number, lastModified: string): number {
  return clamp100(Math.sqrt(modCount) * 10 + authorCount * 6 + recencyBonus(lastModified))
}

/** 严重度分级（基于统一风险分分档）：≥50 严重 / ≥30 高 / ≥15 中 / 其余 低 */
export function debtSeverity(riskScore: number): DebtSeverity {
  if (riskScore >= 50) return "severe"
  if (riskScore >= 30) return "high"
  if (riskScore >= 15) return "medium"
  return "low"
}

/** 技术债务问题总数（严重度计数合计；面板 Tab 徽章与 TechDebtSection 表头徽章/空态共用，消除双份 reduce） */
export function countDebtFiles(debtSummary: Record<DebtSeverity, number>): number {
  return Object.values(debtSummary).reduce((sum, n) => sum + n, 0)
}

// ── 代码热点 ──

/** 热度等级阈值：≥75 热点 / ≥45 温热 / ≥25 冷却 / 其余冷门 */
export function heatLevel(heat: number): HotspotLevel {
  if (heat >= 75) return "hot"
  if (heat >= 45) return "warm"
  if (heat >= 25) return "cool"
  return "cold"
}

/** 热度评分：修改次数*2.2 + 参与人数*7 + 近期修改加分（recencyBonus 与债务评分共用），clamp 0~100 */
export function heatScore(modCount: number, authorCount: number, lastModified: string): number {
  return clamp100(modCount * 2.2 + authorCount * 7 + recencyBonus(lastModified))
}

/** 热点建议文案的 i18n 键（按等级选择；由 UI 层解析 i18n，数据层只存键名避免语言快照） */
export function heatAdviceKey(level: HotspotLevel): string {
  if (level === "hot") return "reportHeatAdviceHot"
  if (level === "warm") return "reportHeatAdviceWarm"
  if (level === "cool") return "reportHeatAdviceCool"
  return ""
}

/** 优化建议文案（按热点文件数占比阈值选择，返回键由调用方取 i18n） */
export function suggestionKey(hotPct: number, warmPct: number): "reportSugNormal" | "reportSugAttention" | "reportSugWarning" {
  if (hotPct >= 10) return "reportSugWarning"
  if (hotPct > 0 || warmPct >= 20) return "reportSugAttention"
  return "reportSugNormal"
}

// ── 报告组装 ──

/** 报告范围对应的 since 参数（all 返回空串） */
export function sinceForRange(range: ReportRange): string {
  return REPORT_RANGES.find((r) => r.value === range)?.since ?? ""
}

/** 热点文件榜单上限（超出只展示头部，避免长列表淹没关键信息） */
const HOTSPOT_LIMIT = 12

/** 债务/热点按严重度排序权重（用于组内排序） */
const SEVERITY_ORDER: Record<DebtSeverity, number> = { severe: 0, high: 1, medium: 2, low: 3 }

/**
 * 由解析结果组装完整报告。
 * @param project 项目（用于读取当前存在性/代码行数）
 * @param commits 解析后的提交块（空数组 = 无提交或 git 失败）
 * @param rangeLabel 时间范围标签
 * @param debtMinModCount 债务门槛（修改次数低于该值不列为债务；默认 DEBT_MIN_MOD_COUNT）
 */
export function buildReportData(
  project: GitProject,
  commits: NumstatCommit[],
  rangeLabel: string,
  debtMinModCount: number = DEBT_MIN_MOD_COUNT,
): CodeReportData {
  const authors = aggregateAuthorStats(commits)
  const fileMap = aggregateFileStats(commits)

  // 作者 Top 修改文件详情查找表（供文件详情弹窗随机访问）
  // 每个作者的 Top3 路径去重后逐条读取 LOC（fs 受 2MB 上限约束且数量受 作者数×3 约束，开销可控）
  const fileDetailsMap: Record<string, FileStatRow> = {}
  for (const author of authors) {
    for (const f of author.topFiles) {
      if (fileDetailsMap[f.path]) continue
      const agg = fileMap.get(f.path)
      fileDetailsMap[f.path] = {
        path: f.path,
        modCount: agg?.modCount ?? f.count,
        authorCount: agg?.authors.size ?? 0,
        lastModified: agg?.lastIso ?? "",
        loc: countFileLines(project, f.path),
        added: agg?.added ?? 0,
        deleted: agg?.deleted ?? 0,
        diffContent: fetchFileDiff(project, f.path),
      }
    }
  }

  // 文件 → 完整统计行（loc 仅在榜单 Top 读取行数控制开销）
  // 过滤链：①已从工作区删除的"幽灵文件"（历史记录不因删除而消失，需按当前磁盘存在性剔除）②非代码文件（.md 文档不属代码）
  const rankedFiles = [...fileMap.entries()]
    .filter(([path]: [string, FileAgg]) => fileExistsInRepo(project, path) && isCodeFile(path))
    .sort((a, b) => b[1].modCount - a[1].modCount)
  const debtRows: DebtFileRow[] = []
  const hotspotRows: HotspotFileRow[] = []
  rankedFiles.forEach(([path, agg]) => {
    // loc 初始为 null：forEach 按 modCount 降序遍历，但最终热点榜按 heat 排序，
    // 先全部置 null，等 heat 排序后再对真正的前 HOTSPOT_LIMIT 条逐一读取 LOC，
    // 避免按 modCount 预读的 LOC 白费（那些文件在热度重排后可能不在最终 Top N 中）
    const base: FileStatRow = {
      path,
      modCount: agg.modCount,
      authorCount: agg.authors.size,
      lastModified: agg.lastIso,
      loc: null,
      added: agg.added,
      deleted: agg.deleted,
      diffContent: null,
    }
    // 债务门槛：修改次数低于 debtMinModCount 的文件视为正常迭代，仅进入热点榜不列为技术债务
    if (agg.modCount >= debtMinModCount) {
      const riskScore = debtRiskScore(agg.modCount, agg.authors.size, agg.lastIso)
      debtRows.push({
        ...base,
        severity: debtSeverity(riskScore),
        riskScore,
      })
    }
    const heat = heatScore(agg.modCount, agg.authors.size, agg.lastIso)
    const level = heatLevel(heat)
    hotspotRows.push({
      ...base,
      heat,
      level,
      adviceKey: heatAdviceKey(level),
    })
  })

  debtRows.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.riskScore - a.riskScore)
  hotspotRows.sort((a, b) => b.heat - a.heat)

  // 仅对热度排序后的最终前 HOTSPOT_LIMIT 条读取 LOC：fs 读取受 2MB 上限约束且数量可控，
  // 避免在 forEach 阶段按 modCount 排序预读导致 LOC 白费（热度重排后条目可能不在 Top N 中）
  for (let i = 0; i < Math.min(HOTSPOT_LIMIT, hotspotRows.length); i++) {
    hotspotRows[i].loc = countFileLines(project, hotspotRows[i].path)
  }

  // 四类热度汇总（文件数 + 占比）
  // 口径说明：分母为全部现存文件（rankedFiles，含修改次数低于债务门槛的常态文件），
  // 与债务表（仅 ≥ 门槛的风险子集）口径不同——热点汇总描述全仓库热度分布，债务表描述高风险子集。
  // 分母防除零；analyzedFiles 使用真实文件数（空仓库应展示 0 而非 1）
  const totalFiles = rankedFiles.length
  const pctDenominator = totalFiles || 1
  const summary: HotspotFileRow["level"][] = ["hot", "warm", "cool", "cold"]
  const hotspotSummary = summary.map((level) => {
    const count = hotspotRows.filter((r) => r.level === level).length
    return { level, count, pct: Math.round((count / pctDenominator) * 100) }
  })
  const warmPct = hotspotSummary[1].pct
  const hotPct = hotspotSummary[0].pct

  const totalCommits = commits.length
  const totalLines = authors.reduce((sum, a) => sum + a.linesAdded, 0)

  const debtSummary: Record<DebtSeverity, number> = { severe: 0, high: 0, medium: 0, low: 0 }
  debtRows.forEach((r) => { debtSummary[r.severity]++ })

  const suggestionKeyName = suggestionKey(hotPct, warmPct)

  return {
    ok: true,
    projectId: project.id,
    projectName: project.name,
    rangeLabel,
    generatedAt: new Date().toISOString(),
    totalCommits,
    teamOverview: {
      memberCount: authors.length,
      totalCommits,
      totalLines,
      topAuthor: authors[0]?.author ?? "",
    },
    authors,
    debtFiles: debtRows,
    debtSummary,
    hotspots: hotspotRows.slice(0, HOTSPOT_LIMIT),
    hotspotSummary,
    suggestionKey: suggestionKeyName,
    dailyStats: aggregateDailyStats(commits),
    rhythm: buildRhythmStats(commits),
    analyzedFiles: totalFiles,
    fileDetailsMap,
  }
}

/** 空报告（git 失败/非仓库时返回，UI 展示错误态） */
export function buildEmptyReport(project: GitProject, rangeLabel: string): CodeReportData {
  return {
    ok: false,
    projectId: project.id,
    projectName: project.name,
    rangeLabel,
    generatedAt: new Date().toISOString(),
    totalCommits: 0,
    teamOverview: { memberCount: 0, totalCommits: 0, totalLines: 0, topAuthor: "" },
    authors: [],
    debtFiles: [],
    debtSummary: { severe: 0, high: 0, medium: 0, low: 0 },
    hotspots: [],
    hotspotSummary: HOTSPOT_LEVEL_ORDER.map((level) => ({ level, count: 0, pct: 0 })),
    suggestionKey: "",
    dailyStats: [],
    rhythm: emptyRhythmStats(),
    analyzedFiles: 0,
    fileDetailsMap: {},
  }
}

/** 展示用常量：热点等级顺序（供 UI 遍历汇总表） */
export const HOTSPOT_LEVEL_ORDER: HotspotLevel[] = ["hot", "warm", "cool", "cold"]

/** 展示用常量：严重度顺序（供 UI 遍历分组） */
export const DEBT_SEVERITY_ORDER: DebtSeverity[] = ["severe", "high", "medium", "low"]
