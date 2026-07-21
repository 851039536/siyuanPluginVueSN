/**
 * 技能学习 - 卡片统计 composable（index.vue & StatsView 共用）
 */
import type { ComputedRef, Ref } from "vue"
import type { SkillCard } from "../types"
import { computed } from "vue"

export function useCardStats(cardsRef: Ref<SkillCard[]> | ComputedRef<SkillCard[]>) {
  const practicedCount = computed(() => cardsRef.value.filter((c) => c.practiceCount > 0).length)

  const dueCount = computed(() =>
    cardsRef.value.filter((c) => {
      if (!c.reviewData) return true
      return c.reviewData.nextReview <= Date.now()
    }).length,
  )

  const practicedPct = computed(() => {
    if (cardsRef.value.length === 0) return 0
    return Math.round((practicedCount.value / cardsRef.value.length) * 100)
  })

  const totalCorrect = computed(() =>
    cardsRef.value.reduce((sum, c) => sum + (c.correctCount || 0), 0),
  )
  const totalWrong = computed(() =>
    cardsRef.value.reduce((sum, c) => sum + (c.wrongCount || 0), 0),
  )
  const totalAttempts = computed(() => totalCorrect.value + totalWrong.value)
  const accuracyPct = computed(() => {
    if (totalAttempts.value === 0) return 0
    return Math.round((totalCorrect.value / totalAttempts.value) * 100)
  })

  return {
    practicedCount,
    dueCount,
    practicedPct,
    totalCorrect,
    totalWrong,
    totalAttempts,
    accuracyPct,
  }
}
