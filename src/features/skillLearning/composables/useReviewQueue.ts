/**
 * 技能学习 - 复习队列 + SM-2 间隔重复算法
 */
import type {
  ComputedRef,
  Ref,
} from "vue"
import type {
  ReviewData,
  ReviewRating,
  SkillCard,
} from "../types"
import { computed } from "vue"

const DEFAULT_EF = 2.5
const MIN_EF = 1.3
const DAY_MS = 24 * 60 * 60 * 1000

export function calcNextReview(rating: ReviewRating, prev?: ReviewData): ReviewData {
  const qMap: Record<ReviewRating, number> = {
    remembered: 5,
    fuzzy: 3,
    forgot: 1,
  }
  const q = qMap[rating] ?? 3

  const ef = prev?.ef ?? DEFAULT_EF
  const interval = prev?.interval ?? 1
  const reps = prev?.repetitions ?? 0

  let newEf = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  if (newEf < MIN_EF) newEf = MIN_EF

  let newInterval: number
  let newRepetitions: number

  if (q < 3) {
    newInterval = 1
    newRepetitions = 0
  } else {
    newRepetitions = reps + 1
    if (newRepetitions === 1) newInterval = 1
    else if (newRepetitions === 2) newInterval = 6
    else newInterval = Math.round(interval * newEf)
  }

  return {
    ef: Math.round(newEf * 100) / 100,
    interval: newInterval,
    repetitions: newRepetitions,
    nextReview: Date.now() + newInterval * DAY_MS,
  }
}

export function useReviewQueue(cardsRef: Ref<SkillCard[]> | ComputedRef<SkillCard[]>) {
  const now = Date.now()
  const dueCards = computed(() =>
    cardsRef.value.filter((c) => !c.reviewData || c.reviewData.nextReview <= now),
  )
  const allReviewed = computed(() => dueCards.value.length === 0)
  return {
    dueCards,
    allReviewed,
  }
}
