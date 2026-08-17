/**
 * RSS 设置/分组操作组合式函数 — 字体、分组、排序、过滤
 */
import type { Ref } from "vue"
import { showMessage } from "siyuan"
import type {
  RssFeed,
  RssSettings,
} from "../types"

export interface SettingsOpsDeps {
  settings: Ref<RssSettings>
  feeds: Ref<RssFeed[]>
  collapsedGroups: Ref<Set<string>>
  currentGroupFilter: Ref<string>
  saveData: () => Promise<void>
  saveSettings: (settings: RssSettings) => Promise<unknown>
  startAutoRefresh: () => void
  i18n: Record<string, string>
}

export function useSettingsOps(deps: SettingsOpsDeps) {
  const {
    settings,
    feeds,
    collapsedGroups,
    currentGroupFilter,
    saveData,
    saveSettings,
    startAutoRefresh,
    i18n,
  } = deps

  /**
   * 增大/减小字体
   */
  function changeDetailFontSize(delta: number) {
    const current = settings.value.detailFontSize
    const newSize = Math.max(12, Math.min(24, current + delta))
    if (newSize !== current) {
      settings.value.detailFontSize = newSize
      void saveSettings(settings.value)
    }
  }

  /**
   * 更新订阅源分组
   */
  async function updateFeedGroup(feedId: string, group: string) {
    const feed = feeds.value.find((f) => f.id === feedId)
    if (feed) {
      feed.group = group
      await saveData()
    }
  }

  /**
   * 更新设置（含范围校验，自动刷新间隔变更后立即重设定时器）
   */
  async function updateSettings(newSettings: Partial<RssSettings>) {
    if (typeof newSettings.refreshInterval === "number") {
      newSettings.refreshInterval = Math.max(0, Math.min(1440, Math.round(newSettings.refreshInterval)))
    }
    if (typeof newSettings.maxItemsPerFeed === "number") {
      newSettings.maxItemsPerFeed = Math.max(10, Math.min(500, Math.round(newSettings.maxItemsPerFeed)))
    }
    Object.assign(settings.value, newSettings)
    if (typeof newSettings.refreshInterval === "number") {
      startAutoRefresh()
    }
    await saveSettings(settings.value)
  }

  /**
   * 重命名分组
   */
  async function renameGroup(oldName: string, newName: string) {
    if (!oldName || !newName.trim() || oldName === newName.trim()) return
    const trimmed = newName.trim()
    for (const feed of feeds.value) {
      if (feed.group === oldName) {
        feed.group = trimmed
      }
    }
    if (collapsedGroups.value.has(oldName)) {
      collapsedGroups.value.delete(oldName)
      collapsedGroups.value.add(trimmed)
    }
    if (currentGroupFilter.value === oldName) {
      currentGroupFilter.value = trimmed
    }
    await saveData()
    showMessage(`${i18n.groupRenamedTo}: ${trimmed}`, 2000, "info")
  }

  return {
    changeDetailFontSize,
    updateFeedGroup,
    updateSettings,
    renameGroup,
  }
}
