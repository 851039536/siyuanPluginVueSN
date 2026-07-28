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
    eventName: "openFlashcardReading",
  })
}
