/**
 * 文档分析功能 - 统计分类查询条件配置
 */
import { daysAgoStr, escapeSql } from "./sqlHelpers"

/** 文档查询配置 */
export interface DocQueryConfig {
  extraSelect?: string
  extraJoin?: string
  extraWhere?: string
  orderBy?: string
  limit?: number
  bookmarkInner?: boolean
  skipSizeJoin?: boolean
}

/** 大小分档条件 */
export const SIZE_CONDITIONS: Record<string, string> = {
  "0B": "AND COALESCE(sw.total_size, 0) = 0",
  "small": "AND COALESCE(sw.total_size, 0) > 0 AND COALESCE(sw.total_size, 0) < 1024",
  "medium": "AND COALESCE(sw.total_size, 0) >= 1024 AND COALESCE(sw.total_size, 0) < 10240",
  "large": "AND COALESCE(sw.total_size, 0) >= 10240 AND COALESCE(sw.total_size, 0) < 102400",
  "xlarge": "AND COALESCE(sw.total_size, 0) >= 102400",
}

/** 时间区间相邻策略：7days→(>=7d), 30days→(>=30d,<7d)，以此类推 */
const TIME_INTERVALS: Record<string, [number, number | null]> = {
  "7days": [7, null],
  "30days": [30, 7],
  "1to2month": [60, 30],
  "2to3month": [90, 60],
}

/** 按分类实时生成时间过滤条件（每次调用重新计算，避免时间戳在初始化时冻结） */
export function buildTimeConfig(category: string): DocQueryConfig | null {
  if (category === "halfYear") return { extraWhere: `AND b.updated < '${daysAgoStr(180)}'` }
  const interval = TIME_INTERVALS[category]
  if (!interval) return null
  const [lower, upper] = interval
  let w = `AND b.updated >= '${daysAgoStr(lower)}'`
  if (upper !== null) w += ` AND b.updated < '${daysAgoStr(upper)}'`
  return { extraWhere: w }
}

/** EXISTS 模式书签/属性查询条件 */
function existsCond(attr: string, value?: string): string {
  const valCond = value ? ` AND a.value = '${escapeSql(value)}'` : " AND a.value != ''"
  return `AND EXISTS (SELECT 1 FROM attributes a WHERE a.name = '${attr}'${valCond} AND a.block_id = b.id LIMIT 1)`
}

/** EXISTS 模式分类条件映射 */
export const EXISTS_MAP: Record<string, string> = {
  hasBookmark: "AND bm.bookmark != '无'",
  noBookmark: "AND b.id NOT IN (SELECT block_id FROM attributes WHERE name = 'bookmark')",
  noneBookmark: existsCond("bookmark", "无"),
  pendingPublish: existsCond("bookmark", "待发布"),
  published: existsCond("bookmark", "已发布"),
  unused: existsCond("bookmark", "不使用"),
  hasAlias: existsCond("alias"),
  hasMemo: existsCond("memo"),
}
