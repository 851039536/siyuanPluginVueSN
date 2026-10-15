// 基础统计查询（总数/标签/写作活跃度/块类型）

import type {
  BlockTypeCountRow,
  BlockTypeStat,
  DailyWordCount,
  StatisticsData,
} from "../types"
import { lsNotebooks } from "@/api"
import {
  BLOCK_TYPE_LABELS,
  ZERO_STATISTICS,
} from "../types/constants"
import {
  filterActiveNotebooks,
  formatYmd,
} from "../utils"
import {
  executeSql,
  formatDateTime,
} from "./executeSql"
import {
  getDailyStats,
  getMonthlyStatsRange,
  getWeeklyStats,
  getYearlyStats,
} from "./timeStats"

/**
 * 标签总数标量子查询：与 combinedSql 同构，故合并进主查询，省去一次 HTTP 往返。
 * 三种来源（行内 span / 块属性 / 标签块）去重计数后相加。
 *
 * 注：这是**往返次数**优化，不是 SQL 提速。实测（20 万块合成库）该子查询独立执行仅
 * 0.68ms，合并后整条语句反而略慢约 2ms（SQLite 需在同语句内多维护一个 DISTINCT 临时 B 树），
 * 净收益仅为少一次 /api/query/sql 往返。差距在噪声量级，故保留合并。
 */
const TOTAL_TAGS_SUBQUERY = `
  COALESCE((SELECT COUNT(DISTINCT content) FROM spans WHERE type='tag'), 0) +
  COALESCE((SELECT COUNT(DISTINCT value) FROM attributes WHERE name='tags' AND value IS NOT NULL AND value != ''), 0) +
  COALESCE((SELECT COUNT(DISTINCT content) FROM blocks WHERE type='tag'), 0)
`

async function getNotebookCount(): Promise<number> {
  try {
    const data = await lsNotebooks()
    if (!data || !data.notebooks) return 0
    return filterActiveNotebooks(data.notebooks).length
  } catch {
    return 0
  }
}

/**
 * 写作活跃度：近两年活跃天数 + 当前连续写作天数。
 *
 * 原实现用一条 `UNION ... LIMIT 1024` 取全部去重日期，再在前端 Set 计数。
 * 注：该 LIMIT 实际上**不会**造成截断——两年最多 730/731 个去重日期，恒小于 1024
 * （此结论经合成库实测确认：20 万块库中该查询返回 730 行）。故原实现结果正确，
 * 此处改造只为减少回传与前端处理：activeDays 交给 SQL COUNT（只回 1 行），
 * 连续天数只需近端连续区间，故按日期倒序取有限行即可。
 */
async function getWritingActivity(): Promise<{ activeDays: number, writingStreak: number }> {
  const today = new Date()
  const twoYearsAgo = new Date(today)
  twoYearsAgo.setFullYear(today.getFullYear() - 2)
  const startStr = formatDateTime(twoYearsAgo)
  const endStr = formatDateTime(today)

  // 连续天数回溯窗口：覆盖任何实际写作连续记录，避免回传两年全量日期
  const STREAK_WINDOW_DAYS = 400
  const streakStart = new Date(today)
  streakStart.setDate(streakStart.getDate() - STREAK_WINDOW_DAYS)
  const streakStartStr = formatDateTime(streakStart)

  const [countRows, streakRows] = await Promise.all([
    // activeDays：交给 SQL 计数，只回 1 行
    executeSql(`
      SELECT COUNT(*) as activeDays FROM (
        SELECT substr(created, 1, 8) as date FROM blocks
        WHERE type = 'd' AND created >= '${startStr}' AND created <= '${endStr}'
        UNION
        SELECT substr(updated, 1, 8) as date FROM blocks
        WHERE type = 'd' AND updated >= '${startStr}' AND updated <= '${endStr}'
      )
    `),
    // 连续天数：仅需近端日期，按倒序取有限行
    executeSql(`
      SELECT date FROM (
        SELECT substr(created, 1, 8) as date FROM blocks
        WHERE type = 'd' AND created >= '${streakStartStr}' AND created <= '${endStr}'
        UNION
        SELECT substr(updated, 1, 8) as date FROM blocks
        WHERE type = 'd' AND updated >= '${streakStartStr}' AND updated <= '${endStr}'
      )
      ORDER BY date DESC
      LIMIT ${STREAK_WINDOW_DAYS}
    `),
  ])

  const activeDays = Number(countRows[0]?.activeDays || 0)

  const activeDateSet = new Set<string>()
  for (const row of streakRows) {
    const d = String(row.date || "")
    if (d.length >= 8) activeDateSet.add(d.substring(0, 8))
  }

  // Calculate streak: count consecutive days ending today
  let streak = 0
  const checkDate = new Date(today)
  // Include today if active, otherwise start from yesterday
  if (!activeDateSet.has(formatYmd(checkDate))) {
    checkDate.setDate(checkDate.getDate() - 1)
  }

  while (activeDateSet.has(formatYmd(checkDate))) {
    streak++
    checkDate.setDate(checkDate.getDate() - 1)
  }

  return {
    activeDays,
    writingStreak: streak,
  }
}

async function getBlockTypeStats(): Promise<BlockTypeStat[]> {
  try {
    const sqlStmt = `
      SELECT type, COUNT(*) as cnt
      FROM blocks
      GROUP BY type
      ORDER BY cnt DESC
    `
    const rows = await executeSql<BlockTypeCountRow>(sqlStmt)
    if (!rows || rows.length === 0) return []

    return rows.map((row) => ({
      name: row.type,
      count: Number(row.cnt || 0),
      label: BLOCK_TYPE_LABELS[row.type] || row.type,
    }))
  } catch (error) {
    console.error("获取块类型统计失败:", error)
    return []
  }
}

// 内容块/资源块类型集合：totalBlocks、totalAssets、codeBlocks 由块类型分布派生，避免重复全表扫描。
// 注：实测该 GROUP BY type 走覆盖索引扫描（SCAN blocks USING COVERING INDEX idx_blocks_type），
// 20 万块库约 12ms；改用 SUM(CASE WHEN...) 条件聚合反而慢至约 33ms（需读全部列），
// 故此处维持「一次 GROUP BY + 前端按类型求和」的写法。
const CONTENT_BLOCK_TYPES = ["p", "h", "l", "i", "t", "c", "html", "query_embed"]
const ASSET_BLOCK_TYPES = ["img", "audio", "video", "widget", "iframe"]

function sumCountByTypes(stats: BlockTypeStat[], types: string[]): number {
  return stats.reduce((sum, item) => (types.includes(item.name) ? sum + item.count : sum), 0)
}

// 周期标题返回 i18n 键，由视图层（index.vue chartTitle）映射为文案
const DAY_PERIOD_KEYS: Record<number, string> = {
  7: "periodDays7",
  15: "periodDays15",
  30: "periodDays30",
  90: "periodDays90",
  180: "periodDays180",
  365: "periodDays365",
}
const MONTH_PERIOD_KEYS: Record<number, string> = {
  1: "periodMonths1",
  2: "periodMonths2",
  3: "periodMonths3",
}

// 时段统计（柱状图数据）：切换时间范围时单独调用，避免重跑全量统计
export async function getPeriodStats(viewMode: string, options: {
  dayRange: number
  monthYearRange: number
  selectedYear: number
}): Promise<Pick<StatisticsData, "dailyStats" | "currentPeriod" | "periodTotalWords">> {
  let dailyStats: DailyWordCount[] = []
  let currentPeriod = ""

  switch (viewMode) {
    case "day":
      dailyStats = await getDailyStats(options.dayRange)
      currentPeriod = DAY_PERIOD_KEYS[options.dayRange] || "periodDaysDefault"
      break
    case "week":
      dailyStats = await getWeeklyStats(4)
      currentPeriod = "periodWeeks4"
      break
    case "month":
      dailyStats = await getMonthlyStatsRange(options.monthYearRange)
      currentPeriod = MONTH_PERIOD_KEYS[options.monthYearRange] || "periodMonthsDefault"
      break
    case "year":
      dailyStats = await getYearlyStats(options.selectedYear)
      currentPeriod = "periodYears"
      break
  }

  return {
    dailyStats,
    currentPeriod,
    periodTotalWords: dailyStats.reduce((sum, item) => sum + item.words, 0),
  }
}

export async function getStatistics(viewMode: string, options: {
  dayRange: number
  monthYearRange: number
  selectedYear: number
}): Promise<StatisticsData> {
  try {
    const todayStr = formatYmd(new Date())

    // 今日统计使用范围比较（而非 substr 包裹列），保持 sargable；字数口径统一为思源预计算的 length 列
    // totalTags 由 3 个标量子查询组成，与其余标量同构，合并进本条语句（原为独立请求）
    const combinedSql = `
      SELECT
        (SELECT COUNT(DISTINCT root_id) FROM blocks WHERE type='d') as totalNotes,
        (SELECT SUM(length) FROM blocks WHERE type = 'p' AND length > 0) as totalWords,
        (SELECT COUNT(DISTINCT block_id) FROM refs) as totalBacklinks,
        (SELECT COUNT(DISTINCT root_id) FROM blocks WHERE type='d' AND created >= '${todayStr}000000' AND created <= '${todayStr}235959') as todayCreated,
        (SELECT COUNT(DISTINCT root_id) FROM blocks WHERE type='d' AND updated >= '${todayStr}000000' AND updated <= '${todayStr}235959') as todayModified,
        (${TOTAL_TAGS_SUBQUERY}) as totalTags
    `

    const [combinedResult, blockTypeStats, notebookCount, writingActivity] = await Promise.all([
      executeSql(combinedSql),
      getBlockTypeStats(),
      getNotebookCount(),
      getWritingActivity(),
    ])

    const baseStats = combinedResult[0] || {}
    const totalNotes = Number(baseStats.totalNotes || 0)
    const totalWords = Number(baseStats.totalWords || 0)
    const totalBacklinks = Number(baseStats.totalBacklinks || 0)
    const todayCreated = Number(baseStats.todayCreated || 0)
    const todayModified = Number(baseStats.todayModified || 0)
    const totalTags = Number(baseStats.totalTags || 0)

    // 块数量指标统一由块类型分布派生，省去 3 次 blocks 全表扫描
    const totalBlocks = sumCountByTypes(blockTypeStats, CONTENT_BLOCK_TYPES)
    const totalAssets = sumCountByTypes(blockTypeStats, ASSET_BLOCK_TYPES)
    const codeBlocks = sumCountByTypes(blockTypeStats, ["c"])

    const avgWordsPerDoc = totalNotes > 0 ? Math.round(totalWords / totalNotes) : 0

    const { dailyStats, currentPeriod, periodTotalWords } = await getPeriodStats(viewMode, options)

    return {
      totalNotes,
      totalWords,
      totalBlocks,
      totalAssets,
      totalTags,
      totalBacklinks,
      todayCreated,
      todayModified,
      avgWordsPerDoc,
      dailyStats,
      currentPeriod,
      periodTotalWords,
      blockTypeStats,
      notebookCount,
      codeBlocks,
      writingStreak: writingActivity.writingStreak,
      activeDays: writingActivity.activeDays,
    }
  } catch (error) {
    console.error("获取统计数据失败:", error)
    return { ...ZERO_STATISTICS }
  }
}
