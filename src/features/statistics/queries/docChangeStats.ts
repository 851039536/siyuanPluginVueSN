import type { ChangedDoc, RecentUpdatedDoc } from "../types"
import { lsNotebooks } from "@/api"
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
    LIMIT 512
  `
  const modifiedDocsSql = `
    SELECT id, content, updated FROM blocks
    WHERE type = 'd'
      AND substr(updated, 1, 8) = '${dateStr}'
      AND substr(created, 1, 8) != '${dateStr}'
    ORDER BY updated DESC
    LIMIT 512
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
    LIMIT 1024
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
    LIMIT 1024
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

/**
 * 获取最近更新的文档列表
 * 按 updated 降序排列，返回最近 N 条记录
 */
export async function getRecentUpdatedDocs(limit: number = 20): Promise<RecentUpdatedDoc[]> {
  // 获取笔记本映射表
  const idToName = new Map<string, string>()
  try {
    const nbData = await lsNotebooks()
    const notebooks = nbData?.notebooks?.filter((nb: any) => !nb.closed) ?? []
    for (const nb of notebooks) {
      idToName.set(nb.id, nb.name)
    }
  } catch (e) {
    console.error("获取笔记本列表失败:", e)
  }

  const sql = `
    SELECT id, content, updated, box FROM blocks
    WHERE type = 'd'
    ORDER BY updated DESC
    LIMIT ${limit}
  `

  const rows = await executeSql(sql)
  if (!rows || rows.length === 0) return []

  return rows.map((r: any) => {
    const updated = r.updated || ""
    // 将 YYYYMMDDHHmmss 转换为可读时间
    let timeLabel = ""
    if (updated.length >= 14) {
      const y = updated.substring(0, 4)
      const mo = updated.substring(4, 6)
      const d = updated.substring(6, 8)
      const h = updated.substring(8, 10)
      const mi = updated.substring(10, 12)
      timeLabel = `${y}-${mo}-${d} ${h}:${mi}`
    } else if (updated.length >= 8) {
      const y = updated.substring(0, 4)
      const mo = updated.substring(4, 6)
      const d = updated.substring(6, 8)
      timeLabel = `${y}-${mo}-${d}`
    }

    return {
      id: r.id,
      title: (r.content || "").replace(/<[^>]*>/g, ""),
      updated,
      timeLabel,
      notebookName: idToName.get(r.box) || "",
    }
  })
}
