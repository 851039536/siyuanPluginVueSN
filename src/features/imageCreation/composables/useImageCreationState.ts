/**
 * 图片生成弹出层状态管理
 * 从 types/index.ts 拆分出的运行时逻辑，遵循"types/ 仅放类型"规范
 */
import type { TabType } from "../types"
import { ref } from "vue"

export const imageCreationVisible = ref(false)
export const imageCreationInitialTitle = ref("")
export const imageCreationInitialKeywords = ref("")
export const activeTab = ref<TabType>("cover")

export function showImageCreation(title?: string, keywords?: string) {
  imageCreationInitialTitle.value = title || ""
  imageCreationInitialKeywords.value = keywords || ""
  activeTab.value = "cover"
  imageCreationVisible.value = true
}

export function showCodeImage() {
  activeTab.value = "codeImage"
  imageCreationVisible.value = true
}

export function switchTab(tab: TabType) {
  activeTab.value = tab
}

export function hideImageCreation() {
  imageCreationVisible.value = false
}
