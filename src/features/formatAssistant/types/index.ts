import type { Plugin } from "siyuan"
import type { ModalAppInstance } from "@/utils/vueAppHelper"
import { createModalVueApp } from "@/utils/vueAppHelper"
import FormatAssistantPanel from "../index.vue"

export * from "./storage"

/**
 * 排版助手管理器
 */
export class FormatAssistantManager {
  private plugin: Plugin
  private modal: ModalAppInstance

  constructor(plugin: Plugin) {
    this.plugin = plugin

    this.modal = createModalVueApp(FormatAssistantPanel, {
      maskId: "format-assistant-mask",
      width: "90vw",
      height: "85vh",
      getCloseHandler: () => this.close.bind(this),
      buildProps: () => ({
        onClose: this.close.bind(this),
        i18n: this.plugin.i18n,
        plugin: this.plugin,
      }),
    })

    this.addCommand()
  }

  private addCommand() {
    this.plugin.addCommand({
      command: "openFormatAssistant",
      title: "打开排版助手",
      hotkey: "⌃⌥G",
      callback: () => {
        this.open()
      },
    })
  }

  public toggle = () => {
    if (this.modal.app && this.modal.container) {
      this.close()
    } else {
      this.open()
    }
  }

  public open() {
    this.modal.open()
  }

  public close = () => {
    this.modal.close()
  }

  public destroy() {
    this.close()
  }
}
