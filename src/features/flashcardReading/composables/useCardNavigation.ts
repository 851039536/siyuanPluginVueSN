import type { ComputedRef } from "vue"
import type { Flashcard } from "../types"
import {
  computed,
  ref,
} from "vue"

export function useCardNavigation(filteredCards: ComputedRef<Flashcard[]>) {
  const currentIndex = ref(0)

  const currentCard = computed(() =>
    filteredCards.value[currentIndex.value] ?? null,
  )

  const previous = () => {
    if (currentIndex.value > 0) {
      currentIndex.value--
    }
  }

  const next = () => {
    if (currentIndex.value < filteredCards.value.length - 1) {
      currentIndex.value++
    }
  }

  const random = () => {
    if (filteredCards.value.length <= 1) return
    let newIndex: number
    do {
      newIndex = Math.floor(Math.random() * filteredCards.value.length)
    } while (newIndex === currentIndex.value && filteredCards.value.length > 1)
    currentIndex.value = newIndex
  }

  return {
    currentIndex,
    currentCard,
    previous,
    next,
    random,
  }
}
