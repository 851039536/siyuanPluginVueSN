/**
 * 技能加载 Composable
 * 统一 index.vue 中的 loadSkills 逻辑
 * 支持同名技能去重（合并来源提示）和持久化选择恢复
 * scanSkills 由调用方通过依赖注入传入（遵循零跨 Feature 直接导入规则）
 */
import type {
  SkillItem,
} from "@/types/ai"
import type { ScanSkillsFn } from "../types"
import { toSkillItem } from "../types"
import {
  computed,
  ref,
} from "vue"

export function useSkillsLoader(
  plugin: any,
  scanSkills?: ScanSkillsFn,
) {
  /** 去重后的技能列表 */
  const skills = ref<SkillItem[]>([])
  const currentSkillIndex = ref(-1)

  const currentSkill = computed(() => {
    if (currentSkillIndex.value < 0 || currentSkillIndex.value >= skills.value.length) {
      return null
    }
    return skills.value[currentSkillIndex.value]
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
    // modules 侧未注入 scanSkills（可选契约）时置空技能列表直接返回
    if (!scanSkills) {
      skills.value = []
      currentSkillIndex.value = -1
      return
    }
    try {
      let projectPath = ""
      try {
        if (plugin?.dataPath) {
          projectPath = plugin.dataPath.replace(/\/data$/, "").replace(/\\data$/, "")
        }
      } catch { /* 忽略，只扫全局 */ }

      const skillInfos = await scanSkills(projectPath || undefined)
      const rawSkills = skillInfos.map(toSkillItem)

      // 去重
      skills.value = deduplicateSkills(rawSkills)

      // 首次加载时自动选中第一个技能
      if (skills.value.length > 0 && currentSkillIndex.value < 0) {
        currentSkillIndex.value = 0
      }
    } catch (err) {
      console.error("扫描技能失败:", err)
    }
  }

  /**
   * 按技能 id 恢复持久化的选择
   * null（无持久化记录）→ 不操作，保留 loadSkills 的默认选中
   * ""（明确选择"无技能"）→ 选中 -1
   * 具体 id → 找到则选中对应技能；技能已不存在则回退默认逻辑
   */
  function restoreSkillById(skillId: string | null): void {
    if (skillId === null) return
    if (skillId === "") {
      currentSkillIndex.value = -1
      return
    }
    const index = skills.value.findIndex((s) => s.id === skillId)
    if (index === -1) return
    currentSkillIndex.value = index
  }

  return {
    skills,
    currentSkillIndex,
    currentSkill,
    loadSkills,
    restoreSkillById,
  }
}
