/**
 * 文本对比功能类型定义 + 管理器类
 */
import type { Plugin } from "siyuan"
import type { ModalAppInstance } from "@/utils/vueAppHelper"
import { createModalVueApp } from "@/utils/vueAppHelper"
import TextDiffPanel from "../index.vue"

export * from "./storage"

/**
 * 文本对比管理器
 */
export class TextDiffManager {
  private plugin: Plugin
  private modal: ModalAppInstance

  constructor(plugin: Plugin) {
    this.plugin = plugin

    // 使用共享 Modal 辅助工具创建弹窗
    this.modal = createModalVueApp(TextDiffPanel, {
      maskId: "text-diff-mask",
      width: "72vw", // 弹窗宽度随窗口自适应（较默认 90vw 收窄 20%，保证双列输入可读性）
      height: "80vh",
      getCloseHandler: () => this.close,
      buildProps: () => ({
        onClose: this.close,
        i18n: this.plugin.i18n,
        plugin: this.plugin,
      }),
    })
  }

  /**
   * 切换文本对比工具显示/隐藏
   */
  public toggle = () => {
    if (this.modal.visible) {
      this.close()
    } else {
      this.open()
    }
  }

  /**
   * 打开文本对比工具
   */
  private open() {
    this.modal.open()
  }

  /**
   * 关闭文本对比工具
   */
  private close = () => {
    this.modal.close()
  }

  /**
   * 销毁管理器（插件卸载时彻底清理 Modal 实例与 DOM）
   */
  public destroy() {
    this.modal.destroy()
  }
}
