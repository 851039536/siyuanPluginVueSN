// 书签标记 — 设置状态 composable（Vue 组件用）

import type { Plugin } from "siyuan"
import type { BookmarkRule } from "../types"
import {
  onMounted,
  ref,
} from "vue"
import {
  BookmarkMarkerStorage,
  DEFAULT_BOOKMARK_MARKER_SETTINGS,
} from "../types/storage"
import { normalizeRules } from "../utils"

export function useBookmarkMarkerSettings(plugin: Plugin) {
  const storage = new BookmarkMarkerStorage(plugin)

  const enableBookmarkMarker = ref(true)
  // 深拷贝默认规则，避免面板编辑时污染 DEFAULT 常量本体
  const rules = ref<BookmarkRule[]>(structuredClone(DEFAULT_BOOKMARK_MARKER_SETTINGS.rules))
  const updateInterval = ref(DEFAULT_BOOKMARK_MARKER_SETTINGS.updateInterval.toString())

  async function load() {
    try {
      const data = await storage.settings.loadOrDefault()
      enableBookmarkMarker.value = data.enableBookmarkMarker
      rules.value = data.rules?.length
        ? normalizeRules(data.rules)
        : structuredClone(DEFAULT_BOOKMARK_MARKER_SETTINGS.rules)
      updateInterval.value = data.updateInterval.toString()
    } catch (e) {
      console.error("加载书签标记设置失败:", e)
    }
  }

  async function save() {
    try {
      await storage.settings.save({
        enableBookmarkMarker: enableBookmarkMarker.value,
        rules: rules.value,
        updateInterval: Number(updateInterval.value),
      })
    } catch (e) {
      console.error("保存书签标记设置失败:", e)
    }
  }

  onMounted(async () => {
    await load()
  })

  return {
    enableBookmarkMarker,
    rules,
    updateInterval,
    load,
    save,
  }
}
