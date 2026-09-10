/**
 * 书签标记功能模块
 * 根据文档书签内容在文件树中显示颜色标记
 */
import type { Plugin } from "siyuan"
import type { ModalAppInstance } from "@/utils/vueAppHelper"
import type { BookmarkMarkerActionPayload, BookmarkMarkerI18n } from "./types"
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

    // i18n 兼容两种合并结构：扁平（各键位于顶层，当前风格）与嵌套（bookmarkMarker 子对象）
    const i18n = (
      (plugin.i18n as unknown as { bookmarkMarker?: BookmarkMarkerI18n }).bookmarkMarker
      ?? plugin.i18n
    ) as unknown as BookmarkMarkerI18n
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
    // applySettings 内部已 try-catch，无需额外兜底
    void this.applySettings()
  }

  destroy(): void {
    this.bookmarkMarker?.stop()
    this.bookmarkMarker = null
    // destroy 卸载 Vue 实例并移除遮罩 DOM，仅 close 会残留（对齐 websiteNavigation 的 Manager 写法）
    this.modal.destroy()
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

  /** 面板变更派发（判别联合载荷，取代原先的 (action: string, data: any)） */
  private handleChange(payload: BookmarkMarkerActionPayload): void {
    switch (payload.action) {
      case "toggle":
        if (payload.enabled) {
          if (this.bookmarkMarker) {
            // 重新启用时同步最新配置，避免沿用禁用期间的旧规则/旧间隔
            this.bookmarkMarker.updateOptions({ rules: normalizeRules(payload.rules) })
            this.bookmarkMarker.setUpdateInterval(payload.updateInterval)
          } else {
            this.bookmarkMarker = new BookmarkMarker({
              rules: normalizeRules(payload.rules),
              updateInterval: payload.updateInterval,
            })
          }
          // start() 内部已对书签查询链路做异常兜底，此处仍需 catch 以防同步异常冒泡
          void this.bookmarkMarker.start().catch((error) => {
            console.error("启动书签标记失败:", error)
          })
        } else {
          this.bookmarkMarker?.stop()
        }
        break
      case "rulesChanged":
        this.bookmarkMarker?.updateOptions({ rules: normalizeRules(payload.rules) })
        break
      case "intervalChanged":
        this.bookmarkMarker?.setUpdateInterval(payload.updateInterval)
        break
    }
  }
}

export function registerBookmarkMarker(plugin: Plugin): void {
  const manager = new BookmarkMarkerManager(plugin)
  manager.init()
  // 挂载到 plugin 实例：onunload 经 DESTROYABLE_KEYS 销毁，App.vue 经 __bookmarkMarker.open() 调度
  ;(plugin as any).__bookmarkMarker = manager
}
