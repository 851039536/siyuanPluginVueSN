/**
 * 文档分析功能 - 数据存储管理
 */
import type { Plugin } from "siyuan"
import type { FilterOptions } from "./index"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"

/** 默认过滤选项 */
export const DEFAULT_FILTER_OPTIONS: FilterOptions = {
  titleKeyword: "",
  contentKeyword: "",
  notebookId: "",
  sortField: "wordCount",
  sortOrder: "asc",
  wordCountMin: 0,
  wordCountMax: 30000,
  bookmarkName: "",
  updatedAfter: "",
  updatedBefore: "",
}

/**
 * 文档分析存储管理类
 */
export class DocAnalysisStorage {
  readonly options: TypedStorage<FilterOptions>

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin)
    this.options = new TypedStorage(storage, "doc-analysis-options", DEFAULT_FILTER_OPTIONS)
  }
}

// ============================================================
// 工具函数
// ============================================================

/**
 * 格式化字节数为可读字符串
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/**
 * 格式化字数为可读字符串
 */
export function formatWordCount(count: number): string {
  if (count === 0) return "0 字"
  if (count < 10000) return `${count} 字`
  return `${(count / 10000).toFixed(1)} 万字`
}
