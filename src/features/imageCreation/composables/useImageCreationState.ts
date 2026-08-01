/**
 * 图片生成弹窗层状态管理（运行时时序逻辑，遵循 types/ 仅放类型规范）
 */
import type { TabType } from "../types"
import { ref } from "vue"

/** 弹窗可见性（App.vue 统一调度） */
export const imageCreationVisible = ref(false)

/** 当前激活 Tab */
export const activeTab = ref<TabType>("cover")

/** 打开图片生成弹窗（默认文章封面 Tab） */
export function showImageCreation() {
  activeTab.value = "cover"
  imageCreationVisible.value = true
}

/** 切换 Tab */
export function switchTab(tab: TabType) {
  activeTab.value = tab
}

/** 关闭图片生成弹窗 */
export function hideImageCreation() {
  imageCreationVisible.value = false
}
