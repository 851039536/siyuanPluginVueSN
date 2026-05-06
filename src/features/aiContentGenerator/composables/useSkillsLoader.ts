/**
 * 技能加载 Composable
 * 统一 index.vue 和 ChatView.vue 中的 loadSkills 逻辑
 */
import { ref, computed } from "vue"
import { SkillsViewerManager } from "@/features/generalSettings/modules/SkillsViewerManager"
import type { SkillInfo } from "@/features/generalSettings/modules/SkillsViewerManager"
import type { SkillItem } from "@/types/ai"

export function useSkillsLoader(plugin: any) {
  const skills = ref<SkillItem[]>([])
  const currentSkillId = ref("")
  const managerAvailable = ref(true)

  const currentSkill = computed(() => {
    return skills.value.find((s) => s.id === currentSkillId.value) || null
  })

  /** 扫描加载 AI 技能 */
  async function loadSkills() {
    try {
      const manager = new SkillsViewerManager()
      if (!manager.isAvailable()) {
        managerAvailable.value = false
        return
      }

      let projectPath = ""
      try {
        if (plugin?.dataPath) {
          projectPath = plugin.dataPath.replace(/\/data$/, "").replace(/\\data$/, "")
        }
      } catch { /* 忽略，只扫全局 */ }

      const skillInfos = await manager.scanAllSkills(projectPath || undefined)
      skills.value = skillInfos.map((s: SkillInfo) => ({
        id: s.filePath,
        name: s.name,
        description: s.description,
        content: s.content,
        tool: s.tool,
      }))

      // 首次加载时自动选中第一个技能
      if (skills.value.length > 0 && !currentSkillId.value) {
        currentSkillId.value = skills.value[0].id
      }
    } catch (err) {
      console.error("扫描技能失败:", err)
      managerAvailable.value = false
    }
  }

  return {
    skills,
    currentSkillId,
    currentSkill,
    managerAvailable,
    loadSkills,
  }
}
