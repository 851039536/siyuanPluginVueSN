// 单词阅读功能 - 卡片发音 composable
import type { Ref } from "vue"
import type {
  Flashcard,
  I18n,
} from "../types"
import type { FlashcardStorage } from "../types/storage"
import { showMessage } from "siyuan"
import { syncIncrementPractice } from "../utils"

export function usePlayWord(
  storage: FlashcardStorage,
  cards: Ref<Flashcard[]>,
  i18n: I18n,
) {
  const playWord = async (card: Flashcard | null) => {
    if (!card) return

    try {
      const utterance = new SpeechSynthesisUtterance(card.title)
      utterance.lang = "en-US"
      utterance.rate = 0.8

      utterance.onend = async () => {
        await syncIncrementPractice(storage, cards, card.id)
      }

      speechSynthesis.speak(utterance)
    } catch (error) {
      console.error("Failed to play pronunciation:", error)
      showMessage(i18n.playFailed || "播放失败", 2000, "error")
    }
  }

  return { playWord }
}
