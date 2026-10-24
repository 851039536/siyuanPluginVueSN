// gitPush 报告指标引擎 — 报告组装层：聚合产物 → CodeReportData（纯逻辑 + 经 fileLines 读行数）
import type { GitProject } from "../types/storage"
import type {
  CodeReportData,
  DebtFileRow,
  FileStatRow,
  HotspotFileRow,
} from "../types/report"
import { DEBT_SEVERITY_ORDER, HOTSPOT_LEVEL_ORDER } from "../types/report"
import type { NumstatCommit } from "./types"
import { aggregateAuthorStats } from "./aggregateAuthor"
import { aggregateFileStats, type FileAgg } from "./aggregateFile"
import { aggregateDailyStats } from "./dailyStats"
import { buildRhythmStats, emptyRhythmStats } from "./rhythm"
import {
  debtRiskScore,
  debtSeverity,
  DEBT_MIN_MOD_COUNT,
  emptyDebtSummary,
  heatScore,
  hotspotLevel,
  quantileHeatThresholds,
  suggestionKey,
} from "./scoring"
import { countFileLines, createRepoFileIndex, isCodeFile } from "./fileLines"

/** 热点文件榜单上限（超出只展示头部，避免长列表淹没关键信息） */
const HOTSPOT_LIMIT = 12

/**
 * 由解析结果组装完整报告。
 * @param project 项目（用于读取当前存在性/代码行数）
 * @param commits 解析后的提交块（空数组 = 无提交或 git 失败）
 * @param rangeLabel 时间范围标签
 */
export function buildReportData(
  project: GitProject,
  commits: NumstatCommit[],
  rangeLabel: string,
): CodeReportData {
  const authors = aggregateAuthorStats(commits)
  const fileMap = aggregateFileStats(commits)

  // 作者 Top 修改文件详情查找表（供文件详情弹窗随机访问；完全由已聚合的 fileMap 派生，零 IO）
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
        loc: null,
        added: agg?.added ?? 0,
        deleted: agg?.deleted ?? 0,
      }
    }
  }

  // 文件 → 完整统计行（loc 仅在榜单 Top 读取行数控制开销）
  // 过滤链：①非代码文件（.md 文档不属代码，廉价判断前置减少 fs 调用）②已从工作区删除的"幽灵文件"（历史记录不因删除而消失，需按当前磁盘存在性剔除）
  // 存在性用目录级索引（每目录一次 readdir）而非逐文件 statSync
  const fileIndex = createRepoFileIndex(project)
  const rankedFiles = [...fileMap.entries()]
    .filter(([path]: [string, FileAgg]) => isCodeFile(path) && (fileIndex === null || fileIndex.has(path)))
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
    }
    // 债务门槛：修改次数低于 DEBT_MIN_MOD_COUNT 的文件视为正常迭代，仅进入热点榜不列为技术债务
    if (agg.modCount >= DEBT_MIN_MOD_COUNT) {
      const riskScore = debtRiskScore(agg.modCount, agg.authors.size, agg.lastIso)
      debtRows.push({
        ...base,
        severity: debtSeverity(riskScore),
        riskScore,
      })
    }
    const heat = heatScore(agg.modCount, agg.authors.size, agg.lastIso)
    // level 暂存 cold：分位阈值需先收齐全部 heat，统一在下方按分布定级
    hotspotRows.push({
      ...base,
      heat,
      level: "cold",
    })
  })

  // 分位分桶（对齐 GitHub 贡献图"相对本仓库活跃度"的强度语义）：
  // 先收齐全部 heat 求阈值，再统一定级——hotspotSummary 的占比口径依赖 level 正确
  const heatThresholds = quantileHeatThresholds(hotspotRows.map((r) => r.heat))
  for (const row of hotspotRows) {
    row.level = hotspotLevel(row.heat, heatThresholds)
  }

  debtRows.sort((a, b) => DEBT_SEVERITY_ORDER.indexOf(a.severity) - DEBT_SEVERITY_ORDER.indexOf(b.severity) || b.riskScore - a.riskScore)
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
  // 复用 HOTSPOT_LEVEL_ORDER 单一数据源（buildEmptyReport 同源），避免手写数组漂移
  const hotspotSummary = HOTSPOT_LEVEL_ORDER.map((level) => {
    const count = hotspotRows.filter((r) => r.level === level).length
    return { level, count, pct: Math.round((count / pctDenominator) * 100) }
  })

  // 优化建议改用「绝对热度阈值」口径：hotspotSummary 的分位分级是相对本仓库的展示语义，
  // n≥8 时必然存在 hot 桶（占比恒约 10%+），若据其占比给建议则几乎永远落在 Warning。
  // 建议文案描述的是绝对 churn 集中度（heat≥75），与相对展示解耦。
  const absoluteHotCount = hotspotRows.filter((r) => hotspotLevel(r.heat) === "hot").length
  const absoluteWarmCount = hotspotRows.filter((r) => hotspotLevel(r.heat) === "warm").length

  const totalCommits = commits.length
  const totalLines = authors.reduce((sum, a) => sum + a.linesAdded, 0)

  const debtSummary = emptyDebtSummary()
  debtRows.forEach((r) => { debtSummary[r.severity]++ })

  const suggestionKeyName = suggestionKey(
    Math.round((absoluteHotCount / pctDenominator) * 100),
    Math.round((absoluteWarmCount / pctDenominator) * 100),
  )

  return {
    ok: true,
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
export function buildEmptyReport(rangeLabel: string): CodeReportData {
  return {
    ok: false,
    rangeLabel,
    generatedAt: new Date().toISOString(),
    totalCommits: 0,
    teamOverview: { memberCount: 0, totalCommits: 0, totalLines: 0, topAuthor: "" },
    authors: [],
    debtFiles: [],
    debtSummary: emptyDebtSummary(),
    hotspots: [],
    hotspotSummary: HOTSPOT_LEVEL_ORDER.map((level) => ({ level, count: 0, pct: 0 })),
    suggestionKey: "",
    dailyStats: [],
    rhythm: emptyRhythmStats(),
    analyzedFiles: 0,
    fileDetailsMap: {},
  }
}
