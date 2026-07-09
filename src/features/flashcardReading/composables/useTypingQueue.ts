// 单词阅读功能 - 打字练习加权队列
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


export function useTypingQueue(cards: Ref<Flashcard[]>) {
  const currentIndex = ref(0)

  const buildQueue = (): Flashcard[] => {
    const list = cards.value
    if (list.length <= 1) return [...list]

    const weights = computeWeights(list)
    const entries = list.map((card, i) => ({
      card,
      weight: weights[i],
    }))
    let totalWeight = weights.reduce((sum, w) => sum + w, 0)

    const result: Flashcard[] = []
    let remaining = entries.length

    while (remaining > 0) {
      let rand = Math.random() * totalWeight
      let pickedIdx = 0

      for (let i = 0; i < remaining; i++) {
        rand -= entries[i].weight
        if (rand <= 0) {
          pickedIdx = i
          break
        }
      }

      result.push(entries[pickedIdx].card)
      totalWeight -= entries[pickedIdx].weight
      remaining--

      // 交换到末尾 + 减少长度 = O(1) 删除，替代 splice O(n)
      if (pickedIdx < remaining) {
        entries[pickedIdx] = entries[remaining]
      }
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
    if (currentIndex.value < queue.value.length - 1) {
      currentIndex.value++
    }
  }

  const random = () => {
    if (queue.value.length <= 1) return
    let newIndex: number
    do {
      newIndex = Math.floor(Math.random() * queue.value.length)
    } while (
      newIndex === currentIndex.value
      && queue.value.length > 1
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
