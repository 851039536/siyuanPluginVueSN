// 笔记本分布查询（文档数/字数/活跃度）

import type {
  DailyWordCount,
  NotebookActivityItem,
  NotebookActivityRow,
  NotebookDocCount,
  NotebookDocCountRow,
  NotebookWordRow,
  NotebookWordStat,
} from "../types"
import { lsNotebooks } from "@/api"
import { NOTEBOOK_COLORS } from "../types/constants"
import {
  filterActiveNotebooks,
  formatDate,
  formatYmd,
} from "../utils"
import {
  executeSql,
  formatDateTime,
} from "./executeSql"

interface OpenNotebooks {
  notebooks: Notebook[]
  idList: string
  idToName: Map<string, string>
}

/** Module-level cache (Promise + 10s TTL)：缓存 Promise 本身，并发调用共享同一次 lsNotebooks 请求 */
let _cache: { data: Promise<OpenNotebooks>, ts: number } | null = null
const CACHE_TTL = 10_000

function getOpenNotebooks(): Promise<OpenNotebooks> {
  const now = Date.now()
  if (_cache && now - _cache.ts < CACHE_TTL) return _cache.data

  const dataPromise = (async (): Promise<OpenNotebooks> => {
    const data = await lsNotebooks()
    const notebooks = filterActiveNotebooks(data?.notebooks ?? [])
    const idList = notebooks
      .map((nb) => `'${nb.id.replace(/'/g, "''")}'`)
      .join(",")
    const idToName = new Map<string, string>()
    for (const nb of notebooks) {
      idToName.set(nb.id, nb.name)
    }
    return {
      notebooks,
      idList,
      idToName,
    }
  })()
  // 失败不缓存：清除后下一次调用重新发起请求，避免 10 秒内持续拿到 rejected Promise
  dataPromise.catch(() => {
    if (_cache?.data === dataPromise) {
      _cache = null
    }
  })
  _cache = {
    data: dataPromise,
    ts: now,
  }
  return dataPromise
}

export async function getNotebookDocStats(): Promise<NotebookDocCount[]> {
  try {
    const {
      notebooks,
      idList,
      idToName,
    } = await getOpenNotebooks()
    if (notebooks.length === 0) return []

    const rows = await executeSql<NotebookDocCountRow>(`
      SELECT box as notebook_id, COUNT(*) as doc_count
      FROM blocks
      WHERE type = 'd' AND box IN (${idList})
      GROUP BY box
      ORDER BY doc_count DESC
    `)

    const result: NotebookDocCount[] = []
    const seen = new Set<string>()

    if (rows && rows.length > 0) {
      for (const row of rows) {
        // box IN 已过滤为已知笔记本，兜底仅为防御（不可达）
        const name = idToName.get(row.notebook_id) || ""
        result.push({
          name,
          count: Number(row.doc_count || 0),
        })
        seen.add(row.notebook_id)
      }
    }

    for (const nb of notebooks) {
      if (!seen.has(nb.id)) {
        result.push({
          name: nb.name,
          count: 0,
        })
      }
    }

    return result
  } catch (error) {
    console.error("获取笔记本文档统计失败:", error)
    return []
  }
}

export async function getNotebookWordStats(): Promise<NotebookWordStat[]> {
  try {
    const {
      notebooks,
      idList,
      idToName,
    } = await getOpenNotebooks()
    if (notebooks.length === 0) return []

    const rows = await executeSql<NotebookWordRow>(`
      SELECT box as notebook_id, SUM(length) as words
      FROM blocks
      WHERE type = 'p' AND length > 0 AND box IN (${idList})
      GROUP BY box
      ORDER BY words DESC
    `)

    const result: NotebookWordStat[] = []
    const seen = new Set<string>()
    let totalWordsAll = 0

    if (rows && rows.length > 0) {
      for (const row of rows) {
        const name = idToName.get(row.notebook_id) || ""
        const words = Number(row.words || 0)
        totalWordsAll += words
        result.push({
          name,
          words,
          percentage: 0,
          color: "",
        })
        seen.add(row.notebook_id)
      }
    }

    for (const nb of notebooks) {
      if (!seen.has(nb.id)) {
        result.push({
          name: nb.name,
          words: 0,
          percentage: 0,
          color: "",
        })
      }
    }

    result.forEach((item, idx) => {
      item.percentage = totalWordsAll > 0
        ? Math.round((item.words / totalWordsAll) * 1000) / 10
        : 0
      item.color = NOTEBOOK_COLORS[idx % NOTEBOOK_COLORS.length]
    })

    return result
  } catch (error) {
    console.error("获取笔记本字数统计失败:", error)
    return []
  }
}

export async function getNotebookActivityTrend(days: number): Promise<NotebookActivityItem[]> {
  try {
    const {
      notebooks,
      idList,
      idToName,
    } = await getOpenNotebooks()
    if (notebooks.length === 0) return []

    const today = new Date()
    const startDate = new Date(today)
    startDate.setDate(today.getDate() - days + 1)
    startDate.setHours(0, 0, 0, 0)

    const startStr = formatDateTime(startDate)
    const endStr = formatDateTime(today)

    const rows = await executeSql<NotebookActivityRow>(`
      SELECT box as notebook_id, substr(created, 1, 8) as date, SUM(length) as words
      FROM blocks
      WHERE type = 'p'
        AND length > 0
        AND box IN (${idList})
        AND created >= '${startStr}'
        AND created <= '${endStr}'
      GROUP BY box, substr(created, 1, 8)
      ORDER BY date ASC
      LIMIT 2048
    `)

    const pivot = new Map<string, Map<string, number>>()
    if (rows) {
      for (const row of rows) {
        const nbId = row.notebook_id
        const dateStr = String(row.date)
        const words = Number(row.words || 0)
        if (!pivot.has(nbId)) {
          pivot.set(nbId, new Map())
        }
        pivot.get(nbId)!.set(dateStr, words)
      }
    }

    const result: NotebookActivityItem[] = []
    notebooks.forEach((nb, idx) => {
      const dayMap = pivot.get(nb.id) || new Map()
      const dailyData: DailyWordCount[] = []

      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today)
        date.setDate(today.getDate() - i)
        date.setHours(0, 0, 0, 0)
        const words = dayMap.get(formatYmd(date)) || 0

        dailyData.push({
          date: formatDate(date),
          words,
          dateLabel: `${date.getMonth() + 1}/${date.getDate()}`,
        })
      }

      result.push({
        notebook: idToName.get(nb.id) || "",
        data: dailyData,
        color: NOTEBOOK_COLORS[idx % NOTEBOOK_COLORS.length],
      })
    })

    return result
  } catch (error) {
    console.error("获取笔记本活跃度趋势失败:", error)
    return []
  }
}

export async function getMostProductiveNotebook(
  startStr: string,
  endStr: string,
): Promise<{ name: string, words: number }> {
  try {
    const {
      notebooks,
      idList,
      idToName,
    } = await getOpenNotebooks()
    if (notebooks.length === 0) { return {
      name: "",
      words: 0,
    }
    }

    const rows = await executeSql<NotebookWordRow>(`
      SELECT box as notebook_id, SUM(length) as words
      FROM blocks
      WHERE type = 'p' AND length > 0 AND box IN (${idList})
        AND created >= '${startStr}' AND created <= '${endStr}'
      GROUP BY box
      ORDER BY words DESC
      LIMIT 1
    `)

    if (rows.length > 0) {
      return {
        name: idToName.get(rows[0].notebook_id) || "",
        words: Number(rows[0].words || 0),
      }
    }

    return {
      name: notebooks[0].name,
      words: 0,
    }
  } catch {
    return {
      name: "",
      words: 0,
    }
  }
}
