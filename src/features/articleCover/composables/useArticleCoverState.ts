/**
 * 文章封面弹出层状态管理
 * 从 types/index.ts 拆分出的运行时逻辑，遵循"types/ 仅放类型"规范
 */
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
}
