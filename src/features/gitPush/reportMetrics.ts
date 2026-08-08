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
  DebtFileRow,
  DebtSeverity,
  FileStatRow,
  HotspotFileRow,
  HotspotLevel,
  ReportRange,
} from "./types/report"
import { REPORT_RANGES } from "./types/report"
import { getNodeFsPathOs, getNodeProcessModules } from "@/utils/nodeModules"
import { resolveValidPath } from "./utils"

// ── 解析：git log --numstat 输出 → 结构化提交块 ──

/** 单条提交的 numstat 解析结果 */
export interface NumstatCommit {
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
 * 解析 git log --pretty=format:%x1e%an%x1f%aI --numstat 输出。
 * 结构：每条提交 = "<RS>作者<US>ISO日期\n" + 若干 "新增\t删除\t路径\n" 行，提交间以空行分隔。
 */
export function parseNumstatBlocks(raw: string): NumstatCommit[] {
  const commits: NumstatCommit[] = []
  const chunks = raw.split("\x1e")
  for (let i = 1; i < chunks.length; i++) {
    const chunk = chunks[i]
    const lines = chunk.split("\n")
    const header = lines[0] || ""
    const sep = header.indexOf("\x1f")
    if (sep === -1) continue
    const author = header.slice(0, sep).trim()
    const date = header.slice(sep + 1).trim()
    if (!author || !date) continue
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
    commits.push({ author, date, files })
  }
  return commits
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
  const totalFiles = rankedFiles.length || 1
  const summary: HotspotFileRow["level"][] = ["hot", "warm", "cool", "cold"]
  const hotspotSummary = summary.map((level) => {
    const count = hotspotRows.filter((r) => r.level === level).length
    return { level, count, pct: Math.round((count / totalFiles) * 100) }
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
    analyzedFiles: 0,
    fileDetailsMap: {},
  }
}

/** 展示用常量：热点等级顺序（供 UI 遍历汇总表） */
export const HOTSPOT_LEVEL_ORDER: HotspotLevel[] = ["hot", "warm", "cool", "cold"]

/** 展示用常量：严重度顺序（供 UI 遍历分组） */
export const DEBT_SEVERITY_ORDER: DebtSeverity[] = ["severe", "high", "medium", "low"]
