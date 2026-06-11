/**
 * 单词阅读功能 - 注册与管理
 */
import type { Plugin } from "siyuan"
import type { I18n } from "./types"
import type { ModalAppInstance } from "@/utils/vueAppHelper"
import { createModalVueApp, createVueDockApp } from "@/utils/vueAppHelper"
import FlashcardDialog from "./components/FlashcardDialog.vue"
import FlashcardReadingPanel from "./index.vue"
import { FlashcardStorage } from "./types/storage"

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

  constructor(plugin: Plugin) {
    this.plugin = plugin
    this.storage = new FlashcardStorage(plugin)
  }

  public async init() {
    this.addDock()
    await this.storage.init()

    if (!dialogPlugin) dialogPlugin = this.plugin
    if (!dialogI18n) dialogI18n = this.plugin.i18n?.flashcardReading || {}
  }

  private addDock() {
    createVueDockApp(this.plugin, FlashcardReadingPanel, {
      position: "RightTop",
      width: 400,
      icon: "iconBookmark",
      title:
        (this.plugin.i18n as any)?.flashcardReading?.panelTitle || "单词阅读",
      type: "flashcardreading-dock",
      i18n:
        (this.plugin.i18n?.flashcardReading as I18n) || ({} as I18n),
    })
  }

  public destroy() {}
}
