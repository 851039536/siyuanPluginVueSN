/**
 * 文本对比工具 — 悬浮框快捷入口，点击派发 openTextDiff 事件
 */
import type { Plugin } from "siyuan"
import type { FloatingTool } from "../types"
import { createEventDispatchTool } from "./utils"

export function createTextDiffTool(plugin: Plugin): FloatingTool {
  return createEventDispatchTool(plugin, {
    id: "textDiff",
    i18nKey: "textDiff",
    defaultLabel: "文本对比",
    defaultTitle: "打开文本对比工具",
    icon: "mdi:file-compare-outline",
    bgColor: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    eventName: "openTextDiff",
  })
}
