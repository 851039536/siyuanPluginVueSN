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
  stripTags,
} from "../utils"
import { executeSql } from "./executeSql"

// YYYYMMDD 字符串 → Date（本地时区零点）
function parseYmd(ymd: string): Date {
  return new Date(
    Number.parseInt(ymd.substring(0, 4)),
    Number.parseInt(ymd.substring(4, 6)) - 1,
    Number.parseInt(ymd.substring(6, 8)),
  )
}

// 删除历史翻页保护上限，防止异常数据导致无限翻页
const MAX_HISTORY_PAGES = 32

/**
 * 通过思源数据历史获取日期范围内被删除的文档（含所属日期）。
 * 删除文档的块已从 blocks 表移除、无法 SQL 查询，故改用内核数据历史（op=delete）：
 * 1) searchHistory 逐页拿到范围内的快照时间点；2) 逐时间点 getHistoryItems 拿被删除条目。
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
    // 逐页收集范围内的快照时间点（histories 按时间倒序，翻到早于起始日期即可停止）
    const matched: Array<{ created: string, ymd: string, hm: string }> = []
    let page = 1
    let pageCount = 1
    let reachedBeforeRange = false
    while (page <= pageCount && page <= MAX_HISTORY_PAGES && !reachedBeforeRange) {
      const result = await searchHistory("delete", 0, { page })
      const timestamps = result?.histories ?? []
      if (timestamps.length === 0) break
      pageCount = result?.pageCount ?? page

      for (const ts of timestamps) {
        const sec = Number.parseInt(ts, 10)
        if (!Number.isFinite(sec)) continue
        const date = new Date(sec * 1000)
        const ymd = formatYmd(date)
        if (ymd < startStr) {
          reachedBeforeRange = true
          break
        }
        if (ymd > endStr) continue
        matched.push({
          created: ts,
          ymd,
          hm: `${padZero(date.getHours())}:${padZero(date.getMinutes())}`,
        })
      }
      page++
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
        deleted.push({
          // 标题可能为空，由视图层用 i18n.untitled 兜底
          title: stripTags(item.title || "").trim(),
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

export async function getDateChangedDocs(dateStr: string, limit: number = 512): Promise<{
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

  const safeLimit = Math.max(1, Math.floor(limit))
  // WHERE 使用范围比较（而非 substr 包裹列），保持 sargable
  const newDocsSql = `
    SELECT id, content, created FROM blocks
    WHERE type = 'd'
      AND created >= '${dateStr}000000' AND created <= '${dateStr}235959'
    ORDER BY created ASC
    LIMIT ${safeLimit}
  `
  const modifiedDocsSql = `
    SELECT id, content, updated FROM blocks
    WHERE type = 'd'
      AND updated >= '${dateStr}000000' AND updated <= '${dateStr}235959'
      AND substr(created, 1, 8) != '${dateStr}'
    ORDER BY updated DESC
    LIMIT ${safeLimit}
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

  // WHERE 使用范围比较（而非 substr 包裹列），保持 sargable；GROUP BY 的 substr 为语义必需
  const newSql = `
    SELECT substr(created, 1, 8) as date, COUNT(*) as cnt
    FROM blocks
    WHERE type = 'd'
      AND created >= '${startStr}000000'
      AND created <= '${endStr}235959'
    GROUP BY substr(created, 1, 8)
    ORDER BY date ASC
    LIMIT 1024
  `
  const modifiedSql = `
    SELECT substr(updated, 1, 8) as date, COUNT(*) as cnt
    FROM blocks
    WHERE type = 'd'
      AND updated >= '${startStr}000000'
      AND updated <= '${endStr}235959'
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
  const startDate = parseYmd(startStr)
  const endDate = parseYmd(endStr)

  const newMap = new Map<string, number>()
  const modifiedMap = new Map<string, number>()
  ;(newRows || []).forEach((r) => newMap.set(r.date, Number(r.cnt || 0)))
  ;(modifiedRows || []).forEach((r) => modifiedMap.set(r.date, Number(r.cnt || 0)))

  for (
    let d = new Date(startDate);
    d <= endDate;
    d.setDate(d.getDate() + 1)
  ) {
    const dateStr = formatYmd(d)
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
  const sql = `
    SELECT id, content, created, updated, box FROM blocks
    WHERE type = 'd'
    ORDER BY updated DESC
    LIMIT ${Math.max(1, Math.floor(limit))}
  `

  // 笔记本映射表与文档查询无依赖，并行请求
  const [nbData, rows] = await Promise.all([
    lsNotebooks().catch((e) => {
      console.error("获取笔记本列表失败:", e)
      return null
    }),
    executeSql<DocBlockRow>(sql),
  ])

  const idToName = new Map<string, string>()
  for (const nb of filterActiveNotebooks(nbData?.notebooks ?? [])) {
    idToName.set(nb.id, nb.name)
  }

  if (!rows || rows.length === 0) return []

  return rows.map((r) => ({
    id: r.id,
    title: stripTags(r.content || ""),
    created: r.created || "",
    updated: r.updated || "",
    notebookName: idToName.get(r.box || "") || "",
  }))
}
