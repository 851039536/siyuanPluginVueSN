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
import type { Plugin } from "siyuan"
import { showMessage } from "siyuan"
import { copyToClipboard } from "@/utils/domUtils"
import type { PronunciationSource } from "../types/storage"
import type { ExplainResult } from "./WordExplainer"
import { WordExplainer } from "./WordExplainer"

const HIGHLIGHT_STYLE_ID = "highlight-feature-styles"
/** CSS.highlights 注册名，对应样式中的 ::highlight() 选择器 */
const HIGHLIGHT_NAME = "plugin-double-click-highlight"
/** 纯英文单词判定（允许单词内部的连字符/撇号），仅此类文本触发解释 */
const WORD_PATTERN = /^[A-Z][A-Z'-]*$/i
/** 普通高亮 toast 展示时长（毫秒） */
const TOAST_DURATION_MS = 1800
/** 含单词解释时的 toast 展示时长（毫秒）：预留阅读释义时间 */
const EXPLAIN_TOAST_DURATION_MS = 6000

export interface HighlightOptions {
  backgroundColor?: string
  minTextLength?: number
  minLetterLength?: number
  maxTextLength?: number
  maxLetterLength?: number
  /** 双击英文单词后解释（单词本优先，AI 兜底） */
  enableWordExplain?: boolean
  /** 解释单词时自动播放发音 */
  autoPlayWord?: boolean
  /** 发音来源：webSpeech（离线）/ youdao（在线真人，失败回退） */
  pronunciationSource?: PronunciationSource
}

const DEFAULT_OPTIONS: Required<HighlightOptions> = {
  backgroundColor: "rgb(255, 220, 60)",
  minTextLength: 1,
  minLetterLength: 1,
  maxTextLength: 50,
  maxLetterLength: 100,
  enableWordExplain: false,
  autoPlayWord: false,
  pronunciationSource: "webSpeech",
}

export class HighlightManager {
  private selectedText = ""
  private styleAdded = false
  private active = false
  private toastEl: HTMLDivElement | null = null
  private toastHideTimer: ReturnType<typeof setTimeout> | null = null
  private options: Required<HighlightOptions> = { ...DEFAULT_OPTIONS }
  private plugin: Plugin | null = null
  private explainer: WordExplainer | null = null
  /** toast 内的释义行元素（showToast 重置内容后会重建） */
  private explainEl: HTMLDivElement | null = null
  /** 解释请求序号：新双击/清理 toast 后递增，防止陈旧异步结果覆盖 */
  private explainSeq = 0

  constructor(options?: HighlightOptions, plugin?: Plugin) {
    if (options) this.updateOptions(options)
    if (plugin) this.plugin = plugin
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
    // 纯英文单词且开启解释时，走结构化解释浮层（只显示单词/音标/谐音/释义）；否则显示“N 处”高亮提示
    if (this.shouldExplain(selection)) {
      this.showExplainToast(selection)
    } else {
      this.showToast(selection, matchCount)
    }
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
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
        border: 1px solid var(--b3-border-color);
      }
      .highlight-toast.interactive {
        pointer-events: auto;
      }
      .highlight-toast.show {
        opacity: 1;
        transform: translateX(-50%) translateY(-4px);
      }
      .highlight-toast .count {
        color: var(--b3-theme-primary);
        font-weight: 600;
      }
      .highlight-toast .explain {
        flex-basis: 100%;
        max-width: 360px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 12px;
        line-height: 1.5;
        color: var(--b3-theme-on-surface);
        word-break: break-word;
      }
      .highlight-toast .explain-word {
        font-weight: 600;
        display: flex;
        align-items: baseline;
        gap: 8px;
        flex-wrap: wrap;
      }
      .highlight-toast .explain-phonetic {
        font-weight: 400;
        color: var(--b3-theme-primary);
      }
      .highlight-toast .explain-row {
        color: var(--b3-theme-on-surface-variant, var(--b3-theme-on-surface));
        white-space: pre-wrap;
      }
      .highlight-toast .explain-label {
        color: var(--b3-theme-on-surface);
        font-weight: 600;
        margin-right: 4px;
      }
      .highlight-toast .explain-tip {
        flex-basis: 100%;
        font-size: 12px;
        color: var(--b3-theme-on-surface-variant, var(--b3-theme-on-surface));
      }
      .highlight-toast .explain-actions {
        flex-basis: 100%;
        display: flex;
        gap: 8px;
        margin-top: 2px;
      }
      .highlight-toast .explain-btn {
        cursor: pointer;
        font-size: 12px;
        line-height: 1.4;
        padding: 2px 10px;
        border-radius: 4px;
        border: 1px solid var(--b3-border-color);
        background: var(--b3-theme-background);
        color: var(--b3-theme-on-surface);
      }
      .highlight-toast .explain-btn:hover {
        border-color: var(--b3-theme-primary);
        color: var(--b3-theme-primary);
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

    this.resetToastHideTimer(TOAST_DURATION_MS)
  }

  /** 重置 toast 自动隐藏定时器（解释结果到达后延长展示时长时复用） */
  private resetToastHideTimer(duration: number) {
    if (this.toastHideTimer) {
      clearTimeout(this.toastHideTimer)
    }
    this.toastHideTimer = setTimeout(() => {
      if (this.toastEl) {
        this.toastEl.classList.remove("show")
        setTimeout(() => this.toastEl?.remove(), 200)
      }
    }, duration)
  }

  private clearToast() {
    // 递增序号使在途的解释请求失效，并停止上一次的自动发音
    this.explainSeq++
    this.explainer?.cancelSpeech()
    this.explainEl = null
    if (this.toastHideTimer) {
      clearTimeout(this.toastHideTimer)
      this.toastHideTimer = null
    }
    if (this.toastEl) {
      this.toastEl.remove()
      this.toastEl = null
    }
  }

  // ============ 双击解释单词（单词本优先 + AI 兜底） ============

  /** 是否触发解释：开关开启 + 持有 plugin + 选中文本为纯英文单词 */
  private shouldExplain(text: string): boolean {
    return this.options.enableWordExplain && !!this.plugin && WORD_PATTERN.test(text)
  }

  /** 惰性创建单词解释器（仅开启解释且持有 plugin 时创建） */
  private getExplainer(): WordExplainer | null {
    if (!this.plugin) return null
    if (!this.explainer) {
      this.explainer = new WordExplainer(this.plugin)
    }
    return this.explainer
  }

  /** 展示解释浮层：顶部单词行 + 加载提示，异步结果到达后填充音标/谐音/释义/例句/词形；浮层可交互（复制/朗读） */
  private showExplainToast(word: string) {
    this.clearToast()

    this.toastEl = document.createElement("div")
    // interactive：允许点击复制/朗读按钮（普通高亮 toast 为 pointer-events:none）
    this.toastEl.className = "highlight-toast interactive"
    // 阻止冒泡到文档级 mousedown，避免点击浮层内按钮时清除高亮
    this.toastEl.addEventListener("mousedown", (e) => e.stopPropagation())
    // 悬停时冻结自动隐藏，移出后重新计时，便于阅读与点击操作
    this.toastEl.addEventListener("mouseenter", () => {
      if (this.toastHideTimer) {
        clearTimeout(this.toastHideTimer)
        this.toastHideTimer = null
      }
    })
    this.toastEl.addEventListener("mouseleave", () => this.resetToastHideTimer(EXPLAIN_TOAST_DURATION_MS))
    this.explainEl = document.createElement("div")
    this.explainEl.className = "explain"
    this.toastEl.appendChild(this.explainEl)
    document.body.appendChild(this.toastEl)

    requestAnimationFrame(() => this.toastEl?.classList.add("show"))
    this.resetToastHideTimer(EXPLAIN_TOAST_DURATION_MS)

    this.explainWord(word)
  }

  private explainWord(word: string) {
    const explainer = this.getExplainer()
    if (!explainer) return

    const seq = ++this.explainSeq
    const i18n = (this.plugin?.i18n ?? {}) as Record<string, string>
    // 先展示加载提示（文案："解释中..."）
    this.renderExplainTip(word, i18n.highlightExplainLoading)

    if (this.options.autoPlayWord) {
      explainer.play(word, this.options.pronunciationSource)
    }

    explainer
      .explain(word)
      .then((result) => {
        // 序号已失效（新双击/清理 toast）时丢弃陈旧结果
        if (seq !== this.explainSeq) return
        this.renderExplainResult(result)
        this.resetToastHideTimer(EXPLAIN_TOAST_DURATION_MS)
      })
      .catch((error) => {
        console.error("解释单词失败:", error)
        if (seq !== this.explainSeq) return
        // 失败提示（文案："解释失败"）
        this.renderExplainTip(word, i18n.highlightExplainFailed)
        this.resetToastHideTimer(EXPLAIN_TOAST_DURATION_MS)
      })
  }

  /** 渲染单词行 + 一条提示文字（加载中/解释失败） */
  private renderExplainTip(word: string, tip: string | undefined) {
    if (!this.explainEl) return
    this.explainEl.textContent = ""
    this.explainEl.appendChild(this.buildWordRow(word, ""))
    if (tip) {
      const tipEl = document.createElement("div")
      tipEl.className = "explain-tip"
      tipEl.textContent = tip
      this.explainEl.appendChild(tipEl)
    }
  }

  /** 渲染结构化解释：单词 + 音标（同行）、谐音/释义/例句/词形行（均仅在有值时显示）、操作行（复制/朗读） */
  private renderExplainResult(result: ExplainResult) {
    if (!this.explainEl) return
    const i18n = (this.plugin?.i18n ?? {}) as Record<string, string>
    this.explainEl.textContent = ""
    // 单词行（含音标）
    this.explainEl.appendChild(this.buildWordRow(result.word, result.phonetic))
    // 谐音行（文案标签：“谐音”）
    if (result.homophone) {
      this.explainEl.appendChild(this.buildLabelRow(i18n.highlightHomophoneLabel, result.homophone))
    }
    // 释义行（文案标签：“释义”）
    if (result.definition) {
      this.explainEl.appendChild(this.buildLabelRow(i18n.highlightDefinitionLabel, result.definition))
    }
    // 例句行（文案标签：“例句”）
    if (result.example) {
      this.explainEl.appendChild(this.buildLabelRow(i18n.highlightExampleLabel, result.example))
    }
    // 词形变化行（文案标签：“词形变化”；值为“无”时不展示）
    if (result.forms && result.forms !== "无") {
      this.explainEl.appendChild(this.buildLabelRow(i18n.highlightFormsLabel, result.forms))
    }
    // 操作行：复制、朗读
    this.explainEl.appendChild(this.buildActionsRow(result))
  }

  /** 构造操作行：“复制”（整理成纯文本写入剪贴板）+ “朗读”（按当前发音来源重播） */
  private buildActionsRow(result: ExplainResult): HTMLDivElement {
    const i18n = (this.plugin?.i18n ?? {}) as Record<string, string>
    const row = document.createElement("div")
    row.className = "explain-actions"

    // 复制按钮（文案：“复制”）
    const copyBtn = document.createElement("button")
    copyBtn.className = "explain-btn"
    copyBtn.type = "button"
    copyBtn.textContent = i18n.highlightCopyAction ?? ""
    copyBtn.addEventListener("click", () => {
      copyToClipboard(this.buildCopyText(result)).then((ok) => {
        if (ok && i18n.highlightCopied) showMessage(i18n.highlightCopied)
      })
    })
    row.appendChild(copyBtn)

    // 朗读按钮（文案：“朗读”）
    const playBtn = document.createElement("button")
    playBtn.className = "explain-btn"
    playBtn.type = "button"
    playBtn.textContent = i18n.highlightPlayAction ?? ""
    playBtn.addEventListener("click", () => {
      this.getExplainer()?.play(result.word, this.options.pronunciationSource)
    })
    row.appendChild(playBtn)

    return row
  }

  /** 将解释结果整理为多行纯文本（供复制），仅拼接有值字段 */
  private buildCopyText(result: ExplainResult): string {
    const i18n = (this.plugin?.i18n ?? {}) as Record<string, string>
    const phonetic = result.phonetic
      ? (/^[/[]/.test(result.phonetic) ? result.phonetic : `/${result.phonetic}/`)
      : ""
    const lines = [phonetic ? `${result.word} ${phonetic}` : result.word]
    if (result.homophone) lines.push(`${i18n.highlightHomophoneLabel ?? ""}：${result.homophone}`)
    if (result.definition) lines.push(`${i18n.highlightDefinitionLabel ?? ""}：${result.definition}`)
    if (result.example) lines.push(`${i18n.highlightExampleLabel ?? ""}：${result.example}`)
    if (result.forms && result.forms !== "无") lines.push(`${i18n.highlightFormsLabel ?? ""}：${result.forms}`)
    return lines.join("\n")
  }

  /** 构造单词行：单词（加粗）+ 音标（有则附在右侧） */
  private buildWordRow(word: string, phonetic: string): HTMLDivElement {
    const row = document.createElement("div")
    row.className = "explain-word"
    const wordEl = document.createElement("span")
    wordEl.textContent = word
    row.appendChild(wordEl)
    if (phonetic) {
      const phoneticEl = document.createElement("span")
      phoneticEl.className = "explain-phonetic"
      // 音标自动补斜杠（若 AI/单词本未携带）
      phoneticEl.textContent = /^[/[]/.test(phonetic) ? phonetic : `/${phonetic}/`
      row.appendChild(phoneticEl)
    }
    return row
  }

  /** 构造带标签的内容行（谐音/释义），均用 textContent 防注入 */
  private buildLabelRow(label: string | undefined, value: string): HTMLDivElement {
    const row = document.createElement("div")
    row.className = "explain-row"
    if (label) {
      const labelEl = document.createElement("span")
      labelEl.className = "explain-label"
      labelEl.textContent = label
      row.appendChild(labelEl)
    }
    row.appendChild(document.createTextNode(value))
    return row
  }
}
