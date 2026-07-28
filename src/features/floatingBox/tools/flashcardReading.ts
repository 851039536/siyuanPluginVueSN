/**
 * 闪卡阅读工具 — 悬浮框快捷入口，点击派发 openFlashcardReading 事件
 */
import type { Plugin } from "siyuan"
import type { FloatingTool } from "../types"
import { createEventDispatchTool } from "./utils"

export function createFlashcardReadingTool(plugin: Plugin): FloatingTool {
  return createEventDispatchTool(plugin, {
    id: "flashcardReading",
    icon: "mdi:card-text-outline",
    bgColor: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
    eventName: "openFlashcardReading",
  })
}
