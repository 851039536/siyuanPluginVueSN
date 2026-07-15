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

export function useBookmarkMarkerSettings(plugin: Plugin) {
  const storage = new BookmarkMarkerStorage(plugin)

  const enableBookmarkMarker = ref(true)
  const rules = ref<BookmarkRule[]>([...DEFAULT_BOOKMARK_MARKER_SETTINGS.rules])
  const updateInterval = ref(DEFAULT_BOOKMARK_MARKER_SETTINGS.updateInterval.toString())

  async function load() {
    try {
      const data = await storage.settings.loadOrDefault()
      enableBookmarkMarker.value = data.enableBookmarkMarker ?? true
      rules.value = data.rules?.length
        ? data.rules.map((r: any) => ({
            ...r,
            bookmarkNames: r.bookmarkNames || (r.bookmarkName ? [r.bookmarkName] : []),
          }))
        : [...DEFAULT_BOOKMARK_MARKER_SETTINGS.rules]
      updateInterval.value = (data.updateInterval ?? DEFAULT_BOOKMARK_MARKER_SETTINGS.updateInterval).toString()
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
