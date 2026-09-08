// 笔记本分布统计数据加载

import type { Ref } from "vue"
import type {
  NotebookDocCount,
  NotebookWordStat,
} from "../types"
import { ref } from "vue"
import {
  getNotebookDocStats,
  getNotebookWordStats,
} from "../queries"

export function useNotebookStats(): {
  notebookDocStats: Ref<NotebookDocCount[]>
  notebookWordStats: Ref<NotebookWordStat[]>
  loadNotebookDocStats: () => Promise<void>
  loadNotebookWordStats: () => Promise<void>
} {
  const notebookDocStats = ref<NotebookDocCount[]>([])
  const notebookWordStats = ref<NotebookWordStat[]>([])

  async function loadNotebookDocStats(): Promise<void> {
    try {
      notebookDocStats.value = await getNotebookDocStats()
    } catch (error) {
      console.error("加载笔记本文档统计失败:", error)
    }
  }

  async function loadNotebookWordStats(): Promise<void> {
    try {
      notebookWordStats.value = await getNotebookWordStats()
    } catch (error) {
      console.error("加载笔记本字数统计失败:", error)
    }
  }

  return {
    notebookDocStats,
    notebookWordStats,
    loadNotebookDocStats,
    loadNotebookWordStats,
  }
}
