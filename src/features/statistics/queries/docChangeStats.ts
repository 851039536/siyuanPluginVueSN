// 文档变更查询（指定日期/范围/最近更新）

import type {
  ChangedDoc,
  DateCountRow,
  DeletedDoc,
  DocBlockRow,
  RecentUpdatedDoc,
} from "../types"
import {
  getHistoryItems,
  lsNotebooks,
  searchHistory,
} from "@/api"
import {
  filterActiveNotebooks,
  formatYmd,
  isValidDateStr,
  mapChangedDocs,
  padZero,
} from "../utils"
import { executeSql } from "./executeSql"

/**
 * 通过思源数据历史获取日期范围内被删除的文档（含所属日期）。
 * 删除文档的块已从 blocks 表移除、无法 SQL 查询，故改用内核数据历史（op=delete）：
 * 1) searchHistory 拿到范围内的快照时间点；2) 逐时间点 getHistoryItems 拿被删除条目。
 * 依赖「数据历史」功能开启；时间为快照时间，为近似值。
 * @param startStr 起始日期 YYYYMMDD
 * @param endStr 结束日期 YYYYMMDD
 */
export async function getDeletedDocsInRange(
  startStr: string,
  endStr: string,
): Promise<DeletedDoc[]> {
  if (!isValidDateStr(startStr) || !isValidDateStr(endStr)) return []
  try {
    const result = await searchHistory("delete", 0, { page: 1 })
    const timestamps = result?.histories ?? []

    // 仅保留范围内的快照时间点
    const matched: Array<{ created: string, ymd: string, hm: string }> = []
    for (const ts of timestamps) {
      const sec = Number.parseInt(ts, 10)
      if (!Number.isFinite(sec)) continue
      const date = new Date(sec * 1000)
      const ymd = formatYmd(date)
      if (ymd < startStr || ymd > endStr) continue
      matched.push({
        created: ts,
        ymd,
        hm: `${padZero(date.getHours())}:${padZero(date.getMinutes())}`,
      })
    }
    if (matched.length === 0) return []

    // 逐时间点拉取被删除条目
    const itemsList = await Promise.all(
      matched.map((m) => getHistoryItems(m.created, "delete", 0)),
    )

    const deleted: DeletedDoc[] = []
    itemsList.forEach((res, i) => {
      const m = matched[i]
      for (const item of res?.items ?? []) {
        if (item.op && item.op !== "delete") continue
        const title = (item.title || "").replace(/<[^>]*>/g, "").trim()
        deleted.push({
          title: title || "无标题",
          time: m.hm,
          date: `${m.ymd.substring(4, 6)}/${m.ymd.substring(6, 8)}`,
        })
      }
    })
    return deleted
  } catch (e) {
    console.error("获取范围删除文档失败:", e)
    return []
  }
}

/**
 * 获取指定单日被删除的文档（复用范围查询）。
 * @param dateStr 紧凑日期字符串 YYYYMMDD
 */
export async function getDeletedDocs(dateStr: string): Promise<DeletedDoc[]> {
  return getDeletedDocsInRange(dateStr, dateStr)
}

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
    SELECT id, content, created FROM blocks
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
    executeSql<DocBlockRow>(newDocsSql),
    executeSql<DocBlockRow>(modifiedDocsSql),
  ])

  return {
    newDocs: mapChangedDocs(newRows || [], "created"),
    modifiedDocs: mapChangedDocs(modifiedRows || [], "updated"),
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
    executeSql<DateCountRow>(newSql),
    executeSql<DateCountRow>(modifiedSql),
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
  ;(newRows || []).forEach((r) => newMap.set(r.date, Number(r.cnt || 0)))
  ;(modifiedRows || []).forEach((r) => modifiedMap.set(r.date, Number(r.cnt || 0)))

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
    const notebooks = filterActiveNotebooks(nbData?.notebooks ?? [])
    for (const nb of notebooks) {
      idToName.set(nb.id, nb.name)
    }
  } catch (e) {
    console.error("获取笔记本列表失败:", e)
  }

  const sql = `
    SELECT id, content, created, updated, box FROM blocks
    WHERE type = 'd'
    ORDER BY updated DESC
    LIMIT ${limit}
  `

  const rows = await executeSql<DocBlockRow>(sql)
  if (!rows || rows.length === 0) return []

  return rows.map((r) => ({
    id: r.id,
    title: (r.content || "").replace(/<[^>]*>/g, ""),
    created: r.created || "",
    updated: r.updated || "",
    notebookName: idToName.get(r.box || "") || "",
  }))
}
