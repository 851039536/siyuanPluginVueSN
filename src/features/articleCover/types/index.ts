import { ref } from "vue"

// ============================================================
// 封面生成相关类型
// ============================================================

export interface CoverSizePreset {
  label: string
  width: number
  height: number
}

export interface CoverStylePreset {
  id: string
  label: string
  description: string
}

export type CoverGenerationStatus = "idle" | "generating" | "done" | "error"

export interface CoverGenerationConfig {
  title: string
  category: string
  keywords: string
  watermark: string
  width: number
  height: number
  styleId: string
}

// ============================================================
// 弹出层状态管理
// ============================================================

export const articleCoverVisible = ref(false)
export const articleCoverInitialTitle = ref("")
export const articleCoverInitialKeywords = ref("")

export function showArticleCover(title?: string, keywords?: string) {
  articleCoverInitialTitle.value = title || ""
  articleCoverInitialKeywords.value = keywords || ""
  articleCoverVisible.value = true
}

export function hideArticleCover() {
  articleCoverVisible.value = false
}
