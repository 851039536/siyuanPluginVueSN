import type { BookmarkRule } from "./index"
import { Plugin } from "siyuan"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"

export interface BookmarkMarkerSettings {
  enableBookmarkMarker: boolean
  rules: BookmarkRule[]
  updateInterval: number
}

export const DEFAULT_BOOKMARK_MARKER_SETTINGS: BookmarkMarkerSettings = {
  enableBookmarkMarker: true,
  rules: [
    {
      bookmarkNames: ["已发布"],
      color: "#ffffff",
      backgroundColor: "#52c41a",
      alpha: 0.25,
      matchMode: "exact",
    },
    {
      bookmarkNames: ["待发布"],
      color: "#ffffff",
      backgroundColor: "#faad14",
      alpha: 0.25,
      matchMode: "exact",
    },
  ],
  updateInterval: 3600000,
}

export class BookmarkMarkerStorage {
  readonly settings: TypedStorage<BookmarkMarkerSettings>

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin)
    this.settings = new TypedStorage(storage, "bookmark-marker-settings", DEFAULT_BOOKMARK_MARKER_SETTINGS)
  }
}
