/**
 * Everything本地搜索功能模块
 */
import type { Plugin } from "siyuan"
import { ref } from "vue"

// ============================================================
// 全局可见性状态（跨组件共享，独立于 Vue 组件树）
// ============================================================

/** 弹窗显示状态 */
export const everythingSearchVisible = ref(false)

/** 显示 Everything 搜索弹窗 */
export function showEverythingSearch() {
  everythingSearchVisible.value = true
}

/** 隐藏 Everything 搜索弹窗 */
export function hideEverythingSearch() {
  everythingSearchVisible.value = false
}

/** 切换 Everything 搜索弹窗显示状态 */
export function toggleEverythingSearch() {
  everythingSearchVisible.value = !everythingSearchVisible.value
}

// ============================================================
// 功能注册
// ============================================================

/**
 * 注册Everything搜索功能
 */
export function registerEverythingSearch(plugin: Plugin) {
  // 注册快捷键命令
  plugin.addCommand({
    langKey: "everythingSearch",
    langText: "Everything本地搜索",
    hotkey: "⌃⌥E", // Ctrl+Alt+E
    callback: () => {
      showEverythingSearch()
    },
  })
}
