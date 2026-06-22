/**
 * 技能学习 - 加权随机复习队列
 * 复用 flashcardReading composables/useTypingQueue.ts 的核心算法
 */
import { ref, computed, type Ref } from "vue"
import type { SkillCard, ReviewRating } from "../types"

/** 计算每张卡片的权重（练习次数越少权重越高） */
function computeWeights(list: SkillCard[]): number[] {
  const maxCount = Math.max(...list.map((c) => c.practiceCount || 0), 0)
  return list.map((c) =>
    maxCount > 0 ? 1 + maxCount - (c.practiceCount || 0) : 1,
  )
}

/** 根据权重随机选取索引 */
function weightedRandomIndex(cards: SkillCard[]): number {
  const weights = computeWeights(cards)
  const totalWeight = weights.reduce((sum, w) => sum + w, 0)
  let rand = Math.random() * totalWeight
  for (let i = 0; i < weights.length; i++) {
    rand -= weights[i]
    if (rand <= 0) return i
  }
  return cards.length - 1
}

export function useReviewQueue(cards: Ref<SkillCard[]>) {
  const currentIndex = ref(0)
  const isFlipped = ref(false)
  const roundComplete = ref(false)

  const buildQueue = (): SkillCard[] => {
    const list = cards.value
    if (list.length === 0) return []
    if (list.length === 1) return [...list]

    const weights = computeWeights(list)
    const entries = list.map((card, i) => ({ card, weight: weights[i] }))
    let totalWeight = weights.reduce((sum, w) => sum + w, 0)

    const result: SkillCard[] = []
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

      if (pickedIdx < remaining) {
        entries[pickedIdx] = entries[remaining]
      }
    }

    return result
  }

  const queue = ref<SkillCard[]>(buildQueue())
  const totalCount = computed(() => cards.value.length)
  const reviewed = ref(0)

  const rebuild = () => {
    queue.value = buildQueue()
    if (currentIndex.value >= queue.value.length) {
      currentIndex.value = 0
    }
  }

  const currentCard = computed(() => queue.value[currentIndex.value])

  const flip = () => {
    isFlipped.value = !isFlipped.value
  }

  const rate = (rating: ReviewRating) => {
    isFlipped.value = false
    reviewed.value++

    if (currentIndex.value < queue.value.length - 1) {
      currentIndex.value++
    } else {
      roundComplete.value = true
    }
    return rating
  }

  const next = () => {
    isFlipped.value = false
    if (currentIndex.value < queue.value.length - 1) {
      currentIndex.value++
    } else {
      rebuild()
      currentIndex.value = 0
      reviewed.value = 0
      roundComplete.value = false
    }
  }

  const restart = () => {
    rebuild()
    currentIndex.value = 0
    isFlipped.value = false
    reviewed.value = 0
    roundComplete.value = false
  }

  return {
    queue,
    currentIndex,
    currentCard,
    isFlipped,
    roundComplete,
    totalCount,
    reviewed,
    flip,
    rate,
    next,
    restart,
    rebuild,
  }
}
