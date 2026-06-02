import type { ChangedDoc } from "../types"
import {
  isValidDateStr,
  padZero,
} from "../utils"
import { executeSql } from "./executeSql"

export async function getDateChangedDocs(dateStr: string): Promise<{
  newDocs: ChangedDoc[]
  modifiedDocs: ChangedDoc[]
}> {
  if (!isValidDateStr(dateStr)) {
    console.warn("getDateChangedDocs: 无效的日期参数", dateStr)
    return {
      newDocs: [],
      modifiedDocs: [],
    }
  }

  const newDocsSql = `
    SELECT id, content FROM blocks
    WHERE type = 'd' AND substr(created, 1, 8) = '${dateStr}'
    ORDER BY created ASC
  `
  const modifiedDocsSql = `
    SELECT id, content, updated FROM blocks
    WHERE type = 'd'
      AND substr(updated, 1, 8) = '${dateStr}'
      AND substr(created, 1, 8) != '${dateStr}'
    ORDER BY updated DESC
  `

  const [newRows, modifiedRows] = await Promise.all([
    executeSql(newDocsSql),
    executeSql(modifiedDocsSql),
  ])

  return {
    newDocs: (newRows || []).map((r: any) => ({
      id: r.id,
      title: (r.content || "").replace(/<[^>]*>/g, ""),
    })),
    modifiedDocs: (modifiedRows || []).map((r: any) => ({
      id: r.id,
      title: (r.content || "").replace(/<[^>]*>/g, ""),
      updated: r.updated,
    })),
  }
}

export async function getDateRangeChangeStats(startStr: string, endStr: string): Promise<
  Array<{ date: string, newCount: number, modifiedCount: number }>
> {
  if (!isValidDateStr(startStr) || !isValidDateStr(endStr)) {
    console.warn("getDateRangeChangeStats: 无效的日期参数", {
      startStr,
      endStr,
    })
    return []
  }

  const newSql = `
    SELECT substr(created, 1, 8) as date, COUNT(*) as cnt
    FROM blocks
    WHERE type = 'd'
      AND substr(created, 1, 8) >= '${startStr}'
      AND substr(created, 1, 8) <= '${endStr}'
    GROUP BY substr(created, 1, 8)
    ORDER BY date ASC
  `
  const modifiedSql = `
    SELECT substr(updated, 1, 8) as date, COUNT(*) as cnt
    FROM blocks
    WHERE type = 'd'
      AND substr(updated, 1, 8) >= '${startStr}'
      AND substr(updated, 1, 8) <= '${endStr}'
      AND substr(created, 1, 8) != substr(updated, 1, 8)
    GROUP BY substr(updated, 1, 8)
    ORDER BY date ASC
  `

  const [newRows, modifiedRows] = await Promise.all([
    executeSql(newSql),
    executeSql(modifiedSql),
  ])

  const result: Array<{ date: string, newCount: number, modifiedCount: number }> = []
  const startDate = new Date(
    Number.parseInt(startStr.substring(0, 4)),
    Number.parseInt(startStr.substring(4, 6)) - 1,
    Number.parseInt(startStr.substring(6, 8)),
  )
  const endDate = new Date(
    Number.parseInt(endStr.substring(0, 4)),
    Number.parseInt(endStr.substring(4, 6)) - 1,
    Number.parseInt(endStr.substring(6, 8)),
  )

  const newMap = new Map<string, number>()
  const modifiedMap = new Map<string, number>()
  ;(newRows || []).forEach((r: any) => newMap.set(r.date, Number(r.cnt || 0)))
  ;(modifiedRows || []).forEach((r: any) => modifiedMap.set(r.date, Number(r.cnt || 0)))

  for (
    let d = new Date(startDate);
    d <= endDate;
    d.setDate(d.getDate() + 1)
  ) {
    const dateStr = `${d.getFullYear()}${padZero(d.getMonth() + 1)}${padZero(d.getDate())}`
    result.push({
      date: dateStr,
      newCount: newMap.get(dateStr) || 0,
      modifiedCount: modifiedMap.get(dateStr) || 0,
    })
  }

  return result
}
