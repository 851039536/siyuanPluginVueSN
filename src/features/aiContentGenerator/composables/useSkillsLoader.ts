/**
 * 技能加载 Composable
 * 统一 index.vue 中的 loadSkills 逻辑
 * 支持同名技能去重（合并来源提示）和持久化选择恢复
 * scanSkills 取自本模块 skills/ 子模块（功能合并后不再依赖注入）
 */
import type {
  SkillItem,
} from "@/types/ai"
import { readWorkspaceDir } from "@/utils/workspaceDir"
import { toSkillItem } from "../types"
import { scanSkills } from "../skills"
import {
  computed,
  ref,
} from "vue"

export function useSkillsLoader() {
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
    try {
      // 项目级技能以思源工作区根目录为项目根（plugin 运行时并无 dataPath 字段）
      const projectPath = await readWorkspaceDir()

      const skillInfos = await scanSkills(projectPath || undefined)
      const rawSkills = skillInfos.map(toSkillItem)

      // 去重
      skills.value = deduplicateSkills(rawSkills)

      // 列表长度变化（来源开关 / 技能被删除）后索引需收敛，否则会停留在越界位置导致"看似选中实则为空"
      if (skills.value.length === 0) {
        currentSkillIndex.value = -1
      } else if (currentSkillIndex.value < 0) {
        // 首次加载或此前明确选过"无技能"：仅首次自动选中第一项（restoreSkillById 会随后覆盖）
        currentSkillIndex.value = 0
      } else if (currentSkillIndex.value >= skills.value.length) {
        currentSkillIndex.value = skills.value.length - 1
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
