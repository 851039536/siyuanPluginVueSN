/**
 * 文档分析功能模块
 */
import type { Plugin } from "siyuan"
import { emitCustomEvent } from "@/utils/eventBus"
import { createVueDockApp } from "@/utils/vueAppHelper"
import DocAnalysisPanel from "./index.vue"
import { DocAnalysisManager } from "./types/manager"

/**
 * 注册文档分析功能（Dock 侧边栏面板 + 独立浮动窗口双形态）
 */
export function registerDocAnalysis(plugin: Plugin) {
  // 注册自定义页签图标 symbol（openTab custom.icon 引用）
  plugin.addIcons(`<symbol id="iconDocAnalysis" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><rect x="7" y="9" width="4" height="4"/><rect x="13" y="14" width="4" height="4"/></symbol>`)

  // 独立页签/浮动窗口管理器（addTab + openWindow 官方 API）
  const manager = new DocAnalysisManager(plugin)

  // 挂载到 plugin 实例，供面板「在独立窗口打开」按钮与 onunload 统一销毁
  ;(plugin as any).__docAnalysis = {
    openFloating: () => void manager.openFloating(),
    destroy: () => manager.destroy(),
  }

  // Dock 侧边栏面板
  createVueDockApp(plugin, DocAnalysisPanel, {
    icon: "iconSearch",
    title: (plugin.i18n as any)?.docAnalysis?.title || "文档分析",
    type: "doc-analysis-dock",
    width: 400,
    i18n: (plugin.i18n as any)?.docAnalysis || {},
  })

  // 注册快捷键命令 - 触发 Dock 显示
  plugin.addCommand({
    langKey: "docAnalysis",
    langText: "文档分析",
    hotkey: "⌃⌥D",
    callback: () => {
      emitCustomEvent("dock-click", { dockId: "doc-analysis-dock" })
    },
  })
}
