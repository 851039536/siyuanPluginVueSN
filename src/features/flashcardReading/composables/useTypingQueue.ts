import type { Ref } from "vue"
import type { Flashcard } from "../types"
import { computed, ref } from "vue"

export function useTypingQueue(cards: Ref<Flashcard[]>) {
  const currentIndex = ref(0)

  const buildQueue = (): Flashcard[] => {
    const list = cards.value
    if (list.length <= 1) return [...list]

    const maxCount = Math.max(...list.map((c) => c.practiceCount || 0), 0)

    const weighted: Array<{ card: Flashcard; weight: number }> = list.map(
      (card) => ({
        card,
        weight: maxCount > 0 ? 1 + maxCount - (card.practiceCount || 0) : 1,
      }),
    )

    const result: Flashcard[] = []
    const remaining = [...weighted]

    while (remaining.length > 0) {
      const totalWeight = remaining.reduce((sum, r) => sum + r.weight, 0)
      let rand = Math.random() * totalWeight
      let pickedIndex = 0

      for (let i = 0; i < remaining.length; i++) {
        rand -= remaining[i].weight
        if (rand <= 0) {
          pickedIndex = i
          break
        }
      }

      result.push(remaining[pickedIndex].card)
      remaining.splice(pickedIndex, 1)
    }

    return result
  }

  const queue = ref<Flashcard[]>(buildQueue())

  const rebuild = () => {
    queue.value = buildQueue()
    if (currentIndex.value >= queue.value.length) {
      currentIndex.value = 0
    }
  }

  const currentCard = computed(() => queue.value[currentIndex.value])

  const previous = () => {
    if (currentIndex.value > 0) {
      currentIndex.value--
    }
  }

  const next = () => {
    rebuild()
    if (currentIndex.value < queue.value.length - 1) {
      currentIndex.value++
    }
  }

  const random = () => {
    rebuild()
    if (queue.value.length <= 1) return
    let newIndex: number
    do {
      newIndex = weightedRandomIndex(cards.value)
    } while (
      newIndex === currentIndex.value
      && cards.value.length > 1
    )
    currentIndex.value = newIndex
  }

  return { queue, currentIndex, currentCard, previous, next, random, rebuild }
}

function weightedRandomIndex(cards: Flashcard[]): number {
  const maxCount = Math.max(...cards.map((c) => c.practiceCount || 0), 0)
  let totalWeight = 0
  const weights = cards.map((c) => {
    const w = maxCount > 0 ? 1 + maxCount - (c.practiceCount || 0) : 1
    totalWeight += w
    return w
  })
  let rand = Math.random() * totalWeight
  for (let i = 0; i < weights.length; i++) {
    rand -= weights[i]
    if (rand <= 0) return i
  }
  return cards.length - 1
}
