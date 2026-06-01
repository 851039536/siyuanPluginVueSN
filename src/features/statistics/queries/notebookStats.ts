import type { DailyWordCount, NotebookActivityItem, NotebookBlockTypeStat, NotebookWordStat } from "../types"
import { lsNotebooks } from "@/api"
import { BLOCK_TYPE_LABELS, NOTEBOOK_COLORS } from "../types/constants"
import { padZero } from "../utils"
import { executeSql, formatDateTime } from "./executeSql"

export async function getNotebookDocStats(): Promise<Array<{ name: string, count: number }>> {
  try {
    const data = await lsNotebooks()
    if (!data || !data.notebooks) return []

    const openNotebooks = data.notebooks.filter((nb: any) => !nb.closed)
    if (openNotebooks.length === 0) return []

    const notebookIds = openNotebooks.map((nb: any) => `'${(nb.id as string).replace(/'/g, "''")}'`).join(",")
    const sqlStmt = `
      SELECT box as notebook_id, COUNT(*) as doc_count
      FROM blocks
      WHERE type = 'd' AND box IN (${notebookIds})
      GROUP BY box
      ORDER BY doc_count DESC
    `

    const rows = await executeSql(sqlStmt)

    const notebookMap = new Map<string, string>()
    for (const nb of openNotebooks) {
      notebookMap.set(nb.id, nb.name)
    }

    const result: Array<{ name: string, count: number }> = []

    if (rows && rows.length > 0) {
      for (const row of rows) {
        const name = notebookMap.get(row.notebook_id) || "未知笔记本"
        result.push({ name, count: row.doc_count || 0 })
        notebookMap.delete(row.notebook_id)
      }
    }

    for (const [_, name] of notebookMap) {
      result.push({ name, count: 0 })
    }

    return result
  } catch (error) {
    console.error("获取笔记本文档统计失败:", error)
    return []
  }
}

export async function getNotebookWordStats(): Promise<NotebookWordStat[]> {
  try {
    const data = await lsNotebooks()
    if (!data || !data.notebooks) return []

    const openNotebooks = data.notebooks.filter((nb: any) => !nb.closed)
    if (openNotebooks.length === 0) return []

    const notebookIds = openNotebooks
      .map((nb: any) => `'${(nb.id as string).replace(/'/g, "''")}'`)
      .join(",")

    const sqlStmt = `
      SELECT box as notebook_id, SUM(length) as total_words
      FROM blocks
      WHERE type = 'p' AND length > 0 AND box IN (${notebookIds})
      GROUP BY box
      ORDER BY total_words DESC
    `
    const rows = await executeSql(sqlStmt)

    const notebookMap = new Map<string, string>()
    for (const nb of openNotebooks) {
      notebookMap.set(nb.id, nb.name)
    }

    const result: NotebookWordStat[] = []
    let totalWordsAll = 0

    if (rows && rows.length > 0) {
      for (const row of rows) {
        const name = notebookMap.get(row.notebook_id) || "未知笔记本"
        const words = Number(row.total_words || 0)
        totalWordsAll += words
        result.push({ name, words, percentage: 0, color: "" })
        notebookMap.delete(row.notebook_id)
      }
    }

    for (const [_, name] of notebookMap) {
      result.push({ name, words: 0, percentage: 0, color: "" })
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
    const data = await lsNotebooks()
    if (!data || !data.notebooks) return []

    const openNotebooks = data.notebooks.filter((nb: any) => !nb.closed)
    if (openNotebooks.length === 0) return []

    const today = new Date()
    const startDate = new Date(today)
    startDate.setDate(today.getDate() - days + 1)
    startDate.setHours(0, 0, 0, 0)

    const startStr = formatDateTime(startDate)
    const endStr = formatDateTime(today)

    const notebookIds = openNotebooks
      .map((nb: any) => `'${(nb.id as string).replace(/'/g, "''")}'`)
      .join(",")

    const sqlStmt = `
      SELECT box as notebook_id, substr(created, 1, 8) as date, SUM(length) as words
      FROM blocks
      WHERE type = 'p'
        AND length > 0
        AND box IN (${notebookIds})
        AND created >= '${startStr}'
        AND created <= '${endStr}'
      GROUP BY box, substr(created, 1, 8)
      ORDER BY date ASC
    `
    const rows = await executeSql(sqlStmt)

    const notebookMap = new Map<string, string>()
    for (const nb of openNotebooks) {
      notebookMap.set(nb.id, nb.name)
    }

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
    openNotebooks.forEach((nb: any, idx) => {
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
        notebook: notebookMap.get(nb.id) || "未知笔记本",
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
    const data = await lsNotebooks()
    if (!data || !data.notebooks) return { name: "", words: 0 }

    const openNotebooks = data.notebooks.filter((nb: any) => !nb.closed)
    if (openNotebooks.length === 0) return { name: "", words: 0 }

    const notebookIds = openNotebooks
      .map((nb: any) => `'${(nb.id as string).replace(/'/g, "''")}'`)
      .join(",")

    const rows = await executeSql(`
      SELECT box as notebook_id, SUM(length) as words
      FROM blocks
      WHERE type = 'p' AND length > 0 AND box IN (${notebookIds})
        AND created >= '${startStr}' AND created <= '${endStr}'
      GROUP BY box
      ORDER BY words DESC
      LIMIT 1
    `)

    if (rows.length > 0) {
      const nb = openNotebooks.find((n: any) => n.id === rows[0].notebook_id)
      return {
        name: nb?.name || "未知笔记本",
        words: Number(rows[0].words || 0),
      }
    }

    return { name: openNotebooks[0].name, words: 0 }
  } catch {
    return { name: "", words: 0 }
  }
}

export async function getNotebookTagStats(): Promise<Array<{ name: string, count: number }>> {
  try {
    const data = await lsNotebooks()
    if (!data || !data.notebooks) return []

    const openNotebooks = data.notebooks.filter((nb: any) => !nb.closed)
    if (openNotebooks.length === 0) return []

    const notebookIds = openNotebooks
      .map((nb: any) => `'${(nb.id as string).replace(/'/g, "''")}'`)
      .join(",")

    const rows = await executeSql(`
      SELECT box as notebook_id, COUNT(*) as tag_count
      FROM blocks
      WHERE type = 'tag' AND box IN (${notebookIds})
      GROUP BY box
      ORDER BY tag_count DESC
    `)

    const notebookMap = new Map<string, string>()
    for (const nb of openNotebooks) {
      notebookMap.set(nb.id, nb.name)
    }

    const result: Array<{ name: string, count: number }> = []
    if (rows && rows.length > 0) {
      for (const row of rows) {
        const name = notebookMap.get(row.notebook_id) || "未知笔记本"
        result.push({ name, count: Number(row.tag_count || 0) })
        notebookMap.delete(row.notebook_id)
      }
    }

    for (const [_, name] of notebookMap) {
      result.push({ name, count: 0 })
    }

    return result
  } catch (error) {
    console.error("获取笔记本标签分布失败:", error)
    return []
  }
}

export async function getNotebookBlockTypeStats(): Promise<NotebookBlockTypeStat[]> {
  try {
    const data = await lsNotebooks()
    if (!data || !data.notebooks) return []

    const openNotebooks = data.notebooks.filter((nb: any) => !nb.closed)
    if (openNotebooks.length === 0) return []

    const notebookIds = openNotebooks
      .map((nb: any) => `'${(nb.id as string).replace(/'/g, "''")}'`)
      .join(",")

    const rows = await executeSql(`
      SELECT box as notebook_id, type, COUNT(*) as cnt
      FROM blocks
      WHERE box IN (${notebookIds})
      GROUP BY box, type
      ORDER BY box, cnt DESC
    `)

    const notebookMap = new Map<string, string>()
    for (const nb of openNotebooks) {
      notebookMap.set(nb.id, nb.name)
    }

    const grouped = new Map<string, Array<{ name: string, count: number, label: string }>>()
    if (rows) {
      for (const row of rows) {
        const nbName = notebookMap.get(row.notebook_id) || "未知笔记本"
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

    // ensure all open notebooks appear, even with empty stats
    for (const nb of openNotebooks) {
      if (!grouped.has(nb.name)) {
        grouped.set(nb.name, [])
      }
    }

    return Array.from(grouped.entries()).map(([notebook, blockTypes], idx) => ({
      notebook,
      blockTypes,
      color: NOTEBOOK_COLORS[idx % NOTEBOOK_COLORS.length],
    }))
  } catch (error) {
    console.error("获取笔记本块类型分布失败:", error)
    return []
  }
}
