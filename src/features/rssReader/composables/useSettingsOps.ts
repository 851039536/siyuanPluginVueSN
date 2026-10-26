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
   * 数字设置项钳制：NaN 直接回退当前值（Math.max/min 链对 NaN 无效，会原样穿透存盘）
   */
  function clampNumber(value: number, min: number, max: number, fallback: number): number {
    const clamped = Math.max(min, Math.min(max, Math.round(value)))
    return Number.isNaN(clamped) ? fallback : clamped
  }

  /**
   * 更新设置（含范围/枚举校验，自动刷新间隔变更后立即重设定时器）
   */
  async function updateSettings(newSettings: Partial<RssSettings>) {
    if (typeof newSettings.refreshInterval === "number") {
      newSettings.refreshInterval = clampNumber(newSettings.refreshInterval, 0, 1440, settings.value.refreshInterval)
    }
    if (typeof newSettings.maxItemsPerFeed === "number") {
      newSettings.maxItemsPerFeed = clampNumber(newSettings.maxItemsPerFeed, 10, 500, settings.value.maxItemsPerFeed)
    }
    if (newSettings.sortOrder !== undefined
      && newSettings.sortOrder !== "newest"
      && newSettings.sortOrder !== "oldest") {
      newSettings.sortOrder = settings.value.sortOrder
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
