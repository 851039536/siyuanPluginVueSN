/**
 * 文档分析功能 - SQL 子句构建工具
 * 通用转义（escapeSql / quoteSql / quoteSqlList）统一复用 @/utils/sqlHelpers，
 * 本文件只保留文档分析特有的时间字符串与 IN / 排除书签子句。
 */
import { quoteSqlList } from "@/utils/sqlHelpers"

/** 生成思源时间格式（yyyyMMddHHmmss）的 N 天前字符串 */
export function daysAgoStr(days: number): string {
  const d = new Date(Date.now() - days * 86400000)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

/** SQL IN 子句（空集返回 AND 1 = 0） */
export function buildIdInClause(ids: Set<string>): string {
  if (ids.size === 0) return "AND 1 = 0"
  return `AND b.id IN (${quoteSqlList(ids)})`
}

/** SQL NOT IN 子句（空集返回空字符串） */
export function buildIdNotInClause(ids: Set<string>): string {
  if (ids.size === 0) return ""
  return `AND b.id NOT IN (${quoteSqlList(ids)})`
}

/**
 * 0B 排除书签 SQL 子句：带被排除书签的文档整体剔除（空列表返回空串，零开销）
 * @param bookmarks 排除书签值列表
 * @param idExpr 文档 ID 列表达式（默认无别名 id，兼容无别名 SQL；带别名的调用传 "b.id"）
 */
export function buildBookmarkExcludeClause(bookmarks: string[], idExpr = "id"): string {
  if (bookmarks.length === 0) return ""
  return `AND ${idExpr} NOT IN (SELECT block_id FROM attributes WHERE name = 'bookmark' AND value IN (${quoteSqlList(bookmarks)}))`
}
