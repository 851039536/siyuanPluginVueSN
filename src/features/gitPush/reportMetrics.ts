// gitPush 代码统计报告指标引擎：numstat 解析 + 作者/文件聚合 + 启发式评分（纯函数，无 Vue 依赖）
//
// 启发式公式说明（参考报告反推，确定性可复现）：
// - 稳定性 stability = clamp(100 - 修改次数*3.6)（26次→6、24次→14、28次→0，与参考值 ±1 内吻合）
// - 复杂度 complexity = 代码行数*0.45 + 修改次数*1.2（行数不可读时退化为 修改次数*2）
// - 质量分 quality：活跃天数 + 提交数 + 净增倾向加权，clamp 到 0~100
// - 热度 heat = 修改次数*2.2 + 参与人数*7 + 近期修改加分；阈值 热点≥75 / 温热≥45 / 冷却≥25
import type { GitProject } from "./types"
import type {
  AuthorReportRow,
  CodeReportData,
  DebtFileRow,
  DebtSeverity,
  DebtType,
  FileStatRow,
  HotspotFileRow,
  HotspotLevel,
  QualityGrade,
  ReportRange,
} from "./types/report"
import { REPORT_RANGES } from "./types/report"
import { getNodeFsPathOs } from "@/utils/nodeModules"
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
  days: Set<string>
  firstDate: number
  lastDate: number
}

/** 文件聚合中间态 */
interface FileAgg {
  modCount: number
  authors: Set<string>
  lastIso: string
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
      a = { commits: 0, added: 0, deleted: 0, files: new Set(), days: new Set(), firstDate: 0, lastDate: 0 }
      map.set(c.author, a)
    }
    a.commits++
    const ms = parseIsoMs(c.date)
    if (ms > 0) {
      if (a.firstDate === 0 || ms < a.firstDate) a.firstDate = ms
      if (ms > a.lastDate) a.lastDate = ms
      a.days.add(c.date.slice(0, 10))
    }
    for (const f of c.files) {
      a.added += f.added
      a.deleted += f.deleted
      a.files.add(f.path)
    }
  }
  const rows: AuthorReportRow[] = []
  for (const [author, a] of map) {
    const net = a.added - a.deleted
    const activeDays = activeDaysBetween(a.firstDate, a.lastDate)
    const quality = qualityScore(a.commits, net, activeDays)
    rows.push({
      author,
      commits: a.commits,
      linesAdded: a.added,
      netLines: net,
      avgCommitSize: a.commits > 0 ? Math.round(a.added / a.commits) : 0,
      frequency: round2(a.commits / Math.max(1, activeDays / 7)),
      filesTouched: a.files.size,
      activeDays,
      quality,
      grade: qualityGrade(quality),
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
        agg = { modCount: 0, authors: new Set(), lastIso: "" }
        map.set(f.path, agg)
      }
      agg.modCount++
      agg.authors.add(c.author)
      if (c.date > agg.lastIso) agg.lastIso = c.date
    }
  }
  return map
}

// ── 启发式评分公式 ──

/** 整数钳位到 [0, 100] */
function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

/** 保留两位小数 */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * 质量分启发式：活跃天数 + 提交数 + 净增倾向（每提交净增越大越正向）。
 * 参考报告三作者反推：活跃天数与净增为正相关，提交数上限封顶防刷分。
 */
export function qualityScore(commits: number, netLines: number, activeDays: number): number {
  const netPerCommit = netLines / Math.max(commits, 1)
  const netBonus = Math.max(-8, Math.min(12, netPerCommit / 25))
  const score = 60 + activeDays * 0.28 + Math.min(commits, 25) * 0.35 + netBonus
  return clamp100(score)
}

/** 质量等级：S≥90 / A≥80 / B≥60 / C≥40 / 其余 D */
export function qualityGrade(score: number): QualityGrade {
  if (score >= 90) return "S"
  if (score >= 80) return "A"
  if (score >= 60) return "B"
  if (score >= 40) return "C"
  return "D"
}

/** 稳定性启发式：修改越频繁稳定性越低（参考报告 3.6 倍率反推） */
export function stabilityScore(modCount: number): number {
  return clamp100(100 - modCount * 3.6)
}

/** 复杂度估算：行数*0.45 + 修改次数*1.2；行数不可读时退化为 修改次数*2 */
export function complexityEstimate(modCount: number, loc: number | null): number {
  return loc !== null ? Math.round(loc * 0.45 + modCount * 1.2) : modCount * 2
}

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

// ── 技术债务 ──

/**
 * 问题类型分类：无稳定分但高复杂度 → 高复杂度；稳定分低(≤18) → 不稳定；
 * 其余高复杂度(≥60) → 高复杂度；否则高频修改。
 */
export function classifyDebt(stability: number | null, complexity: number | null): DebtType {
  if (stability === null && complexity !== null && complexity >= 60) return "highComplexity"
  if (stability !== null && stability <= 18) return "unstable"
  if (complexity !== null && complexity >= 60) return "highComplexity"
  return "frequentChanges"
}

/** 严重度分级：稳定性 ≤10 → 严重；≤30 → 高；其余 → 中（无稳定分时按复杂度高判定为高） */
export function debtSeverity(stability: number | null, complexity: number | null): DebtSeverity {
  if (stability === null) {
    return complexity !== null && complexity >= 60 ? "high" : "medium"
  }
  if (stability <= 10) return "severe"
  if (stability <= 30) return "high"
  return "medium"
}

/** 风险评分（技术债务"评分"列）：复杂度 + 修改次数 + 低稳定分加权，clamp 0~100 */
export function debtRiskScore(stability: number | null, complexity: number | null, modCount: number): number {
  const score =
    (complexity ?? 0) * 0.18
    + modCount * 0.9
    + (stability !== null ? (100 - stability) * 0.12 : 6)
  return clamp100(score)
}

/** 技术债务问题总数（严重度计数合计；面板 Tab 徽章与 TechDebtSection 表头徽章/空态共用，消除双份 reduce） */
export function countDebtFiles(debtSummary: Record<DebtSeverity, number>): number {
  return Object.values(debtSummary).reduce((sum, n) => sum + n, 0)
}

/** 时间范围对应的"过去{0}"时长词（供说明文案模板） */
export function rangeDurationKey(range: ReportRange): "reportDurAll" | "reportDur3m" | "reportDur6m" | "reportDur1y" {
  switch (range) {
    case "3m": return "reportDur3m"
    case "1y": return "reportDur1y"
    case "6m": return "reportDur6m"
    default: return "reportDurAll"
  }
}

/** 拼接技术债务说明文案（按可用指标分句组合，与参考报告"说明"结构一致） */
export function buildDebtDescription(row: FileStatRow, range: ReportRange, i18n: Record<string, any>): string {
  const duration = i18n[rangeDurationKey(range)] || i18n.reportDur6m || ""
  const parts: string[] = []
  if (row.modCount > 0) {
    const tpl = i18n.reportDebtDescModified || "{1}"
    parts.push(tpl.replace("{0}", duration).replace("{1}", String(row.modCount)))
  }
  if (row.complexity !== null) {
    const tpl = i18n.reportDebtDescComplexity || "{0}"
    parts.push(tpl.replace("{0}", String(row.complexity)))
  }
  if (row.stability !== null) {
    const tpl = i18n.reportDebtDescStability || "{0}"
    parts.push(tpl.replace("{0}", String(row.stability)))
  }
  return parts.join("; ")
}

// ── 代码热点 ──

/** 热度等级阈值：≥75 热点 / ≥45 温热 / ≥25 冷却 / 其余冷门 */
export function heatLevel(heat: number): HotspotLevel {
  if (heat >= 75) return "hot"
  if (heat >= 45) return "warm"
  if (heat >= 25) return "cool"
  return "cold"
}

/** 热度评分：修改次数*2.2 + 参与人数*7 + 近期修改加分（3 天+8 / 7 天+5 / 30 天+2），clamp 0~100 */
export function heatScore(modCount: number, authorCount: number, lastModified: string): number {
  const ms = parseIsoMs(lastModified)
  let recency = 0
  if (ms > 0) {
    const diffDays = (Date.now() - ms) / (24 * 60 * 60 * 1000)
    if (diffDays <= 3) recency = 8
    else if (diffDays <= 7) recency = 5
    else if (diffDays <= 30) recency = 2
  }
  return clamp100(modCount * 2.2 + authorCount * 7 + recency)
}

/** 热点建议文案（按等级选择） */
export function buildHeatAdvice(level: HotspotLevel, i18n: Record<string, any>): string {
  if (level === "hot") return i18n.reportHeatAdviceHot || ""
  if (level === "warm") return i18n.reportHeatAdviceWarm || ""
  if (level === "cool") return i18n.reportHeatAdviceCool || ""
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
const SEVERITY_ORDER: Record<DebtSeverity, number> = { severe: 0, high: 1, medium: 2 }

/**
 * 由解析结果组装完整报告。
 * @param projectId 项目 ID（透传用于后续跳转/过滤）
 * @param projectName 项目名称
 * @param commits 解析后的提交块（空数组 = 无提交或 git 失败）
 * @param rangeLabel 时间范围标签
 * @param range 时间范围
 * @param i18n 说明文案模板来源（i18n 分片，纯文本不参与响应式）
 */
export function buildReportData(
  project: GitProject,
  commits: NumstatCommit[],
  rangeLabel: string,
  range: ReportRange,
  i18n: Record<string, any>,
): CodeReportData {
  const authors = aggregateAuthorStats(commits)
  const fileMap = aggregateFileStats(commits)

  // 文件 → 完整统计行（含 loc/复杂度/稳定分，仅在榜单 Top 读取行数控制开销）
  const rankedFiles = [...fileMap.entries()].sort((a, b) => b[1].modCount - a[1].modCount)
  const debtRows: DebtFileRow[] = []
  const hotspotRows: HotspotFileRow[] = []
  rankedFiles.forEach(([path, agg], idx) => {
    const loc = idx < HOTSPOT_LIMIT ? countFileLines(project, path) : null
    const complexity = complexityEstimate(agg.modCount, loc)
    const stability = stabilityScore(agg.modCount)
    const base: FileStatRow = {
      path,
      modCount: agg.modCount,
      authorCount: agg.authors.size,
      lastModified: agg.lastIso,
      complexity,
      loc,
      stability,
    }
    debtRows.push({
      ...base,
      severity: debtSeverity(stability, complexity),
      debtType: classifyDebt(stability, complexity),
      riskScore: debtRiskScore(stability, complexity, agg.modCount),
      description: buildDebtDescription(base, range, i18n),
    })
    const heat = heatScore(agg.modCount, agg.authors.size, agg.lastIso)
    const level = heatLevel(heat)
    hotspotRows.push({
      ...base,
      heat,
      level,
      advice: buildHeatAdvice(level, i18n),
    })
  })

  debtRows.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.riskScore - b.riskScore)
  hotspotRows.sort((a, b) => b.heat - a.heat)

  // 四类热度汇总（文件数 + 占比）
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
  const avgQuality = authors.length > 0 ? Math.round(authors.reduce((sum, a) => sum + a.quality, 0) / authors.length) : 0

  const debtSummary: Record<DebtSeverity, number> = { severe: 0, high: 0, medium: 0 }
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
      avgQuality,
      topAuthor: authors[0]?.author ?? "",
    },
    authors,
    debtFiles: debtRows,
    debtSummary,
    hotspots: hotspotRows.slice(0, HOTSPOT_LIMIT),
    hotspotSummary,
    suggestion: i18n[suggestionKeyName] || "",
    analyzedFiles: totalFiles,
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
    teamOverview: { memberCount: 0, totalCommits: 0, totalLines: 0, avgQuality: 0, topAuthor: "" },
    authors: [],
    debtFiles: [],
    debtSummary: { severe: 0, high: 0, medium: 0 },
    hotspots: [],
    hotspotSummary: HOTSPOT_LEVEL_ORDER.map((level) => ({ level, count: 0, pct: 0 })),
    suggestion: "",
    analyzedFiles: 0,
  }
}

/** 展示用常量：热点等级顺序（供 UI 遍历汇总表） */
export const HOTSPOT_LEVEL_ORDER: HotspotLevel[] = ["hot", "warm", "cool", "cold"]

/** 展示用常量：严重度顺序（供 UI 遍历分组） */
export const DEBT_SEVERITY_ORDER: DebtSeverity[] = ["severe", "high", "medium"]
