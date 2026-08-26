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
  /** 统计下钻时应用 0B 排除书签条件（主动文档查询保持全量，不开启） */
  excludeBookmarked?: boolean
}

/** 大小分档条件 */
export const SIZE_CONDITIONS: Record<string, string> = {
  "0B": "AND COALESCE(sw.total_size, 0) = 0",
  "small": "AND COALESCE(sw.total_size, 0) > 0 AND COALESCE(sw.total_size, 0) < 1024",
  "medium": "AND COALESCE(sw.total_size, 0) >= 1024 AND COALESCE(sw.total_size, 0) < 10240",
  "large": "AND COALESCE(sw.total_size, 0) >= 10240 AND COALESCE(sw.total_size, 0) < 102400",
  "xlarge": "AND COALESCE(sw.total_size, 0) >= 102400",
}

/** 更新时间分档天数（分析与下钻共用，避免魔法数字两处漂移） */
export const TIME_BIN_DAYS = {
  "7days": 7,
  "30days": 30,
  "1to2month": 60,
  "2to3month": 90,
  "halfYear": 180,
} as const

/** 时间区间相邻策略：7days→(>=7d), 30days→(>=30d,<7d)，以此类推 */
const TIME_INTERVALS: Record<string, [number, number | null]> = {
  "7days": [TIME_BIN_DAYS["7days"], null],
  "30days": [TIME_BIN_DAYS["30days"], TIME_BIN_DAYS["7days"]],
  "1to2month": [TIME_BIN_DAYS["1to2month"], TIME_BIN_DAYS["30days"]],
  "2to3month": [TIME_BIN_DAYS["2to3month"], TIME_BIN_DAYS["1to2month"]],
}

/** 按分类实时生成时间过滤条件（每次调用重新计算，避免时间戳在初始化时冻结） */
export function buildTimeConfig(category: string): DocQueryConfig | null {
  if (category === "halfYear") return { extraWhere: `AND b.updated < '${daysAgoStr(TIME_BIN_DAYS.halfYear)}'` }
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

/** EXISTS 模式分类条件映射（不写死具体书签值，仅保留二元维度） */
export const EXISTS_MAP: Record<string, string> = {
  hasBookmark: "AND bm.bookmark != ''",
  noBookmark: "AND b.id NOT IN (SELECT block_id FROM attributes WHERE name = 'bookmark')",
  hasAlias: existsCond("alias"),
  hasMemo: existsCond("memo"),
}
