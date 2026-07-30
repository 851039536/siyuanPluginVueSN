/**
 * SQL 转义、拼接与时间字符串工具
 */

/** 生成思源时间格式（yyyyMMddHHmmss）的 N 天前字符串 */
export function daysAgoStr(days: number): string {
  const d = new Date(Date.now() - days * 86400000)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

/** SQL 字符串转义（单引号→两个单引号） */
export function escapeSql(value: string): string {
  return value.replace(/'/g, "''")
}

/** LIKE 模式转义（单引号 + 通配符 \ % _），须配套 ESCAPE '\' 子句使用 */
export function escapeSqlLike(value: string): string {
  return escapeSql(value).replace(/([\\%_])/g, "\\$1")
}

/** SQL 字符串加引号（已含转义） */
export function quoteSql(value: string): string {
  return `'${escapeSql(value)}'`
}

/** 将可迭代值转为逗号分隔的 SQL 引号列表。注意：空集合返回空串，调用方必须自行守卫空集（否则拼出非法的 IN ()） */
export function quoteSqlList(values: Iterable<string>): string {
  return [...values].map(quoteSql).join(",")
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
