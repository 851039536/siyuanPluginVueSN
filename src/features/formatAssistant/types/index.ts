import type { App as VueApp } from "vue"
import type { Plugin } from "siyuan"
import { createApp, h } from "vue"
import FormatAssistantPanel from "../index.vue"

export * from "./storage"

/**
 * 排版助手管理器
 */
export class FormatAssistantManager {
  private plugin: Plugin
  private app: VueApp | null = null
  private container: HTMLElement | null = null

  constructor(plugin: Plugin) {
    this.plugin = plugin
    this.addCommand()
  }

  /**
   * 注册命令
   */
  private addCommand() {
    this.plugin.addCommand({
      command: "openFormatAssistant",
      title: "打开排版助手",
      hotkey: "Ctrl+Alt+F",
      callback: () => {
        this.open()
      },
    })
  }

  /**
   * 切换排版助手显示/隐藏
   */
  public toggle = () => {
    if (this.app && this.container) {
      this.close()
    } else {
      this.open()
    }
  }

  /**
   * 打开排版助手
   */
  public open() {
    // 如果已打开则先关闭
    if (this.app && this.container) {
      this.close()
    }

    // 创建遮罩层
    const mask = document.createElement("div")
    mask.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    `
    mask.id = "format-assistant-mask"

    // 创建容器
    this.container = document.createElement("div")
    this.container.style.cssText = `
      width: 90vw;
      height: 85vh;
      background: var(--b3-theme-background);
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      position: relative;
    `

    mask.appendChild(this.container)
    document.body.appendChild(mask)

    // 点击遮罩层关闭
    mask.onclick = (e) => {
      if (e.target === mask) {
        this.close()
      }
    }

    // 创建 Vue 应用
    this.app = createApp({
      setup: () => {
        return () =>
          h(FormatAssistantPanel, {
            onClose: this.close,
            i18n: this.plugin.i18n,
            plugin: this.plugin,
          })
      },
    })

    this.app.mount(this.container)
  }

  /**
   * 关闭排版助手
   */
  public close = () => {
    if (this.app) {
      this.app.unmount()
      this.app = null
    }

    const mask = document.getElementById("format-assistant-mask")
    if (mask) {
      mask.remove()
    }

    this.container = null
  }

  /**
   * 销毁管理器
   */
  public destroy() {
    this.close()
  }
}
