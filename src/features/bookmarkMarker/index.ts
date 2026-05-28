/**
 * 书签标记功能模块
 * 根据文档书签内容在文件树中显示颜色标记
 */
import type { Plugin } from "siyuan"
import { createVueDockApp } from "@/utils/vueAppHelper"
import BookmarkMarkerPanel from "./index.vue"
import { BookmarkMarker } from "./modules/BookmarkMarker"
import { BookmarkMarkerStorage } from "./types/storage"

class BookmarkMarkerManager {
  private plugin: Plugin
  private storage: BookmarkMarkerStorage
  private bookmarkMarker: BookmarkMarker | null = null

  constructor(plugin: Plugin) {
    this.plugin = plugin
    this.storage = new BookmarkMarkerStorage(plugin)
  }

  init(): void {
    this.addDock()
    this.applySettings()
  }

  destroy(): void {
    this.bookmarkMarker?.stop()
    this.bookmarkMarker = null
  }

  private addDock(): void {
    const i18n = (this.plugin.i18n?.bookmarkMarker as unknown as Record<string, any>) || {}
    createVueDockApp(this.plugin, BookmarkMarkerPanel, {
      icon: "iconBookmark",
      title: i18n.title || "书签标记",
      type: "bookmark-marker-dock",
      width: 380,
      i18n,
      extraProps: {
        onBookmarkMarkerChange: this.handleChange.bind(this),
      },
    })
  }

  private async applySettings(): Promise<void> {
    try {
      const settings = await this.storage.settings.loadOrDefault()
      if (settings.enableBookmarkMarker) {
        this.bookmarkMarker = new BookmarkMarker({
          rules: settings.rules,
          updateInterval: settings.updateInterval,
        })
        await this.bookmarkMarker.start()
      }
    } catch (error) {
      console.error("应用书签标记样式失败:", error)
    }
  }

  private handleChange(action: string, data: any): void {
    switch (action) {
      case "toggle":
        if (data.enabled) {
          if (!this.bookmarkMarker) {
            this.bookmarkMarker = new BookmarkMarker({
              rules: data.rules,
              updateInterval: data.updateInterval,
            })
          }
          this.bookmarkMarker.start()
        } else {
          this.bookmarkMarker?.stop()
        }
        break
      case "rulesChanged":
        this.bookmarkMarker?.updateOptions({ rules: data.rules })
        break
      case "intervalChanged":
        this.bookmarkMarker?.setUpdateInterval(data.updateInterval)
        break
      case "refresh":
        if (this.bookmarkMarker?.isActive) {
          this.bookmarkMarker.updateOptions({ rules: this.bookmarkMarker.getRules() })
        }
        break
      case "settingsChanged":
        break
    }
  }
}

export function registerBookmarkMarker(plugin: Plugin) {
  const manager = new BookmarkMarkerManager(plugin)
  manager.init()
  ;(plugin as any).__bookmarkMarker = manager
}

export function unregisterBookmarkMarker(plugin: Plugin) {
  const manager = (plugin as any).__bookmarkMarker as BookmarkMarkerManager | undefined
  manager?.destroy()
}
