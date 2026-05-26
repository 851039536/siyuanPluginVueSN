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
