/**
 * Skills 查看器 — 可见性状态与切换函数
 */
import { ref } from "vue"

export const skillsViewerVisible = ref(false)

export function showSkillsViewer() {
  skillsViewerVisible.value = true
}

export function hideSkillsViewer() {
  skillsViewerVisible.value = false
}

export function toggleSkillsViewer() {
  skillsViewerVisible.value = !skillsViewerVisible.value
}
