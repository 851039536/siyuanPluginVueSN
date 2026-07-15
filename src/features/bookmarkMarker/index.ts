/**
 * 书签标记功能模块
 * 根据文档书签内容在文件树中显示颜色标记
 */
import type { Plugin } from "siyuan"
import type { ModalAppInstance } from "@/utils/vueAppHelper"
import { createModalVueApp } from "@/utils/vueAppHelper"
import { BookmarkMarker } from "./modules/BookmarkMarker"
import { BookmarkMarkerStorage } from "./types/storage"
import BookmarkMarkerPanel from "./index.vue"

export class BookmarkMarkerManager {
  private storage: BookmarkMarkerStorage
  private bookmarkMarker: BookmarkMarker | null = null
  private modal: ModalAppInstance

  constructor(plugin: Plugin) {
    this.storage = new BookmarkMarkerStorage(plugin)

    const i18n = (plugin.i18n?.bookmarkMarker as unknown as Record<string, any>) || {}

    this.modal = createModalVueApp(BookmarkMarkerPanel, {
      maskId: "bookmark-marker-mask",
      width: "644px",
      height: "85vh",
      getCloseHandler: () => this.close.bind(this),
      buildProps: () => ({
        onClose: this.close.bind(this),
        onBookmarkMarkerChange: this.handleChange.bind(this),
        i18n,
        plugin,
      }),
    })
  }

  init(): void {
    this.applySettings()
  }

  destroy(): void {
    this.bookmarkMarker?.stop()
    this.bookmarkMarker = null
    this.modal.close()
  }

  open(): void {
    this.modal.open()
  }

  close(): void {
    this.modal.close()
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

export function registerBookmarkMarker(plugin: Plugin): BookmarkMarkerManager {
  const manager = new BookmarkMarkerManager(plugin)
  manager.init()
  return manager
}
