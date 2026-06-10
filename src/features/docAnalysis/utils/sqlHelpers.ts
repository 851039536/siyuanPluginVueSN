/**
 * SQL 转义与拼接工具
 */

/** SQL 字符串转义（单引号→两个单引号） */
export function escapeSql(value: string): string {
  return value.replace(/'/g, "''")
}

/** SQL 字符串加引号（已含转义） */
export function quoteSql(value: string): string {
  return `'${escapeSql(value)}'`
}

/** 将可迭代值转为逗号分隔的 SQL 引号列表 */
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
