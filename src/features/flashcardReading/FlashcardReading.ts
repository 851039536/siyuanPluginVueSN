/**
 * 单词阅读功能 - 注册与管理
 */
import type { Plugin } from "siyuan"
import type { I18n } from "./types"
import type { FlashcardStorage } from "./types/storage"
import type { ModalAppInstance } from "@/utils/vueAppHelper"
import {
  createModalVueApp,
  createVueDockApp,
} from "@/utils/vueAppHelper"
import FlashcardDialog from "./components/FlashcardDialog.vue"
import {
  getSharedFlashcardStorage,
  resetFlashcardStorage,
} from "./composables/useFlashcardStorage"
import { DEFAULT_I18N } from "./composables/useI18n"
import { FlashcardTabManager } from "./types"
import FlashcardReadingPanel from "./index.vue"

let flashcardModal: ModalAppInstance | null = null
let dialogPlugin: Plugin | null = null
let dialogI18n: any = null

export function showFlashcardDialog(plugin?: Plugin, i18n?: any) {
  if (plugin) dialogPlugin = plugin
  if (i18n) dialogI18n = i18n

  if (!flashcardModal) {
    flashcardModal = createModalVueApp(FlashcardDialog, {
      maskId: "flashcard-dialog-mask",
      width: "440px",
      height: "auto",
      getCloseHandler: () => hideFlashcardDialog,
      buildProps: () => ({
        i18n: dialogI18n || {},
        plugin: dialogPlugin!,
        onClose: () => {
          flashcardModal?.close()
        },
      }),
    })
  }

  flashcardModal.open()
}

export function hideFlashcardDialog() {
  flashcardModal?.close()
}

export function toggleFlashcardDialog(plugin?: Plugin, i18n?: any) {
  if (plugin) dialogPlugin = plugin
  if (i18n) dialogI18n = i18n

  if (flashcardModal?.visible) {
    hideFlashcardDialog()
  } else {
    showFlashcardDialog(plugin, i18n)
  }
}

export class FlashcardReading {
  private plugin: Plugin
  private storage: FlashcardStorage
  private tabManager: FlashcardTabManager

  constructor(plugin: Plugin) {
    this.plugin = plugin
    // 复用模块级共享 storage 单例，避免与 Dock/弹窗重复实例化
    this.storage = getSharedFlashcardStorage(plugin)
    // 独立窗口页签管理器（addTab 需在注册期同步调用，构造时完成）
    this.tabManager = new FlashcardTabManager(plugin)
  }

  public async init() {
    this.addDock()
    await this.storage.init()

    if (!dialogPlugin) dialogPlugin = this.plugin
    if (!dialogI18n) dialogI18n = this.plugin.i18n?.flashcardReading || {}
  }

  /** 在独立浮动窗口打开单词阅读（openTab + openWindow 双形态） */
  public openFloating() {
    return this.tabManager.openFloating()
  }

  private addDock() {
    createVueDockApp(this.plugin, FlashcardReadingPanel, {
      position: "RightTop",
      width: 400,
      icon: "iconBookmark",
      title:
        (this.plugin.i18n?.flashcardReading as I18n)?.panelTitle
        || DEFAULT_I18N.panelTitle,
      type: "flashcardreading-dock",
      i18n:
        (this.plugin.i18n?.flashcardReading as I18n) || ({} as I18n),
    })
  }

  /** 插件卸载时清理：销毁浮动弹窗 + 页签面板 + 重置模块级引用，dock 交由思源框架回收 */
  public destroy() {
    flashcardModal?.destroy()
    flashcardModal = null
    dialogPlugin = null
    dialogI18n = null
    this.tabManager.destroy()
    resetFlashcardStorage()
  }
}
