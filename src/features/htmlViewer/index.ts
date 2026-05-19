/**
 * HTML展示功能模块（注册入口）
 * 支持：
 * 1. 右键编辑器 → 菜单中出现"HTML展示"（始终出现）
 *    - 若已选中文本，预览选中内容
 *    - 若未选中文本，预览右键所在块的HTML
 * 2. 块引用上右键 → "HTML展示"
 * 3. HTML片段的增删改查
 */
import { Plugin, showMessage } from "siyuan"
import { emitCustomEvent } from "@/utils/eventBus"

export class HtmlViewer {
  private plugin: Plugin

  constructor(plugin: Plugin) {
    this.plugin = plugin
  }

  /**
   * 初始化
   */
  async init() {
    this.registerContextMenu()
  }

  /**
   * 销毁模块
   */
  destroy() {
    this.plugin.eventBus.off("open-menu-content", this.handleEditorContextMenu)
    this.plugin.eventBus.off("open-menu-blockref", this.handleEditorContextMenu)
  }

  /**
   * 注册右键菜单
   */
  private registerContextMenu() {
    // 编辑器区域右键（含块引用）
    this.plugin.eventBus.on("open-menu-content", this.handleEditorContextMenu)
    this.plugin.eventBus.on("open-menu-blockref", this.handleEditorContextMenu)
  }

  /**
   * 处理右键菜单事件
   * 始终添加"HTML展示"菜单项，点击后：
   * - 有选中文本 → 预览选中内容
   * - 无选中文本 → 从事件详情中获取块 HTML 内容
   */
  private handleEditorContextMenu = (event: any) => {
    const menu = event.detail.menu

    menu.addItem({
      iconHTML: "🌐",
      label: "HTML展示",
      click: () => {
        const selectedText = window.getSelection()?.toString().trim()
        if (selectedText) {
          this.showHtmlPreview(selectedText)
        } else {
          // 无选中文本时，从右键所在块获取内容
          const content = this.getBlockContentFromEvent(event)
          if (content) {
            this.showHtmlPreview(content)
          } else {
            showMessage("未获取到内容，请先选中文本", 2000, "info")
          }
        }
      },
    })
  }

  /**
   * 从右键事件详情中提取所在块的 HTML 内容
   */
  private getBlockContentFromEvent(event: any): string {
    try {
      const element = event.detail.element
      if (!element) return ""

      // 向上查找包含 data-node-id 的块级元素
      const blockEl = element.closest?.("[data-node-id]")
        || element.parentElement?.closest?.("[data-node-id]")
      if (blockEl) {
        return blockEl.innerHTML?.trim() || ""
      }

      // 兜底：取元素自身的内容
      return element.innerHTML?.trim() || element.textContent?.trim() || ""
    } catch (e) {
      console.error("获取块内容失败:", e)
      return ""
    }
  }

  /**
   * 显示HTML预览弹窗
   */
  private showHtmlPreview(content: string) {
    emitCustomEvent("openHtmlViewer", { content })
  }
}

let htmlViewerInstance: HtmlViewer | null = null

/**
 * 注册HTML展示功能
 */
export async function registerHtmlViewer(plugin: Plugin) {
  htmlViewerInstance = new HtmlViewer(plugin)
  await htmlViewerInstance.init()
  ;(plugin as any).__htmlViewer = htmlViewerInstance
}


