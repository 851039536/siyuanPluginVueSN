/**
 * Everything本地搜索功能 - 类型定义
 * 仅包含类型和常量，所有运行时逻辑在 ../index.ts
 */
export type {
  /** Everything 服务连接配置 */
  EverythingConfig,
  /** Everything HTTP API 搜索参数 */
  EverythingSearchOptions,
  /** Everything 搜索结果项 */
  EverythingSearchResult,
} from "../api"
import type { EverythingSearchResult } from "../api"

/** 搜索选项 */
export interface SearchOptions {
  /** 区分大小写 */
  matchCase: boolean
  /** 全词匹配 */
  matchWholeWord: boolean
  /** 匹配路径 */
  matchPath: boolean
  /** 正则表达式 */
  regex: boolean
  /** 最大结果数 */
  maxResults: number
  /** 防抖延迟（毫秒） */
  debounceDelay: number
  /** 排序字段 */
  sort: "name" | "path" | "size" | "date_modified"
  /** 升序 */
  ascending: boolean
  /** 高级搜索模式（显示语法帮助面板） */
  advancedMode: boolean
  /** 最小文件大小过滤值（0=禁用） */
  minSize: number
  /** 最小文件大小单位 */
  minSizeUnit: 'KB' | 'MB' | 'GB'
  /** 最大文件大小过滤值（0=禁用） */
  maxSize: number
  /** 最大文件大小单位 */
  maxSizeUnit: 'KB' | 'MB' | 'GB'
  /** 常用关键字列表 */
  frequentKeywords: string[]
}

/** 搜索结果状态 */
export type SearchStatus = "idle" | "loading" | "success" | "error" | "empty"

/** 搜索结果状态数据 */
export interface SearchState {
  /** 状态 */
  status: SearchStatus
  /** 结果列表 */
  results: EverythingSearchResult[]
  /** 错误信息 */
  errorMessage: string
  /** 是否已搜索过 */
  hasSearched: boolean
}
