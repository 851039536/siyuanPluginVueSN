// 里程碑存储 composable：模块级共享自定义规则/成就/等级配置 + 持久化（Dock 与编辑弹窗共用）

import type { Plugin } from "siyuan"
import type { CustomAchievement, LevelConfig } from "../types/milestoneRules"
import { ref } from "vue"
import { PluginStorage } from "@/utils/pluginStorage"
import {
  DEFAULT_LEVEL_CONFIG,
  STORAGE_KEY_CUSTOM_ACHIEVEMENTS,
  STORAGE_KEY_LEVEL_CONFIG,
  STORAGE_KEY_MILESTONE_RULES,
} from "../types/milestoneRules"

// ── 模块级共享状态（卡片与编辑弹窗读写同一份） ──
const customRules = ref<Record<string, number[]>>({})
const customAchievements = ref<CustomAchievement[]>([])
const levelConfig = ref<LevelConfig>({ ...DEFAULT_LEVEL_CONFIG })

let storage: PluginStorage | undefined

export function useMilestoneStorage() {
  /** 初始化：绑定 plugin 并一次性加载三项持久化数据 */
  async function initMilestoneStorage(plugin?: Plugin) {
    if (!plugin) return
    storage = new PluginStorage(plugin)
    const rules = await storage.load<Record<string, number[]>>(STORAGE_KEY_MILESTONE_RULES)
    if (rules) customRules.value = rules
    const ach = await storage.load<CustomAchievement[]>(STORAGE_KEY_CUSTOM_ACHIEVEMENTS)
    if (ach) customAchievements.value = ach
    const lc = await storage.load<LevelConfig>(STORAGE_KEY_LEVEL_CONFIG)
    if (lc) levelConfig.value = lc
  }

  async function saveRules(rules: Record<string, number[]>) {
    customRules.value = rules
    if (storage) await storage.save(STORAGE_KEY_MILESTONE_RULES, rules)
  }

  async function addAchievement(achievement: CustomAchievement) {
    customAchievements.value = [...customAchievements.value, achievement]
    if (storage) await storage.save(STORAGE_KEY_CUSTOM_ACHIEVEMENTS, customAchievements.value)
  }

  async function deleteAchievement(id: string) {
    customAchievements.value = customAchievements.value.filter((a) => a.id !== id)
    if (storage) await storage.save(STORAGE_KEY_CUSTOM_ACHIEVEMENTS, customAchievements.value)
  }

  async function saveLevelConfig(config: LevelConfig) {
    levelConfig.value = config
    if (storage) await storage.save(STORAGE_KEY_LEVEL_CONFIG, config)
  }

  return {
    customRules,
    customAchievements,
    levelConfig,
    initMilestoneStorage,
    saveRules,
    addAchievement,
    deleteAchievement,
    saveLevelConfig,
  }
}
