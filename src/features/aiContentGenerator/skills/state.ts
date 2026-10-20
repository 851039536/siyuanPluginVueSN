/**
 * Skills 管理（aiContentGenerator/skills）— 可见性状态与切换函数
 */
import { ref } from "vue"

export const skillsManagerVisible = ref(false)

export function showSkillsManager() {
  skillsManagerVisible.value = true
}

export function hideSkillsManager() {
  skillsManagerVisible.value = false
}
