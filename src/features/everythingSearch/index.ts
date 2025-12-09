/**
 * Everything本地搜索功能模块
 */
import { Plugin } from 'siyuan'
import { ref } from 'vue'

// 弹窗显示状态
export const everythingSearchVisible = ref(false)

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
      console.log('Everything搜索快捷键触发')
      showEverythingSearch()
    }
  })
}

// 导出API
export * from './api'
