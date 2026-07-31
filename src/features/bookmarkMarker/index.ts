/**
 * 书签标记功能模块
 * 根据文档书签内容在文件树中显示颜色标记
 */
import type { Plugin } from "siyuan"
import type { ModalAppInstance } from "@/utils/vueAppHelper"
import { createModalVueApp } from "@/utils/vueAppHelper"
import { BookmarkMarker } from "./modules/BookmarkMarker"
import { BookmarkMarkerStorage } from "./types/storage"
import { normalizeRules } from "./utils"
import BookmarkMarkerPanel from "./index.vue"

export class BookmarkMarkerManager {
  private storage: BookmarkMarkerStorage
  private bookmarkMarker: BookmarkMarker | null = null
  private modal: ModalAppInstance

  constructor(plugin: Plugin) {
    this.storage = new BookmarkMarkerStorage(plugin)

    const i18n = (plugin.i18n?.bookmarkMarker as unknown as Record<string, any>) || {}
    const close = this.close.bind(this)

    this.modal = createModalVueApp(BookmarkMarkerPanel, {
      maskId: "bookmark-marker-mask",
      width: "644px",
      height: "85vh",
      getCloseHandler: () => close,
      buildProps: () => ({
        onClose: close,
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
          rules: normalizeRules(settings.rules),
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
          if (this.bookmarkMarker) {
            // 重新启用时同步最新配置，避免沿用禁用期间的旧规则/旧间隔
            this.bookmarkMarker.updateOptions({ rules: normalizeRules(data.rules) })
            this.bookmarkMarker.setUpdateInterval(data.updateInterval)
          } else {
            this.bookmarkMarker = new BookmarkMarker({
              rules: normalizeRules(data.rules),
              updateInterval: data.updateInterval,
            })
          }
          this.bookmarkMarker.start()
        } else {
          this.bookmarkMarker?.stop()
        }
        break
      case "rulesChanged":
        this.bookmarkMarker?.updateOptions({ rules: normalizeRules(data.rules) })
        break
      case "intervalChanged":
        this.bookmarkMarker?.setUpdateInterval(data.updateInterval)
        break
    }
  }
}

export function registerBookmarkMarker(plugin: Plugin): BookmarkMarkerManager {
  const manager = new BookmarkMarkerManager(plugin)
  manager.init()
  // 挂载到 plugin 实例：onunload 经 DESTROYABLE_KEYS 销毁，App.vue 经 __bookmarkMarker.open() 调度
  ;(plugin as any).__bookmarkMarker = manager
  return manager
}
