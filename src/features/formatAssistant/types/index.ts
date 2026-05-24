import type { Plugin } from "siyuan"
import type { ModalAppInstance } from "@/utils/vueAppHelper"
import { createIconElement } from "@/utils/iconHelper"
import { createModalVueApp } from "@/utils/vueAppHelper"
import FormatAssistantPanel from "../index.vue"

export * from "./storage"

/**
 * 排版助手管理器
 */
export class FormatAssistantManager {
  private plugin: Plugin
  private modal: ModalAppInstance
  private statusBarElement: HTMLElement | null = null

  constructor(plugin: Plugin) {
    this.plugin = plugin

    // 使用共享 Modal 辅助工具创建弹窗
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
    this.addStatusBar()
  }

  /**
   * 注册命令
   */
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

  /**
   * 添加底部状态栏图标
   */
  private addStatusBar() {
    const iconElement = createIconElement("mdi:format-align-left", 16, "#07c160")
    iconElement.style.cursor = "pointer"
    iconElement.style.height = "29px"
    iconElement.style.display = "inline-flex"
    iconElement.style.alignItems = "center"
    iconElement.style.justifyContent = "center"
    iconElement.style.padding = "0 4px"
    iconElement.title = "排版助手"
    iconElement.addEventListener("click", () => {
      this.open()
    })

    this.statusBarElement = this.plugin.addStatusBar({
      element: iconElement,
      position: "right",
    })
  }

  /**
   * 切换排版助手显示/隐藏
   */
  public toggle = () => {
    if (this.modal.app && this.modal.container) {
      this.close()
    } else {
      this.open()
    }
  }

  /**
   * 打开排版助手
   */
  public open() {
    this.modal.open()
  }

  /**
   * 关闭排版助手
   */
  public close = () => {
    this.modal.close()
  }

  /**
   * 销毁管理器
   */
  public destroy() {
    this.close()
    if (this.statusBarElement) {
      this.statusBarElement.remove()
      this.statusBarElement = null
    }
  }
}
