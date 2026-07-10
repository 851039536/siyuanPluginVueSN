/**
 * 超级面板工具 — 悬浮框快捷入口，点击派发 toggleSuperPanel 事件
 */
import type { Plugin } from "siyuan"
import type { FloatingTool } from "../types"
import { createEventDispatchTool } from "./utils"

export function createSuperPanelTool(plugin: Plugin): FloatingTool {
  return createEventDispatchTool(plugin, {
    id: "superPanel",
    i18nKey: "superPanel",
    defaultLabel: "超级面板",
    defaultTitle: "打开超级面板",
    icon: "mdi:view-dashboard",
    bgColor: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
    eventName: "toggleSuperPanel",
  })
}
