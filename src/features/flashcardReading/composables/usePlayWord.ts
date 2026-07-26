// 单词阅读功能 - 卡片发音 composable
import type { ComputedRef, Ref } from "vue"
import type {
  Flashcard,
  I18n,
} from "../types"
import type { FlashcardStorage } from "../types/storage"
import { showMessage } from "siyuan"
import { onUnmounted } from "vue"
import { syncIncrementPractice } from "../utils"

export function usePlayWord(
  storage: FlashcardStorage,
  cards: Ref<Flashcard[]>,
  t: ComputedRef<Required<I18n>>,
) {
  // 存活标记：组件卸载后 utterance.onend 不再触发写盘（悬空回调防护）
  let alive = true

  onUnmounted(() => {
    alive = false
    speechSynthesis.cancel()
  })

  const playWord = async (card: Flashcard | null) => {
    if (!card) return

    try {
      const utterance = new SpeechSynthesisUtterance(card.title)
      utterance.lang = "en-US"
      utterance.rate = 0.8

      utterance.onend = async () => {
        if (!alive) return
        await syncIncrementPractice(storage, cards, card.id)
      }

      speechSynthesis.speak(utterance)
    } catch (error) {
      console.error("Failed to play pronunciation:", error)
      showMessage(t.value.playFailed, 2000, "error")
    }
  }

  return { playWord }
}
