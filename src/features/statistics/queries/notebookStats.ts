// 笔记本分布查询（文档数/字数/活跃度/块类型）

import type {
  DailyWordCount,
  NotebookActivityItem,
  NotebookActivityRow,
  NotebookBlockTypeRow,
  NotebookBlockTypeStat,
  NotebookDocCountRow,
  NotebookWordRow,
  NotebookWordStat,
  NotebookWordSumRow,
} from "../types"
import { lsNotebooks } from "@/api"
import {
  BLOCK_TYPE_LABELS,
  NOTEBOOK_COLORS,
} from "../types/constants"
import {
  filterActiveNotebooks,
  padZero,
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

/** Module-level cache with 10s TTL to avoid repeated lsNotebooks calls within one refresh cycle */
let _cache: { data: OpenNotebooks, ts: number } | null = null
const CACHE_TTL = 10_000

async function getOpenNotebooks(): Promise<OpenNotebooks> {
  const now = Date.now()
  if (_cache && now - _cache.ts < CACHE_TTL) return _cache.data

  const data = await lsNotebooks()
  const notebooks = filterActiveNotebooks(data?.notebooks ?? [])
  const idList = notebooks
    .map((nb) => `'${nb.id.replace(/'/g, "''")}'`)
    .join(",")
  const idToName = new Map<string, string>()
  for (const nb of notebooks) {
    idToName.set(nb.id, nb.name)
  }

  const result: OpenNotebooks = {
    notebooks,
    idList,
    idToName,
  }
  _cache = {
    data: result,
    ts: now,
  }
  return result
}

export async function getNotebookDocStats(): Promise<Array<{ name: string, count: number }>> {
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

    const result: Array<{ name: string, count: number }> = []
    const seen = new Set<string>()

    if (rows && rows.length > 0) {
      for (const row of rows) {
        const name = idToName.get(row.notebook_id) || "未知笔记本"
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
      SELECT box as notebook_id, SUM(length) as total_words
      FROM blocks
      WHERE type = 'p' AND length > 0 AND box IN (${idList})
      GROUP BY box
      ORDER BY total_words DESC
    `)

    const result: NotebookWordStat[] = []
    const seen = new Set<string>()
    let totalWordsAll = 0

    if (rows && rows.length > 0) {
      for (const row of rows) {
        const name = idToName.get(row.notebook_id) || "未知笔记本"
        const words = Number(row.total_words || 0)
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
        const dateStr = `${date.getFullYear()}${padZero(date.getMonth() + 1)}${padZero(date.getDate())}`
        const words = dayMap.get(dateStr) || 0

        dailyData.push({
          date: `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())}`,
          words,
          dateLabel: `${date.getMonth() + 1}/${date.getDate()}`,
        })
      }

      result.push({
        notebook: idToName.get(nb.id) || "未知笔记本",
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

    const rows = await executeSql<NotebookWordSumRow>(`
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
        name: idToName.get(rows[0].notebook_id) || "未知笔记本",
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

export async function getNotebookBlockTypeStats(): Promise<NotebookBlockTypeStat[]> {
  try {
    const {
      notebooks,
      idList,
      idToName,
    } = await getOpenNotebooks()
    if (notebooks.length === 0) return []

    const rows = await executeSql<NotebookBlockTypeRow>(`
      SELECT box as notebook_id, type, COUNT(*) as cnt
      FROM blocks
      WHERE box IN (${idList})
      GROUP BY box, type
      ORDER BY box, cnt DESC
      LIMIT 512
    `)

    const grouped = new Map<string, Array<{ name: string, count: number, label: string }>>()
    if (rows) {
      for (const row of rows) {
        const nbName = idToName.get(row.notebook_id) || "未知笔记本"
        if (!grouped.has(nbName)) {
          grouped.set(nbName, [])
        }
        grouped.get(nbName)!.push({
          name: row.type,
          count: Number(row.cnt || 0),
          label: BLOCK_TYPE_LABELS[row.type] || row.type,
        })
      }
    }

    for (const nb of notebooks) {
      if (!grouped.has(nb.name)) {
        grouped.set(nb.name, [])
      }
    }

    return Array.from(grouped.entries()).map(([notebook, blockTypes]) => ({
      notebook,
      blockTypes,
    }))
  } catch (error) {
    console.error("获取笔记本块类型分布失败:", error)
    return []
  }
}
