/**
 * 审核系统 Composable
 * 封装审核状态和操作方法，供 index.vue 调用
 */
import { ref, computed } from "vue"
import type { ReviewResult, SkillItem } from "@/types/ai"

export interface FixEntry {
  timestamp: number
  issuesAddressed: string[]
  ratingBefore: string
  ratingAfter: string
}

export function useReview() {
  const enableReview = ref(false)
  const isReviewing = ref(false)
  const reviewResult = ref<ReviewResult | null>(null)
  const isAutoFixing = ref(false)
  const autoFixCount = ref(0)
  const fixHistory = ref<FixEntry[]>([])
  const MAX_AUTO_FIX_ITERATIONS = 2

  const needsFix = computed(() =>
    reviewResult.value?.rating === "需改进"
    && (reviewResult.value?.issues?.length ?? 0) > 0
  )

  const resetReview = () => {
    reviewResult.value = null
    isReviewing.value = false
    isAutoFixing.value = false
    autoFixCount.value = 0
  }

  /** 记录修复条目 */
  const recordFixEntry = (issuesAddressed: string[], ratingBefore: string) => {
    fixHistory.value.push({
      timestamp: Date.now(),
      issuesAddressed,
      ratingBefore,
      ratingAfter: reviewResult.value?.rating || ratingBefore,
    })
  }

  return {
    enableReview,
    isReviewing,
    reviewResult,
    isAutoFixing,
    autoFixCount,
    fixHistory,
    MAX_AUTO_FIX_ITERATIONS,
    needsFix,
    resetReview,
    recordFixEntry,
  }
}
