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
let boundPlugin: Plugin | null = null
let initPromise: Promise<void> | null = null

export function useMilestoneStorage() {
  /**
   * 初始化：绑定 plugin 并一次性加载三项持久化数据。
   * 幂等且可重入等待：同一 plugin 二次调用时等待首次加载完成，避免加载未完成即写入被覆盖。
   */
  async function initMilestoneStorage(plugin?: Plugin): Promise<void> {
    if (!plugin) return
    if (boundPlugin !== plugin) {
      boundPlugin = plugin
      storage = new PluginStorage(plugin)
      initPromise = loadFromStorage()
    }
    if (initPromise) {
      await initPromise
    }
  }

  /** 首次加载三项数据（失败时重置 initPromise 以便下次重试） */
  async function loadFromStorage(): Promise<void> {
    const s = storage
    if (!s) return
    try {
      const rules = await s.load<Record<string, number[]>>(STORAGE_KEY_MILESTONE_RULES)
      if (rules) customRules.value = rules
      const ach = await s.load<CustomAchievement[]>(STORAGE_KEY_CUSTOM_ACHIEVEMENTS)
      if (ach) customAchievements.value = ach
      const lc = await s.load<LevelConfig>(STORAGE_KEY_LEVEL_CONFIG)
      if (lc) levelConfig.value = lc
    } catch (err) {
      console.error("加载里程碑配置失败:", err)
      initPromise = null
    }
  }

  /** 写入前等待初始化完成（初始化失败仍继续写入当前内存态，避免 UI 已改但持久化静默丢失） */
  async function waitReady(): Promise<void> {
    if (initPromise) {
      try {
        await initPromise
      } catch {
        // init 内部已 catch，此处仅兜底
      }
    }
  }

  async function saveRules(rules: Record<string, number[]>) {
    customRules.value = rules
    await waitReady()
    if (storage) await storage.save(STORAGE_KEY_MILESTONE_RULES, rules)
  }

  async function addAchievement(achievement: CustomAchievement) {
    customAchievements.value = [...customAchievements.value, achievement]
    await waitReady()
    if (storage) await storage.save(STORAGE_KEY_CUSTOM_ACHIEVEMENTS, customAchievements.value)
  }

  async function deleteAchievement(id: string) {
    customAchievements.value = customAchievements.value.filter((a) => a.id !== id)
    await waitReady()
    if (storage) await storage.save(STORAGE_KEY_CUSTOM_ACHIEVEMENTS, customAchievements.value)
  }

  async function saveLevelConfig(config: LevelConfig) {
    levelConfig.value = config
    await waitReady()
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
