// 全局关系列表功能注册入口 — 创建 Modal 管理器并注册命令
import type { Plugin } from "siyuan"
import { GlobalRelationsManager } from "./types"

/**
 * 注册全局关系列表功能
 * 在 register 内部自挂载管理器实例，供 onunload 经 DESTROYABLE_KEYS 统一销毁 Modal 与命令资源。
 */
export function registerGlobalRelations(plugin: Plugin): GlobalRelationsManager {
  const manager = new GlobalRelationsManager(plugin)
  const i18n = (plugin.i18n as Record<string, any>)?.globalRelations || {}

  plugin.addCommand({
    langKey: "globalRelations",
    langText: i18n.panelTitle || "全局关系列表",
    hotkey: "⌃⌥N",
    callback: () => {
      manager.toggle()
    },
  })

  // 实例自挂载（AGENTS.md 强制：register 内部挂载，字段名同步加入 DESTROYABLE_KEYS）
  ;(plugin as any).__globalRelations = manager
  return manager
}
