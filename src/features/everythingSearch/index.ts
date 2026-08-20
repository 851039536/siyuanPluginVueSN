/**
 * Everything本地搜索功能模块
 * 双形态承载：overlay 弹窗（Teleport）+ 独立窗口（addTab + openWindow 官方 API）
 */
import type { Plugin } from "siyuan"
import { ref } from "vue"
import { EverythingSearchManager } from "./types"

// ============================================================
// 全局可见性状态（跨组件共享，独立于 Vue 组件树）
// ============================================================

/** 弹窗显示状态 */
export const everythingSearchVisible = ref(false)

/** 显示 Everything 搜索弹窗 */
export function showEverythingSearch() {
  everythingSearchVisible.value = true
}

// ============================================================
// 功能注册
// ============================================================

/**
 * 注册Everything搜索功能
 */
export function registerEverythingSearch(plugin: Plugin) {
  // 注册自定义图标（openTab custom.icon 引用）
  plugin.addIcons(`<symbol id="iconEverythingSearch" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></symbol>`)
  // 独立页签/浮动窗口管理器（addTab + openWindow 官方 API）
  plugin.addIcons(`<symbol id="iconFloatingWindow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 8h18"/><circle cx="7" cy="16" r="1.2" fill="currentColor" stroke="none"/><circle cx="11" cy="16" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="16" r="1.2" fill="currentColor" stroke="none"/></symbol>`)
  const manager = new EverythingSearchManager(plugin)

  // 注册快捷键命令
  plugin.addCommand({
    langKey: "everythingSearch",
    langText: "Everything本地搜索",
    hotkey: "⌃⌥E", // Ctrl+Alt+E
    callback: () => {
      showEverythingSearch()
    },
  })

  // 挂载到 plugin 实例，供面板「在独立窗口打开」按钮与 onunload 统一销毁
  ;(plugin as any).__everythingSearch = {
    openFloating: () => void manager.openFloating(),
    destroy: () => {
      manager.destroy()
    },
  }
}
