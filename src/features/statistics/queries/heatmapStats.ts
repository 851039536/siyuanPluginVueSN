import type { ChangedDoc, HeatmapMetric } from "../types"
import { lsNotebooks } from "@/api"
import { isValidDateStr } from "../utils"
import { formatTime } from "../utils"
import {
  executeSql,
  formatDateTime,
} from "./executeSql"

/**
 * 查询指定范围内每天的活动数据
 * @param months 月数
 * @param metric 指标类型
 * @param notebookId 可选笔记本过滤
 * @returns Map<date: YYYY-MM-DD, count: number>
 */
export async function getHeatmapActivityData(
  months: number = 12,
  metric: HeatmapMetric = 'docsModified',
  notebookId?: string,
): Promise<Map<string, number>> {
  const today = new Date()
  const startDate = new Date(today)
  startDate.setMonth(startDate.getMonth() - months)
  const startStr = formatDateTime(startDate).substring(0, 8)

  const boxFilter = notebookId ? `AND box = '${notebookId.replace(/'/g, "''")}'` : ''

  let sql: string
  switch (metric) {
    case 'docsCreated':
      sql = `
        SELECT substr(created, 1, 8) as date,
               COUNT(DISTINCT root_id) as cnt
        FROM blocks
        WHERE type = 'd'
          AND created >= '${startStr}'
          ${boxFilter}
        GROUP BY substr(created, 1, 8)
        ORDER BY date ASC
        LIMIT 1024
      `
      break
    case 'blockEdits':
      sql = `
        SELECT substr(updated, 1, 8) as date,
               COUNT(*) as cnt
        FROM blocks
        WHERE type = 'p'
          AND updated >= '${startStr}'
          ${boxFilter}
        GROUP BY substr(updated, 1, 8)
        ORDER BY date ASC
        LIMIT 1024
      `
      break
    case 'docsModified':
    default:
      sql = `
        SELECT substr(updated, 1, 8) as date,
               COUNT(DISTINCT root_id) as cnt
        FROM blocks
        WHERE type = 'd'
          AND updated >= '${startStr}'
          ${boxFilter}
        GROUP BY substr(updated, 1, 8)
        ORDER BY date ASC
        LIMIT 1024
      `
  }

  const rows = await executeSql(sql)
  const activityMap = new Map<string, number>()
  for (const row of rows) {
    const dateStr = String(row.date || "")
    if (dateStr.length >= 8) {
      const key = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`
      activityMap.set(key, Number(row.cnt || 0))
    }
  }
  return activityMap
}

/**
 * 查询某天的文档变更详情（新增 + 修改）
 */
export async function getHeatmapDailyDetail(dateStr: string): Promise<{
  newDocs: ChangedDoc[]
  modifiedDocs: ChangedDoc[]
}> {
  if (dateStr.length < 8) { return {
    newDocs: [],
    modifiedDocs: [],
  }
  }
  const yyyymmdd = dateStr.replace(/-/g, "")
  if (!isValidDateStr(yyyymmdd)) {
    console.warn("getHeatmapDailyDetail: 无效的日期参数", dateStr)
    return { newDocs: [], modifiedDocs: [] }
  }

  const newDocsSql = `
    SELECT id, content, created FROM blocks
    WHERE type = 'd' AND substr(created, 1, 8) = '${yyyymmdd}'
    ORDER BY created ASC
    LIMIT 256
  `
  const modifiedDocsSql = `
    SELECT id, content, updated FROM blocks
    WHERE type = 'd'
      AND substr(updated, 1, 8) = '${yyyymmdd}'
      AND substr(created, 1, 8) != '${yyyymmdd}'
    ORDER BY updated DESC
    LIMIT 256
  `

  const [newRows, modifiedRows] = await Promise.all([
    executeSql(newDocsSql),
    executeSql(modifiedDocsSql),
  ])

  return {
    newDocs: (newRows || []).map((r: any) => ({
      id: r.id,
      title: (r.content || "").replace(/<[^>]*>/g, ""),
      time: formatTime(r.created),
    })),
    modifiedDocs: (modifiedRows || []).map((r: any) => ({
      id: r.id,
      title: (r.content || "").replace(/<[^>]*>/g, ""),
      time: formatTime(r.updated),
    })),
  }
}

/** 获取打开的笔记本列表（供筛选器使用） */
export async function getHeatmapNotebooks(): Promise<Array<{ id: string, name: string }>> {
  try {
    const nbData = await lsNotebooks()
    const notebooks = nbData?.notebooks?.filter((nb: any) => !nb.closed) ?? []
    return notebooks.map((nb: any) => ({
      id: nb.id,
      name: nb.name,
    }))
  } catch (e) {
    console.error("获取笔记本列表失败:", e)
    return []
  }
}
