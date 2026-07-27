// 热力图数据查询（按指标/笔记本筛选）

import type {
  ChangedDoc,
  DateCountRow,
  HeatmapMetric,
} from "../types"
import { lsNotebooks } from "@/api"
import {
  filterActiveNotebooks,
  isValidDateStr,
} from "../utils"
import { getDateChangedDocs } from "./docChangeStats"
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

  const rows = await executeSql<DateCountRow>(sql)
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
 * 复用 getDateChangedDocs，热力图详情限 256 条
 * @param dateStr 日期字符串 YYYY-MM-DD
 */
export async function getHeatmapDailyDetail(dateStr: string): Promise<{
  newDocs: ChangedDoc[]
  modifiedDocs: ChangedDoc[]
}> {
  const yyyymmdd = dateStr.replace(/-/g, "")
  if (!isValidDateStr(yyyymmdd)) {
    console.warn("getHeatmapDailyDetail: 无效的日期参数", dateStr)
    return { newDocs: [], modifiedDocs: [] }
  }

  return getDateChangedDocs(yyyymmdd, 256)
}

/** 获取打开的笔记本列表（供筛选器使用） */
export async function getHeatmapNotebooks(): Promise<Array<{ id: string, name: string }>> {
  try {
    const nbData = await lsNotebooks()
    const notebooks = filterActiveNotebooks(nbData?.notebooks ?? [])
    return notebooks.map((nb) => ({
      id: nb.id,
      name: nb.name,
    }))
  } catch (e) {
    console.error("获取笔记本列表失败:", e)
    return []
  }
}
