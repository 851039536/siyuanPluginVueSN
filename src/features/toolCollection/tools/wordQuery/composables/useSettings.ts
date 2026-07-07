// 单词查询设置持久化 — 发音偏好加载与保存
import type { Plugin } from "siyuan"
import { ref, watch } from "vue"
import { WordQueryStorage } from "../types/storage"

/**
 * 设置持久化 composable — 管理发音偏好设置
 * @param plugin 思源插件实例
 */
export function useSettings(plugin?: Plugin) {
  const pronunciationType = ref<"uk" | "us">("uk")
  const autoPlayPronunciation = ref(false)
  let storage: WordQueryStorage | null = null

  const loadSettings = async () => {
    if (!storage) return
    const settings = await storage.settings.loadOrDefault()
    pronunciationType.value = settings.pronunciationType
    autoPlayPronunciation.value = settings.autoPlayPronunciation
  }

  const saveSettings = async () => {
    if (!storage) return
    await storage.settings.save({
      pronunciationType: pronunciationType.value,
      autoPlayPronunciation: autoPlayPronunciation.value,
    })
  }

  const init = async () => {
    if (!plugin) return
    storage = new WordQueryStorage(plugin)
    await storage.init()
    await loadSettings()
  }

  // 监听设置变化自动保存
  watch(
    [pronunciationType, autoPlayPronunciation],
    async () => {
      await saveSettings()
    },
  )

  return {
    pronunciationType,
    autoPlayPronunciation,
    loadSettings,
    saveSettings,
    init,
  }
}
