import { Plugin } from "siyuan"
import { FlashcardStorage } from "@/features/flashcardReading/types/storage"
import { copyToClipboard } from "@/utils/domUtils"
import {
  ToolbarAction,
  ToolbarActionManager,
} from "../types"
import { HeatmapMarker } from "./HeatmapMarker"
import {
  debounce,
  showI18nMessage,
} from "./utils"

/**
 * 浮动工具栏增强类
 * 为思源笔记的原生浮动工具栏添加自定义功能按钮
 */
export class FloatingToolbar {
  private plugin: Plugin
  private actionManager: ToolbarActionManager
  private flashcardStorage: FlashcardStorage
  private heatmapMarker: HeatmapMarker
  private lastSelectionText: string = ""
  private observers: Map<HTMLElement, MutationObserver> = new Map()
  private isProcessing: boolean = false
  private readonly debouncedHandleMouseUp: () => void
  private readonly styleId = "floating-toolbar-enhanced-styles"
  private readonly notebookHighlightClass = "word-from-notebook"
  /** 单词本标题缓存（小写），避免每次 mouseup 都全量 I/O 查询 */
  private wordSetCache: Set<string> = new Set()
  /** 缓存时间戳，用于 TTL 过期刷新 */
  private wordCacheTimestamp: number = 0
  /** 缓存 TTL（毫秒），与 HeatmapMarker 保持一致 */
  private readonly WORD_CACHE_TTL_MS = 30000

  constructor(plugin: Plugin) {
    this.plugin = plugin
    this.actionManager = new ToolbarActionManager()
    this.flashcardStorage = new FlashcardStorage(plugin)
    this.heatmapMarker = new HeatmapMarker(plugin)
    // 防抖处理选择事件，避免频繁触发
    this.debouncedHandleMouseUp = debounce(
      this.handleSelectionChange.bind(this),
      300,
    )
  }

  /**
   * 初始化浮动工具栏增强
   */
  init(): void {
    // 注册所有内置功能
    this.registerBuiltinActions()
    // 绑定事件监听器
    this.bindEvents()
    // 添加样式（仅添加一次）
    this.ensureStyles()
  }

  /**
   * 启用热力图标记功能
   */
  async enableHeatmapMarker(): Promise<void> {
    await this.heatmapMarker.enable()
  }

  /**
   * 禁用热力图标记功能
   */
  disableHeatmapMarker(): void {
    this.heatmapMarker.disable()
  }

  /**
   * 注册内置功能
   */
  private registerBuiltinActions() {
    // 注册复制功能
    this.actionManager.registerAction({
      id: "copy",
      name: (this.plugin.i18n as any)?.floatingToolbar?.copy || "复制",
      icon: '<svg><use xlink:href="#iconCopy"></use></svg>',
      hotkey: undefined,
      handler: this.copyText.bind(this),
    })
  }

  /**
   * 注册新功能（供外部使用）
   */
  registerAction(action: ToolbarAction) {
    this.actionManager.registerAction(action)
  }

  /**
   * 移除功能
   */
  unregisterAction(actionId: string) {
    this.actionManager.unregisterAction(actionId)
  }

  /**
   * 绑定事件监听器
   * 使用防抖处理 mouseup 事件
   */
  private bindEvents() {
    document.addEventListener("mouseup", this.handleDocumentMouseUp, {
      passive: true,
    })
  }

  /**
   * 处理文档级别的鼠标释放事件
   * 使用箭头函数保持上下文
   */
  private handleDocumentMouseUp = () => {
    // 获取当前选择
    const selection = window.getSelection()
    const selectedText = selection?.toString().trim() || ""

    // 记录当前选择内容用于防抖比较
    this.lastSelectionText = selectedText

    // 选择为空时清理工具栏
    if (!selectedText) {
      this.cleanupAllToolbars()
      return
    }

    // 检测是否为英文单词，并查询是否来自单词本
    this.checkAndHighlightWordInNotebook(selectedText)

    // 使用防抖处理
    this.debouncedHandleMouseUp()
  }

  /**
   * 处理选择变化（防抖后调用）
   */
  private handleSelectionChange() {
    const selectedText = this.lastSelectionText

    // 选择内容有效，开始处理
    if (selectedText) {
      this.processSelection()
    }
  }

  /**
   * 刷新单词本缓存
   * 仅在缓存过期或首次使用时调用
   */
  private async refreshWordCache(): Promise<void> {
    try {
      const allCards = await this.flashcardStorage.getAllCards()
      this.wordSetCache.clear()
      for (const card of allCards) {
        if (card.title) {
          this.wordSetCache.add(card.title.toLowerCase())
        }
      }
      this.wordCacheTimestamp = Date.now()
    } catch {
      // 缓存刷新失败，下次重试
    }
  }

  /**
   * 确保单词缓存有效
   */
  private async ensureWordCacheFresh(): Promise<void> {
    if (Date.now() - this.wordCacheTimestamp > this.WORD_CACHE_TTL_MS) {
      await this.refreshWordCache()
    }
  }

  /**
   * 检测选中的英文单词是否来自单词本，并高亮背景
   * 仅当选中内容为纯英文字母时进行检测
   */
  private async checkAndHighlightWordInNotebook(selectedText: string) {
    if (!/^[a-z]+$/i.test(selectedText)) {
      this.removeNotebookHighlight()
      return
    }

    try {
      await this.ensureWordCacheFresh()
      const found = this.wordSetCache.has(selectedText.toLowerCase())

      if (found) {
        document.body.classList.add(this.notebookHighlightClass)
      } else {
        this.removeNotebookHighlight()
      }
    } catch {
      this.removeNotebookHighlight()
    }
  }

  /**
   * 移除单词本高亮标记
   */
  private removeNotebookHighlight() {
    document.body.classList.remove(this.notebookHighlightClass)
  }

  /**
   * 处理选择状态
   */
  private processSelection() {
    if (this.isProcessing) return
    this.isProcessing = true

    try {
      const selection = window.getSelection()

      if (!selection?.rangeCount) {
        return
      }

      // 查找选择范围内的 protyle 容器
      const range = selection.getRangeAt(0)
      const protyle = this.findProtyleContainer(range.commonAncestorContainer)

      if (protyle) {
        this.processToolbar(protyle)
      }
    } finally {
      // 使用 requestAnimationFrame 延迟重置处理状态
      requestAnimationFrame(() => {
        this.isProcessing = false
      })
    }
  }

  /**
   * 查找 protyle 容器
   * @param startNode 起始节点
   * @returns protyle 元素或 null
   */
  private findProtyleContainer(startNode: Node): Element | null {
    // 对于 Element，使用 closest
    if (startNode instanceof Element) {
      const protyle = startNode.closest(".protyle")
      if (protyle) return protyle
    }

    // 尝试通过 parentNode 查找（对于文本节点）
    let node: Node | null = startNode
    while (node) {
      if (node instanceof Element && node.classList.contains("protyle")) {
        return node
      }
      node = node.parentNode
    }

    return null
  }

  /**
   * 处理单个工具栏
   */
  private processToolbar(protyle: Element) {
    const toolbar = protyle.querySelector(".protyle-toolbar") as HTMLElement
    if (!toolbar) return

    // 使用 requestAnimationFrame 在下一帧添加按钮
    requestAnimationFrame(() => {
      this.addCustomButtons(toolbar, protyle)
    })
  }

  /**
   * 清理所有工具栏的标记
   */
  private cleanupAllToolbars() {
    const toolbars = document.querySelectorAll(
      '[data-custom-buttons-added="true"]',
    )
    toolbars.forEach((toolbar) => {
      toolbar.removeAttribute("data-custom-buttons-added")
    })
    // 清理 observers
    this.observers.forEach((observer) => {
      observer.disconnect()
    })
    this.observers.clear()
    // 移除单词本高亮
    this.removeNotebookHighlight()
  }

  /**
   * 添加自定义按钮到工具栏
   */
  private addCustomButtons(toolbar: HTMLElement, protyle: Element) {
    // 防止重复添加
    if (toolbar.dataset.customButtonsAdded === "true") return
    toolbar.dataset.customButtonsAdded = "true"

    // 获取所有已注册的功能
    const actions = this.actionManager.getAllActions()

    // 反转数组并添加按钮（以便按注册顺序显示）
    // 使用 DocumentFragment 批量添加，减少重排
    const fragment = document.createDocumentFragment()

    actions.reverse().forEach((action) => {
      // 检查按钮是否已存在
      if (toolbar.querySelector(`button[data-type="${action.id}"]`)) return

      // 创建按钮元素（而不是使用 insertAdjacentHTML）
      const button = this.createActionButton(action, toolbar, protyle)
      if (button) {
        fragment.appendChild(button)
      }
    })

    // 在工具栏开头批量插入按钮
    if (toolbar.firstChild) {
      toolbar.insertBefore(fragment, toolbar.firstChild)
    } else {
      toolbar.appendChild(fragment)
    }

    // 监听工具栏隐藏事件，移除标记
    this.setupToolbarObserver(toolbar)
  }

  /**
   * 创建操作按钮
   */
  private createActionButton(
    action: ToolbarAction,
    toolbar: HTMLElement,
    protyle: Element,
  ): HTMLButtonElement | null {
    const button = document.createElement("button")
    button.className =
      "protyle-toolbar__item b3-tooltips b3-tooltips__ne custom-toolbar-button"
    button.dataset.type = action.id
    button.setAttribute("aria-label", action.name)
    button.style.cssText = "font-size:14px;"
    button.innerHTML = action.icon

    if (action.hotkey) {
      button.setAttribute("data-hotkey", action.hotkey)
    }

    // 绑定点击事件（按钮随工具栏 DOM 重建，监听器自动释放）
    button.addEventListener(
      "click",
      async (clickEvent) => {
        clickEvent.stopPropagation()
        // 隐藏工具栏
        toolbar.classList.add("fn__none")
        // 获取选中的文本
        const selectedText = this.getSelection(protyle)
        // 执行按钮功能
        try {
          await action.handler(selectedText)
        } catch (error) {
          console.error(`Action ${action.id} failed:`, error)
        }
      },
    )

    return button
  }

  /**
   * 设置工具栏观察器
   */
  private setupToolbarObserver(toolbar: HTMLElement) {
    // 清理旧的 observer
    const existingObserver = this.observers.get(toolbar)
    if (existingObserver) {
      existingObserver.disconnect()
    }

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === "attributes"
          && mutation.attributeName === "class"
          && toolbar.classList.contains("fn__none")
        ) {
          toolbar.removeAttribute("data-custom-buttons-added")
          observer.disconnect()
          this.observers.delete(toolbar)
          break
        }
      }
    })

    observer.observe(toolbar, {
      attributes: true,
      attributeFilter: ["class"],
    })

    this.observers.set(toolbar, observer)
  }

  /**
   * 获取选中的文本
   */
  private getSelection(protyle: Element): string {
    const selection = window.getSelection()?.toString().trim()
    if (selection) return selection

    // 处理多选块
    const selects = protyle.querySelectorAll(".protyle-wysiwyg--select")
    if (selects.length > 0) {
      return Array.from(selects)
        .map((block) => block.textContent || "")
        .join("\n")
    }

    return ""
  }

  /**
   * 复制文本
   */
  private async copyText(text: string) {
    if (!text) {
      showI18nMessage(this.plugin, "noTextSelected", "未选中文本")
      return
    }

    const success = await copyToClipboard(text)
    if (success) {
      showI18nMessage(this.plugin, "copySuccess", "已复制到剪贴板")
    } else {
      showI18nMessage(this.plugin, "copyFailed", "复制失败")
    }
  }

  /**
   * 确保样式已添加（单例模式）
   */
  private ensureStyles() {
    if (document.getElementById(this.styleId)) return

    const style = document.createElement("style")
    style.id = this.styleId
    style.textContent = `
            /* 自定义浮动工具栏按钮样式 */
            .custom-toolbar-button {
            }

            .custom-toolbar-button:hover {
                background-color: var(--b3-theme-surface-lighter);
            }

            .custom-toolbar-button:active {
                background-color: var(--b3-theme-surface);
            }

            /* 单词本词汇选中高亮 */
            body.word-from-notebook .protyle-wysiwyg ::selection {
                background: rgba(255, 193, 7, 0.5) !important;
                color: var(--b3-protyle-color, inherit) !important;
                text-shadow: 0 0 1px rgba(0, 0, 0, 0.1);
            }
        `
    document.head.appendChild(style)
  }

  /**
   * 销毁工具栏增强，清理资源
   */
  destroy() {
    // 移除事件监听
    document.removeEventListener("mouseup", this.handleDocumentMouseUp)

    // 复用统一的清理逻辑
    this.cleanupAllToolbars()

    // 销毁热力图标记
    this.heatmapMarker.destroy()

    // 移除注入的样式
    document.getElementById(this.styleId)?.remove()

    // 清理功能管理器
    this.actionManager.clear()
  }
}
