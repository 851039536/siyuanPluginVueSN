// SQL 查询执行工具 + 日期格式化

import { sql } from "@/api"
import { padZero } from "../utils"

export async function executeSql(stmt: string): Promise<any[]> {
  try {
    return (await sql(stmt)) || []
  } catch (error) {
    console.error("SQL 查询异常:", error)
    return []
  }
}

export function formatDateTime(date: Date): string {
  const year = date.getFullYear()
  const month = padZero(date.getMonth() + 1)
  const day = padZero(date.getDate())
  const hour = padZero(date.getHours())
  const minute = padZero(date.getMinutes())
  const second = padZero(date.getSeconds())
  return `${year}${month}${day}${hour}${minute}${second}`
}
