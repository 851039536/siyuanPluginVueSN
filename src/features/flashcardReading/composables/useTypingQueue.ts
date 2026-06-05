import type { Ref } from "vue"
import type { Flashcard } from "../types"
import {
  computed,
  ref,
} from "vue"

/** 计算每张卡片的权重（练习次数越少权重越高） */
function computeWeights(list: Flashcard[]): number[] {
  const maxCount = Math.max(...list.map((c) => c.practiceCount || 0), 0)
  return list.map((c) =>
    maxCount > 0 ? 1 + maxCount - (c.practiceCount || 0) : 1,
  )
}

/** 根据权重随机选取一个索引 */
function weightedRandomIndex(cards: Flashcard[]): number {
  const weights = computeWeights(cards)
  const totalWeight = weights.reduce((sum, w) => sum + w, 0)
  let rand = Math.random() * totalWeight
  for (let i = 0; i < weights.length; i++) {
    rand -= weights[i]
    if (rand <= 0) return i
  }
  return cards.length - 1
}

export function useTypingQueue(cards: Ref<Flashcard[]>) {
  const currentIndex = ref(0)

  const buildQueue = (): Flashcard[] => {
    const list = cards.value
    if (list.length <= 1) return [...list]

    const weights = computeWeights(list)
    const weighted = list.map((card, i) => ({ card, weight: weights[i] }))

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

  return {
    queue,
    currentIndex,
    currentCard,
    previous,
    next,
    random,
    rebuild,
  }
}
