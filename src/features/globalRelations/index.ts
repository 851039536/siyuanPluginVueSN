// 全局关系列表功能注册入口 — 创建 Modal 管理器并注册命令
import type { Plugin } from "siyuan"
import { GlobalRelationsManager } from "./types"

/**
 * 注册全局关系列表功能
 * 返回管理器实例，供插件卸载时调用 destroy() 清理 Modal 与命令资源。
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

  return manager
}
