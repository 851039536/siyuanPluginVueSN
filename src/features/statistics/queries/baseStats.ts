// 基础统计查询（总数/标签/图片/写作活跃度/块类型）

import type {
  BlockTypeCountRow,
  BlockTypeStat,
  DailyWordCount,
  StatisticsData,
} from "../types"
import {
  lsNotebooks,
  readDir,
} from "@/api"
import {
  BLOCK_TYPE_LABELS,
  IMAGE_EXTENSIONS,
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
 * 标签总数标量子查询：与 combinedSql 同构，故合并进主查询省去一次 HTTP 往返。
 * 三种来源（行内 span / 块属性 / 标签块）去重计数后相加。
 */
const TOTAL_TAGS_SUBQUERY = `
  COALESCE((SELECT COUNT(DISTINCT content) FROM spans WHERE type='tag'), 0) +
  COALESCE((SELECT COUNT(DISTINCT value) FROM attributes WHERE name='tags' AND value IS NOT NULL AND value != ''), 0) +
  COALESCE((SELECT COUNT(DISTINCT content) FROM blocks WHERE type='tag'), 0)
`

function isImageFile(filename: string): boolean {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf("."))
  return IMAGE_EXTENSIONS.includes(ext)
}

async function getTotalImages(): Promise<number> {
  const countImagesInDirectory = async (path: string): Promise<number> => {
    try {
      const result = await readDir(path)
      if (!result) return 0

      const files = Array.isArray(result) ? result : [result]

      // 子目录并行递归，避免逐目录串行 HTTP 请求
      const subDirCounts = await Promise.all(
        files.filter((file) => file.isDir).map((file) => countImagesInDirectory(`${path}/${file.name}`)),
      )
      const fileCount = files.filter((file) => !file.isDir && isImageFile(file.name)).length
      return fileCount + subDirCounts.reduce((sum, cnt) => sum + cnt, 0)
    } catch (error) {
      console.error(`统计目录图片失败 ${path}:`, error)
      return 0
    }
  }

  try {
    const assetsPath = "/data/assets"
    return await countImagesInDirectory(assetsPath)
  } catch (error) {
    console.error("统计思源图片失败:", error)
    return 0
  }
}

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
 * 原实现用一条 `UNION ... LIMIT 1024` 取全部去重日期再在前端计数，有两个问题：
 * 1) LIMIT 1024 会静默截断结果集 → activeDays 少算（活跃库两年去重日期可超 1024）；
 * 2) 为算连续天数把两年全部日期行拉回前端。
 * 现拆为两条语句：activeDays 直接由 SQL COUNT 得到（无截断、只返回 1 行）；
 * 连续天数只需连续区间，故按日期倒序取有限行（连续天数远超上限无实际意义）。
 */
async function getWritingActivity(): Promise<{ activeDays: number, writingStreak: number }> {
  const today = new Date()
  const twoYearsAgo = new Date(today)
  twoYearsAgo.setFullYear(today.getFullYear() - 2)
  const startStr = formatDateTime(twoYearsAgo)
  const endStr = formatDateTime(today)

  // 连续天数回溯窗口：足够覆盖任何实际写作连续记录，避免拉取两年全量日期
  const STREAK_WINDOW_DAYS = 400
  const streakStart = new Date(today)
  streakStart.setDate(streakStart.getDate() - STREAK_WINDOW_DAYS)
  const streakStartStr = formatDateTime(streakStart)

  const [countRows, streakRows] = await Promise.all([
    // activeDays：交给 SQL 计数，无截断风险
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

// 内容块/资源块类型集合：totalBlocks、totalAssets、codeBlocks 由块类型分布派生，避免重复全表扫描
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

    const [combinedResult, totalImages, blockTypeStats, notebookCount, writingActivity] = await Promise.all([
      executeSql(combinedSql),
      getTotalImages(),
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
      totalImages,
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
