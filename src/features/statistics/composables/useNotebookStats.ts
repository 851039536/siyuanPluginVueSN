// 笔记本分布统计数据加载

import type { Ref } from "vue"
import type {
  NotebookBlockTypeStat,
  NotebookWordStat,
} from "../types"
import { ref } from "vue"
import {
  getNotebookBlockTypeStats,
  getNotebookDocStats,
  getNotebookWordStats,
} from "../queries"

export function useNotebookStats(): {
  notebookDocStats: Ref<Array<{ name: string, count: number }>>
  docChartLoading: Ref<boolean>
  notebookWordStats: Ref<NotebookWordStat[]>
  notebookBlockTypeStats: Ref<NotebookBlockTypeStat[]>
  loadNotebookDocStats: () => Promise<void>
  loadNotebookWordStats: () => Promise<void>
  loadNotebookBlockTypeStats: () => Promise<void>
} {
  const notebookDocStats = ref<Array<{ name: string, count: number }>>([])
  const docChartLoading = ref(false)
  const notebookWordStats = ref<NotebookWordStat[]>([])
  const notebookBlockTypeStats = ref<NotebookBlockTypeStat[]>([])

  async function loadNotebookDocStats(): Promise<void> {
    docChartLoading.value = true
    try {
      notebookDocStats.value = await getNotebookDocStats()
    } catch (error) {
      console.error("加载笔记本文档统计失败:", error)
    } finally {
      docChartLoading.value = false
    }
  }

  async function loadNotebookWordStats(): Promise<void> {
    try {
      notebookWordStats.value = await getNotebookWordStats()
    } catch (error) {
      console.error("加载笔记本字数统计失败:", error)
    }
  }

  async function loadNotebookBlockTypeStats(): Promise<void> {
    try {
      notebookBlockTypeStats.value = await getNotebookBlockTypeStats()
    } catch (error) {
      console.error("加载笔记本块类型统计失败:", error)
    }
  }

  return {
    notebookDocStats,
    docChartLoading,
    notebookWordStats,
    notebookBlockTypeStats,
    loadNotebookDocStats,
    loadNotebookWordStats,
    loadNotebookBlockTypeStats,
  }
}
