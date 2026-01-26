export type { EverythingSearchResult, EverythingConfig } from './api'

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
  /** 自动搜索 */
  autoSearch: boolean
  /** 防抖延迟（毫秒） */
  debounceDelay: number
  /** 排序字段 */
  sort: 'name' | 'path' | 'size' | 'date_modified'
  /** 升序 */
  ascending: boolean
  /** 选中的盘符 */
  selectedDrive: string
}

/** 搜索结果状态 */
export type SearchStatus = 'idle' | 'loading' | 'success' | 'error' | 'empty'

/** 搜索结果状态数据 */
export interface SearchState {
  /** 状态 */
  status: SearchStatus
  /** 结果列表 */
  results: any[]
  /** 错误信息 */
  errorMessage: string
  /** 是否已搜索过 */
  hasSearched: boolean
}
