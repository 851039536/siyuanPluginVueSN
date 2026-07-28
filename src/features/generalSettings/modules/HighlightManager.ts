/**
 * 双击高亮管理器
 * 在文档编辑器中双击选中文本，自动高亮所有匹配内容
 *
 * 使用 CSS Custom Highlight API（CSS.highlights + Range）着色，
 * 完全不修改编辑器 DOM：浏览器选区不受破坏，思源的浮动工具栏、
 * 块引用浮窗与内核事务均不受影响。
 *
 * 注意：::highlight() 伪元素仅支持不影响布局的属性
 * （background-color / color / text-decoration / text-shadow 等），
 * 因此不提供字号、加粗等排版类配置。
 */
const HIGHLIGHT_STYLE_ID = "highlight-feature-styles"
/** CSS.highlights 注册名，对应样式中的 ::highlight() 选择器 */
const HIGHLIGHT_NAME = "plugin-double-click-highlight"

export interface HighlightOptions {
  backgroundColor?: string
  minTextLength?: number
  minLetterLength?: number
  maxTextLength?: number
  maxLetterLength?: number
}

const DEFAULT_OPTIONS: Required<HighlightOptions> = {
  backgroundColor: "rgb(255, 220, 60)",
  minTextLength: 1,
  minLetterLength: 1,
  maxTextLength: 50,
  maxLetterLength: 100,
}

export class HighlightManager {
  private selectedText = ""
  private styleAdded = false
  private active = false
  private toastEl: HTMLDivElement | null = null
  private toastHideTimer: ReturnType<typeof setTimeout> | null = null
  private options: Required<HighlightOptions> = { ...DEFAULT_OPTIONS }

  constructor(options?: HighlightOptions) {
    if (options) this.updateOptions(options)
  }

  /** 当前环境是否支持 CSS Custom Highlight API（思源 Electron 为现代 Chromium，正常均支持） */
  static isSupported(): boolean {
    return typeof CSS !== "undefined" && "highlights" in CSS
  }

  updateOptions(options: HighlightOptions) {
    Object.assign(this.options, options)
    if (this.active) {
      this.removeStyles()
      this.addStyles()
    }
  }

  enable() {
    if (this.active) return
    if (!HighlightManager.isSupported()) {
      console.warn("当前环境不支持 CSS Custom Highlight API，双击高亮功能不可用")
      return
    }
    this.active = true
    this.addStyles()
    document.addEventListener("mouseup", this.handleMouseUp)
    document.addEventListener("mousedown", this.handleMouseDown)
  }

  disable() {
    if (!this.active) return
    this.active = false
    document.removeEventListener("mouseup", this.handleMouseUp)
    document.removeEventListener("mousedown", this.handleMouseDown)
    this.clearHighlights()
    this.selectedText = ""
    this.clearToast()
  }

  isActive(): boolean {
    return this.active
  }

  private handleMouseUp = (event: MouseEvent) => {
    const selection = window.getSelection()?.toString().trim()
    if (!selection || selection === this.selectedText) return

    const target = event.target as HTMLElement
    if (!target.closest(".protyle-wysiwyg")) return

    // 检查长度限制：分离中文字符和字母字符
    const textChars = selection.replace(/[a-z]/gi, "")
    const letterChars = selection.replace(/[^\x00-\x7F]|[^a-z]/gi, "")
    if (textChars.length > 0 && textChars.length < this.options.minTextLength) return
    if (letterChars.length > 0 && letterChars.length < this.options.minLetterLength) return
    if (textChars.length > 0 && textChars.length > this.options.maxTextLength) return
    if (letterChars.length > 0 && letterChars.length > this.options.maxLetterLength) return

    this.selectedText = selection
    const matchCount = this.highlightText(selection)
    this.showToast(selection, matchCount)
  }

  private handleMouseDown = () => {
    this.clearHighlights()
    this.selectedText = ""
  }

  private addStyles() {
    if (this.styleAdded) return
    if (document.getElementById(HIGHLIGHT_STYLE_ID)) {
      this.styleAdded = true
      return
    }

    const style = document.createElement("style")
    style.id = HIGHLIGHT_STYLE_ID
    style.textContent = `
      ::highlight(${HIGHLIGHT_NAME}) {
        background-color: ${this.options.backgroundColor};
        color: rgb(0, 0, 0);
      }
      .highlight-toast {
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--b3-theme-surface);
        color: var(--b3-theme-on-surface);
        padding: 10px 18px;
        border-radius: 6px;
        font-size: 13px;
        z-index: 10000;
        pointer-events: none;
        opacity: 0;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: center;
        gap: 8px;
        border: 1px solid var(--b3-border-color);
      }
      .highlight-toast.show {
        opacity: 1;
        transform: translateX(-50%) translateY(-4px);
      }
      .highlight-toast .count {
        color: var(--b3-theme-primary);
        font-weight: 600;
      }
    `
    document.head.appendChild(style)
    this.styleAdded = true
  }

  private removeStyles() {
    const existing = document.getElementById(HIGHLIGHT_STYLE_ID)
    if (existing) {
      existing.remove()
    }
    this.styleAdded = false
  }

  /**
   * 清除所有高亮（仅移除注册表条目，不触碰 DOM）
   */
  private clearHighlights() {
    if (HighlightManager.isSupported()) {
      CSS.highlights.delete(HIGHLIGHT_NAME)
    }
  }

  /**
   * 为文档中所有匹配文本创建 Range 并注册到 CSS.highlights，
   * 匹配可跨文本节点边界（单个 Range 天然支持跨节点起止点）
   */
  private highlightText(value: string): number {
    this.clearHighlights()

    const docRoot = document.querySelector(
      ".layout-tab-container > div:not(.fn__none) .protyle-wysiwyg",
    )
    if (!docRoot) return 0

    const str = value.trim()
    if (!str) return 0

    // 收集文本节点并记录每个节点在拼接全文中的位置
    const textParts: { node: Text, start: number, length: number }[] = []
    let fullText = ""
    const treeWalker = document.createTreeWalker(docRoot, NodeFilter.SHOW_TEXT)
    let walkerNode: Node | null
    while ((walkerNode = treeWalker.nextNode())) {
      const text = (walkerNode as Text).textContent ?? ""
      if (text.length === 0) continue
      textParts.push({
        node: walkerNode as Text,
        start: fullText.length,
        length: text.length,
      })
      fullText += text
    }

    const lowerFull = fullText.toLowerCase()
    const lowerStr = str.toLowerCase()
    const ranges: Range[] = []
    let searchFrom = 0
    // 匹配位置单调递增，用游标避免每次从头查找节点
    let partIdx = 0

    while ((searchFrom = lowerFull.indexOf(lowerStr, searchFrom)) !== -1) {
      const matchEnd = searchFrom + lowerStr.length

      // 起点节点：第一个覆盖 searchFrom 的文本节点
      while (partIdx < textParts.length && textParts[partIdx].start + textParts[partIdx].length <= searchFrom) {
        partIdx++
      }
      // 终点节点：第一个覆盖 matchEnd 的文本节点（从起点向后找）
      let endIdx = partIdx
      while (endIdx < textParts.length && textParts[endIdx].start + textParts[endIdx].length < matchEnd) {
        endIdx++
      }

      const startPart = textParts[partIdx]
      const endPart = textParts[endIdx]
      if (startPart && endPart) {
        try {
          const range = document.createRange()
          range.setStart(startPart.node, searchFrom - startPart.start)
          range.setEnd(endPart.node, matchEnd - endPart.start)
          ranges.push(range)
        } catch {
          // 跳过无效范围
        }
      }

      searchFrom = matchEnd
    }

    if (ranges.length > 0) {
      CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(...ranges))
    }
    return ranges.length
  }

  private showToast(text: string, count: number) {
    this.clearToast()

    if (!this.toastEl) {
      this.toastEl = document.createElement("div")
      this.toastEl.className = "highlight-toast"
    }

    const displayText = text.length > 20 ? `${text.slice(0, 20)}...` : text
    // 用 textContent 构建，避免选中文本中的 HTML 字符被解析
    this.toastEl.textContent = `"${displayText}" `
    const countEl = document.createElement("span")
    countEl.className = "count"
    countEl.textContent = String(count)
    this.toastEl.appendChild(countEl)
    this.toastEl.appendChild(document.createTextNode(" 处"))

    if (!this.toastEl.parentElement) {
      document.body.appendChild(this.toastEl)
    }

    requestAnimationFrame(() => this.toastEl!.classList.add("show"))

    if (this.toastHideTimer) {
      clearTimeout(this.toastHideTimer)
    }
    this.toastHideTimer = setTimeout(() => {
      if (this.toastEl) {
        this.toastEl.classList.remove("show")
        setTimeout(() => this.toastEl?.remove(), 200)
      }
    }, 1800)
  }

  private clearToast() {
    if (this.toastHideTimer) {
      clearTimeout(this.toastHideTimer)
      this.toastHideTimer = null
    }
    if (this.toastEl) {
      this.toastEl.remove()
      this.toastEl = null
    }
  }
}
