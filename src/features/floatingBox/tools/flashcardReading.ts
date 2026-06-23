import type { Plugin } from "siyuan"
import type { FloatingTool } from "../types"
import { emitCustomEvent } from "@/utils/eventBus"

export function createFlashcardReadingTool(plugin: Plugin): FloatingTool {
  const i18n = (plugin.i18n as any)?.floatingBox || {}
  return {
    id: "flashcardReading",
    label: i18n.flashcardReading || "单词阅读",
    title: i18n.flashcardReadingTitle || "打开单词阅读",
    icon: "mdi:card-text-outline",
    bgColor: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
    action: () => {
      emitCustomEvent("openFlashcardReading")
    },
  }
}
