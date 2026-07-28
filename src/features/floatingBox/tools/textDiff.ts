/**
 * 文本对比工具 — 悬浮框快捷入口，点击派发 openTextDiff 事件
 */
import type { Plugin } from "siyuan"
import type { FloatingTool } from "../types"
import { createEventDispatchTool } from "./utils"

export function createTextDiffTool(plugin: Plugin): FloatingTool {
  return createEventDispatchTool(plugin, {
    id: "textDiff",
    icon: "mdi:file-compare-outline",
    bgColor: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    eventName: "openTextDiff",
  })
}
