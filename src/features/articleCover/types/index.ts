import { ref } from "vue"

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
  // 不清除 context refs，避免关闭动画期间 props 变化闪烁
  // 下次 show 时会覆盖
}
