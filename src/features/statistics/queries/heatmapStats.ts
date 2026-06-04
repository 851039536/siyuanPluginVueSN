import { executeSql, formatDateTime } from "./executeSql"

/**
 * 查询指定范围内每天的文档操作数
 * 替代本地 JSON 快照，通过思源 SQL 实时获取每日的操作数
 * @param months 月数（默认 12 个月 = 1 年）
 * @returns Map<date: YYYY-MM-DD, count: number>
 */
export async function getHeatmapActivityData(months: number = 12): Promise<Map<string, number>> {
  const today = new Date()
  const startDate = new Date(today)
  startDate.setMonth(startDate.getMonth() - months)
  const startStr = formatDateTime(startDate).substring(0, 8)

  const rows = await executeSql(`
    SELECT substr(updated, 1, 8) as date,
           COUNT(DISTINCT root_id) as cnt
    FROM blocks
    WHERE type = 'd'
      AND updated >= '${startStr}'
    GROUP BY substr(updated, 1, 8)
    ORDER BY date ASC
    LIMIT 1024
  `)

  // 转换为 Map<date, count>
  const activityMap = new Map<string, number>()
  for (const row of rows) {
    const dateStr = String(row.date || "")
    if (dateStr.length >= 8) {
      const key = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`
      const existingCount = activityMap.get(key) || 0
      activityMap.set(key, existingCount + Number(row.cnt || 0))
    }
  }
  return activityMap
}
