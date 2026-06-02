import type {
  BlockTypeStat,
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
  executeSql,
  formatDateTime,
} from "./executeSql"
import {
  getDailyStats,
  getMonthlyStatsRange,
  getWeeklyStats,
  getYearlyStats,
} from "./timeStats"

async function getTotalTags(): Promise<number> {
  const sql = `
    SELECT
      COALESCE((SELECT COUNT(DISTINCT content) FROM spans WHERE type='tag'), 0) +
      COALESCE((SELECT COUNT(DISTINCT value) FROM attributes WHERE name='tags' AND value IS NOT NULL AND value != ''), 0) +
      COALESCE((SELECT COUNT(DISTINCT content) FROM blocks WHERE type='tag'), 0) as totalTags
  `
  const result = await executeSql(sql)
  return Number(result[0]?.totalTags || 0)
}

export async function getTotalImages(): Promise<number> {
  const isImageFile = (filename: string): boolean => {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf("."))
    return IMAGE_EXTENSIONS.includes(ext)
  }

  const countImagesInDirectory = async (path: string): Promise<number> => {
    let count = 0
    try {
      const result = await readDir(path)
      if (!result) return 0

      const files = Array.isArray(result) ? result : [result]

      for (const file of files) {
        const fullPath = `${path}/${file.name}`

        if (file.isDir) {
          count += await countImagesInDirectory(fullPath)
        } else if (isImageFile(file.name)) {
          count++
        }
      }
    } catch (error) {
      console.error(`统计目录图片失败 ${path}:`, error)
    }
    return count
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
    return data.notebooks.filter((nb: any) => !nb.closed).length
  } catch {
    return 0
  }
}

async function getCodeBlocks(): Promise<number> {
  const result = await executeSql("SELECT COUNT(*) as cnt FROM blocks WHERE type = 'c'")
  return Number(result[0]?.cnt || 0)
}

async function getWritingActivity(): Promise<{ activeDays: number, writingStreak: number }> {
  // Get distinct dates with any create/update activity in the last 2 years
  const today = new Date()
  const twoYearsAgo = new Date(today)
  twoYearsAgo.setFullYear(today.getFullYear() - 2)
  const startStr = formatDateTime(twoYearsAgo)
  const endStr = formatDateTime(today)

  const rows = await executeSql(`
    SELECT DISTINCT substr(created, 1, 8) as date FROM blocks
    WHERE type = 'd' AND created >= '${startStr}' AND created <= '${endStr}'
    UNION
    SELECT DISTINCT substr(updated, 1, 8) as date FROM blocks
    WHERE type = 'd' AND updated >= '${startStr}' AND updated <= '${endStr}'
  `)

  if (!rows || rows.length === 0) { return {
    activeDays: 0,
    writingStreak: 0,
  }
  }

  const activeDateSet = new Set<string>()
  for (const row of rows) {
    const d = String(row.date || "")
    if (d.length >= 8) activeDateSet.add(d.substring(0, 8))
  }

  const activeDays = activeDateSet.size

  // Calculate streak: count consecutive days ending today
  const pad = (n: number) => n < 10 ? `0${n}` : `${n}`
  let streak = 0
  const checkDate = new Date(today)
  // Include today if active, otherwise start from yesterday
  const todayKey = `${checkDate.getFullYear()}${pad(checkDate.getMonth() + 1)}${pad(checkDate.getDate())}`
  if (!activeDateSet.has(todayKey)) {
    checkDate.setDate(checkDate.getDate() - 1)
  }

  while (true) {
    const key = `${checkDate.getFullYear()}${pad(checkDate.getMonth() + 1)}${pad(checkDate.getDate())}`
    if (activeDateSet.has(key)) {
      streak++
      checkDate.setDate(checkDate.getDate() - 1)
    } else {
      break
    }
  }

  return {
    activeDays,
    writingStreak: streak,
  }
}

export async function getBlockTypeStats(): Promise<BlockTypeStat[]> {
  try {
    const sqlStmt = `
      SELECT type, COUNT(*) as cnt
      FROM blocks
      GROUP BY type
      ORDER BY cnt DESC
    `
    const rows = await executeSql(sqlStmt)
    if (!rows || rows.length === 0) return []

    return rows.map((row: any) => ({
      name: row.type,
      count: Number(row.cnt || 0),
      label: BLOCK_TYPE_LABELS[row.type] || row.type,
    }))
  } catch (error) {
    console.error("获取块类型统计失败:", error)
    return []
  }
}

export async function getStatistics(viewMode: string, options: {
  dayRange: number
  monthYearRange: number
  selectedYear: number
}): Promise<StatisticsData> {
  try {
    const today = new Date()
    const todayStr = formatDateTime(today).substring(0, 8)

    const combinedSql = `
      SELECT
        (SELECT COUNT(DISTINCT root_id) FROM blocks WHERE type='d') as totalNotes,
        (SELECT SUM(LENGTH(content)) FROM blocks WHERE type = 'p' AND content IS NOT NULL AND content != '') as totalWords,
        (SELECT COUNT(*) FROM blocks WHERE type IN ('p', 'h', 'l', 'i', 't', 'c', 'html', 'query_embed')) as totalBlocks,
        (SELECT COUNT(*) FROM blocks WHERE type IN ('img', 'audio', 'video', 'widget', 'iframe')) as totalAssets,
        (SELECT COUNT(DISTINCT block_id) FROM refs) as totalBacklinks,
        (SELECT COUNT(DISTINCT root_id) FROM blocks WHERE type='d' AND substr(created, 1, 8) = '${todayStr}') as todayCreated,
        (SELECT COUNT(DISTINCT root_id) FROM blocks WHERE type='d' AND substr(updated, 1, 8) = '${todayStr}') as todayModified
    `

    const [combinedResult, totalTags, totalImages, blockTypeStats, notebookCount, codeBlocks, writingActivity] = await Promise.all([
      executeSql(combinedSql),
      getTotalTags(),
      getTotalImages(),
      getBlockTypeStats(),
      getNotebookCount(),
      getCodeBlocks(),
      getWritingActivity(),
    ])

    const baseStats = combinedResult[0] || {}
    const totalNotes = Number(baseStats.totalNotes || 0)
    const totalWords = Number(baseStats.totalWords || 0)
    const totalBlocks = Number(baseStats.totalBlocks || 0)
    const totalAssets = Number(baseStats.totalAssets || 0)
    const totalBacklinks = Number(baseStats.totalBacklinks || 0)
    const todayCreated = Number(baseStats.todayCreated || 0)
    const todayModified = Number(baseStats.todayModified || 0)

    const avgWordsPerDoc = totalNotes > 0 ? Math.round(totalWords / totalNotes) : 0

    let dailyStats = [] as any[]
    let currentPeriod = ""
    let periodTotalWords = 0
    const sumWords = (items: any[]) => items.reduce((sum: number, item: any) => sum + item.words, 0)

    const DAY_PERIOD_MAP: Record<number, string> = {
      7: "最近一周每日字数",
      15: "最近15天每日字数",
      30: "最近30天每日字数",
      90: "最近一季度每日字数",
      180: "最近半年每日字数",
      365: "最近一年每日字数",
    }
    const MONTH_PERIOD_MAP: Record<number, string> = {
      1: "最近一年每月字数",
      2: "最近两年每月字数",
      3: "最近三年每月字数",
    }

    switch (viewMode) {
      case "day":
        dailyStats = await getDailyStats(options.dayRange)
        currentPeriod = DAY_PERIOD_MAP[options.dayRange] || "每日字数统计"
        periodTotalWords = sumWords(dailyStats)
        break
      case "week":
        dailyStats = await getWeeklyStats(4)
        currentPeriod = "最近4周每周字数"
        periodTotalWords = sumWords(dailyStats)
        break
      case "month":
        dailyStats = await getMonthlyStatsRange(options.monthYearRange)
        currentPeriod = MONTH_PERIOD_MAP[options.monthYearRange] || "每月字数统计"
        periodTotalWords = sumWords(dailyStats)
        break
      case "year":
        dailyStats = await getYearlyStats(options.selectedYear)
        currentPeriod = `${options.selectedYear - 4} - ${options.selectedYear} 每年字数`
        periodTotalWords = sumWords(dailyStats)
        break
    }

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
