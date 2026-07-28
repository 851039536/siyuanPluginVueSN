/**
 * 超级面板工具 — 悬浮框快捷入口，点击派发 toggleSuperPanel 事件
 */
import type { Plugin } from "siyuan"
import type { FloatingTool } from "../types"
import { createEventDispatchTool } from "./utils"

export function createSuperPanelTool(plugin: Plugin): FloatingTool {
  return createEventDispatchTool(plugin, {
    id: "superPanel",
    icon: "mdi:view-dashboard",
    eventName: "toggleSuperPanel",
  })
}
