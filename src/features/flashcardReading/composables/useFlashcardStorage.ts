import type { Plugin } from "siyuan"
import type { Flashcard } from "../types"
import {
  onMounted,
  onUnmounted,
  ref,
} from "vue"
import { FlashcardStorage } from "../types/storage"

export const CARD_CONFIG = {
  PAGE_SIZE: 10,
  PRESET_CATEGORIES: [
    "C#",
    "编程单词",
    "JavaScript",
    "TypeScript",
    "Vue",
    "Rust",
  ] as string[],
}

export function useFlashcardStorage(plugin: Plugin) {
  const storage = new FlashcardStorage(plugin)
  const cards = ref<Flashcard[]>([])
  const categories = ref<string[]>([])

  const loadCards = async () => {
    try {
      cards.value = await storage.getAllCards()
      categories.value = await storage.getCategories()
    } catch (error) {
      console.error("Failed to load cards:", error)
    }
  }

  let dataChangeHandler: (() => void) | null = null

  onMounted(() => {
    loadCards()
    dataChangeHandler = () => loadCards()
    window.addEventListener("flashcardDataChanged", dataChangeHandler)
  })

  onUnmounted(() => {
    if (dataChangeHandler) {
      window.removeEventListener("flashcardDataChanged", dataChangeHandler)
      dataChangeHandler = null
    }
  })

  return {
    storage,
    cards,
    categories,
    loadCards,
  }
}
