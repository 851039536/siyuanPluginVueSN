/**
 * 文档分析功能 - 文档排序纯函数
 */
import type { DocInfo } from "../types/index"

/** 排序比较器映射 */
export const SORT_CMP: Record<string, (a: DocInfo, b: DocInfo) => number> = {
  title: (a, b) => a.title.localeCompare(b.title, "zh-CN"),
  notebook: (a, b) => a.notebookName.localeCompare(b.notebookName, "zh-CN"),
  updated: (a, b) => (a.updated || "").localeCompare(b.updated || ""),
  depth: (a, b) => (a.depth || 0) - (b.depth || 0),
  refCount: (a, b) => (a.refCount || 0) - (b.refCount || 0),
  imageCount: (a, b) => (a.imageCount || 0) - (b.imageCount || 0),
  bookmark: (a, b) => (a.bookmark || "").localeCompare(b.bookmark || "", "zh-CN"),
  wordCount: (a, b) => a.wordCount - b.wordCount,
}

/** 按字段排序（不改变原数组） */
export function sortDocs(docs: DocInfo[], field: string, order: string): DocInfo[] {
  const cmp = SORT_CMP[field] || SORT_CMP.wordCount
  return [...docs].sort((a, b) => (order === "desc" ? -cmp(a, b) : cmp(a, b)))
}
