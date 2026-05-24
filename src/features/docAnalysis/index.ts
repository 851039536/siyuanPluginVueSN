/**
 * 文档分析功能模块
 */
import type { Plugin } from "siyuan"
import { emitCustomEvent } from "@/utils/eventBus"
import { createVueDockApp } from "@/utils/vueAppHelper"
import DocAnalysisPanel from "./index.vue"

/**
 * 注册文档分析功能（Dock 侧边栏面板）
 */
export function registerDocAnalysis(plugin: Plugin) {
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

export * from "./types"
