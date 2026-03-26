/**
 * Everything本地搜索功能 - 类型定义和注册函数
 */
import { Plugin } from 'siyuan'
import { ref } from 'vue'

// ============================================================
// 类型定义
// ============================================================

export type { EverythingSearchResult, EverythingConfig, EverythingSearchOptions } from '../api'

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

// ============================================================
// 全局状态
// ============================================================

/** 弹窗显示状态 */
export const everythingSearchVisible = ref(false)

// ============================================================
// 注册函数
// ============================================================

/**
 * 显示Everything搜索弹窗
 */
export function showEverythingSearch() {
  everythingSearchVisible.value = true
}

/**
 * 隐藏Everything搜索弹窗
 */
export function hideEverythingSearch() {
  everythingSearchVisible.value = false
}

/**
 * 切换Everything搜索弹窗显示状态
 */
export function toggleEverythingSearch() {
  everythingSearchVisible.value = !everythingSearchVisible.value
}

/**
 * 注册Everything搜索功能
 */
export function registerEverythingSearch(plugin: Plugin) {
  // 注册快捷键命令
  plugin.addCommand({
    langKey: 'everythingSearch',
    langText: 'Everything本地搜索',
    hotkey: '⌃⌥E', // Ctrl+Alt+E
    callback: () => {
      showEverythingSearch()
    }
  })
}
