/**
 * 公共 SQL 工具集：字符串转义与引号列表拼接
 * 供各功能模块复用，收敛 escapeSql 等项目内复制粘贴
 */
export function escapeSql(value: string): string {
  return value.replace(/'/g, "''")
}

/** SQL 字符串加引号（已含转义） */
export function quoteSql(value: string): string {
  return `'${escapeSql(value)}'`
}

/** 将可迭代值转为逗号分隔的 SQL 引号列表。注意：空集合返回空串，调用方必须自行守卫空集（否则拼出非法的 IN ()） */
export function quoteSqlList(values: Iterable<string>): string {
  return [...values].map(quoteSql).join(",")
}
