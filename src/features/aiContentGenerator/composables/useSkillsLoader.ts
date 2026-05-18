/**
 * 技能加载 Composable
 * 统一 index.vue 和 ChatView.vue 中的 loadSkills 逻辑
 * 支持同名技能去重（合并来源提示）和搜索过滤
 */
import { ref, computed } from "vue"
import { SkillsViewerManager } from "@/features/generalSettings/modules/SkillsViewerManager"
import type { SkillInfo } from "@/features/generalSettings/modules/SkillsViewerManager"
import type { SkillItem, SkillSource } from "@/types/ai"

export function useSkillsLoader(plugin: any) {
  /** 原始技能列表（去重前） */
  const rawSkills = ref<SkillItem[]>([])
  /** 去重后的技能列表 */
  const skills = ref<SkillItem[]>([])
  const currentSkillIndex = ref(-1)
  const managerAvailable = ref(true)
  /** 技能搜索关键词 */
  const skillSearchQuery = ref("")

  const currentSkill = computed(() => {
    if (currentSkillIndex.value < 0 || currentSkillIndex.value >= skills.value.length) {
      return null
    }
    return skills.value[currentSkillIndex.value]
  })

  /** 根据搜索关键词过滤技能 */
  const filteredSkills = computed(() => {
    if (!skillSearchQuery.value.trim()) {
      return skills.value
    }
    const query = skillSearchQuery.value.toLowerCase().trim()
    return skills.value.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query) ||
        s.sources.some((src) => src.tool.toLowerCase().includes(query)),
    )
  })

  /**
   * 对同名技能去重，合并来源信息
   * 去重规则：name 相同的技能只保留一个，sources 记录所有来源
   * 优先保留内容最长的版本，并在 description 中提示来源
   */
  function deduplicateSkills(items: SkillItem[]): SkillItem[] {
    const nameMap = new Map<string, SkillItem>()

    for (const item of items) {
      const key = item.name.toLowerCase().trim()
      const existing = nameMap.get(key)

      if (!existing) {
        nameMap.set(key, { ...item })
      } else {
        // 合并 sources
        const mergedSources = [...existing.sources, ...item.sources]

        // 保留内容最长的版本
        if (item.content.length > existing.content.length) {
          nameMap.set(key, {
            ...item,
            sources: mergedSources,
          })
        } else {
          existing.sources = mergedSources
        }
      }
    }

    return Array.from(nameMap.values())
  }

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
      rawSkills.value = skillInfos.map((s: SkillInfo) => ({
        id: s.filePath,
        name: s.name,
        description: s.description,
        content: s.content,
        tool: s.tool,
        sources: [{ id: s.filePath, tool: s.tool, content: s.content }],
      }))

      // 去重
      skills.value = deduplicateSkills(rawSkills.value)

      // 首次加载时自动选中第一个技能
      if (skills.value.length > 0 && currentSkillIndex.value < 0) {
        currentSkillIndex.value = 0
      }
    } catch (err) {
      console.error("扫描技能失败:", err)
      managerAvailable.value = false
    }
  }

  return {
    skills,
    rawSkills,
    currentSkillIndex,
    currentSkill,
    managerAvailable,
    loadSkills,
    skillSearchQuery,
    filteredSkills,
  }
}
