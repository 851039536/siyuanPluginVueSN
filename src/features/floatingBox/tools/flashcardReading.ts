import type { FloatingTool } from "../types"
import { emitCustomEvent } from "@/utils/eventBus"

export function createFlashcardReadingTool(plugin?: any): FloatingTool {
  return {
    id: "flashcardReading",
    label: plugin?.i18n?.floatingBox?.flashcardReading || "单词阅读",
    title: plugin?.i18n?.floatingBox?.flashcardReadingTitle || "打开单词阅读",
    icon: "mdi:card-text-outline",
    bgColor: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
    action: () => {
      emitCustomEvent("openFlashcardReading")
    },
  }
}
