/**
 * 提示词库工具 — 悬浮框快捷入口，点击派发 openPrompts 事件
 */
import type { Plugin } from "siyuan"
import type { FloatingTool } from "../types"
import { createEventDispatchTool } from "./utils"

export function createPromptsTool(plugin: Plugin): FloatingTool {
  return createEventDispatchTool(plugin, {
    id: "prompts",
    icon: "mdi:star",
    bgColor: "#667eea",
    eventName: "openPrompts",
  })
}
