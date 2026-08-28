import { WordPracticeCache } from "./wordCache"

const HEATMAP_STYLE_ID = "heatmap-marker-styles"
const HEATMAP_WORD_CLASS = "heatmap-word"
const HEATMAP_SCANNED_ATTR = "data-heatmap-scanned"
const INITIAL_SCAN_DELAY_MS = 1500

const ENGLISH_WORD_RE = /\b[a-z]{2,}\b/gi

function getHeatLevel(practiceCount: number): number {
  if (practiceCount <= 3) return 1
  if (practiceCount <= 10) return 2
  if (practiceCount <= 30) return 3
  return 4
}

export class HeatmapMarker {
  private wordCache: WordPracticeCache
  private active = false
  private isScanning = false
  private styleAdded = false
  private bodyObserver: MutationObserver | null = null
  private scanTimer: ReturnType<typeof setTimeout> | null = null
  private readonly SCAN_DEBOUNCE_MS = 2000

  constructor(wordCache: WordPracticeCache) {
    this.wordCache = wordCache
  }

  async enable() {
    if (this.active) return
    this.active = true

    await this.wordCache.refresh()
    this.addStyles()
    this.startBodyObserver()

    if (this.wordCache.size === 0) {
      console.warn("[HeatmapMarker] 单词本为空，热力图标记已启用，添加单词后自动生效")
      return
    }
    setTimeout(() => {
      if (this.active) {
        this.scanVisibleDocuments()
      }
    }, INITIAL_SCAN_DELAY_MS)
  }

  disable() {
    if (!this.active) return
    this.active = false

    if (this.scanTimer) {
      clearTimeout(this.scanTimer)
      this.scanTimer = null
    }

    if (this.bodyObserver) {
      this.bodyObserver.disconnect()
      this.bodyObserver = null
    }

    this.clearAllMarks()
    this.removeStyles()
  }

  isActive(): boolean {
    return this.active
  }

  private addStyles() {
    if (this.styleAdded) return
    if (document.getElementById(HEATMAP_STYLE_ID)) {
      this.styleAdded = true
      return
    }

    const style = document.createElement("style")
    style.id = HEATMAP_STYLE_ID
    style.textContent = `
      .${HEATMAP_WORD_CLASS}[data-heat="1"],
      .${HEATMAP_WORD_CLASS}[data-heat="2"],
      .${HEATMAP_WORD_CLASS}[data-heat="3"],
      .${HEATMAP_WORD_CLASS}[data-heat="4"] {
        color: rgba(255, 213, 79, 0.85);
      }

      .code-block .${HEATMAP_WORD_CLASS},
      [data-type="NodeCodeBlock"] .${HEATMAP_WORD_CLASS},
      .hljs .${HEATMAP_WORD_CLASS},
      pre .${HEATMAP_WORD_CLASS},
      code .${HEATMAP_WORD_CLASS} {
        color: inherit !important;
      }
    `
    document.head.appendChild(style)
    this.styleAdded = true
  }

  private removeStyles() {
    const el = document.getElementById(HEATMAP_STYLE_ID)
    if (el) el.remove()
    this.styleAdded = false
  }

  private startBodyObserver() {
    if (this.bodyObserver) return

    this.bodyObserver = new MutationObserver((mutations) => {
      let shouldScan = false
      for (const m of mutations) {
        if (m.type === "childList") {
          for (const node of m.addedNodes) {
            if (node instanceof HTMLElement) {
              if (
                node.matches(".protyle")
                || node.querySelector(".protyle")
              ) {
                shouldScan = true
                break
              }
            }
          }
        }
        if (shouldScan) break
      }
      if (shouldScan) {
        this.debounceScan()
      }
    })

    this.bodyObserver.observe(document.body, {
      childList: true,
      subtree: true,
    })
  }

  private debounceScan() {
    if (this.scanTimer) clearTimeout(this.scanTimer)
    this.scanTimer = setTimeout(() => {
      this.scanTimer = null
      // 缓存为空/过期的刷新逻辑由 scanVisibleDocuments 内部处理
      this.scanVisibleDocuments()
    }, this.SCAN_DEBOUNCE_MS)
  }

  async scanVisibleDocuments() {
    if (!this.active || this.isScanning) return

    if (this.wordCache.size === 0) {
      await this.wordCache.refresh()
      if (this.wordCache.size === 0) return
    }

    await this.wordCache.ensureFresh()

    this.isScanning = true

    try {
      const documents = document.querySelectorAll<HTMLElement>(
        ".protyle:not(.fn__none)",
      )

      const visibleDocs: HTMLElement[] = []
      for (const doc of documents) {
        if (doc.offsetParent === null) continue
        // 已扫描过的文档跳过（每个文档只标记一次，编辑时不再重扫）
        if (
          doc
            .querySelector(".protyle-wysiwyg")
            ?.hasAttribute(HEATMAP_SCANNED_ATTR)
        ) {
          continue
        }
        // 正在编辑（光标所在块）的文档跳过，避免改写 DOM 打断输入
        if (doc.querySelector(".protyle-wysiwyg--focus")) continue
        visibleDocs.push(doc)
      }

      if (visibleDocs.length === 0) return

      for (const doc of visibleDocs) {
        this.scanDocument(doc)
      }
    } finally {
      this.isScanning = false
    }
  }

  private scanDocument(protyle: Element) {
    const wysiwyg = protyle.querySelector(".protyle-wysiwyg")
    if (!wysiwyg) return

    this.clearDocumentMarks(wysiwyg as HTMLElement)

    const textWalker = document.createTreeWalker(wysiwyg, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement
        if (!parent) return NodeFilter.FILTER_REJECT
        if (
          parent.closest("code")
          || parent.closest("pre")
          || parent.closest("kbd")
          || parent.closest("var")
          || parent.closest(".hljs")
          || parent.closest(".code-block")
          || parent.closest("[data-type='NodeCodeBlock']")
          || parent.closest(`.${HEATMAP_WORD_CLASS}`)
          || parent.closest("[data-type='NodeHeading']")
        ) {
          return NodeFilter.FILTER_REJECT
        }
        const text = node.textContent || ""
        if (!/[a-z]{2,}/i.test(text)) {
          return NodeFilter.FILTER_REJECT
        }
        return NodeFilter.FILTER_ACCEPT
      },
    })

    // 收集文本节点后反向遍历（避免 DOM 修改影响 TreeWalker 游标）
    const textNodes: Text[] = []
    let node: Node | null
    while ((node = textWalker.nextNode())) {
      textNodes.push(node as Text)
    }

    for (let i = textNodes.length - 1; i >= 0; i--) {
      this.markWordsInTextNode(textNodes[i])
    }

    wysiwyg.setAttribute(HEATMAP_SCANNED_ATTR, "true")
  }

  private markWordsInTextNode(textNode: Text) {
    const text = textNode.textContent
    if (!text) return

    const matches: { start: number, end: number, heat: number, word: string }[] = []
    let match: RegExpExecArray | null

    ENGLISH_WORD_RE.lastIndex = 0
    while ((match = ENGLISH_WORD_RE.exec(text)) !== null) {
      const word = match[0].toLowerCase()
      const practiceCount = this.wordCache.getPracticeCount(word)
      if (practiceCount !== undefined) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          heat: getHeatLevel(practiceCount),
          word: match[0],
        })
      }
    }

    if (matches.length === 0) return

    const parent = textNode.parentNode
    if (!parent) return

    const fragment = document.createDocumentFragment()
    let lastEnd = 0

    for (const m of matches) {
      if (m.start > lastEnd) {
        fragment.appendChild(
          document.createTextNode(text.slice(lastEnd, m.start)),
        )
      }
      const span = document.createElement("span")
      span.className = HEATMAP_WORD_CLASS
      span.dataset.heat = String(m.heat)
      span.textContent = m.word
      fragment.appendChild(span)
      lastEnd = m.end
    }

    if (lastEnd < text.length) {
      fragment.appendChild(
        document.createTextNode(text.slice(lastEnd)),
      )
    }

    parent.replaceChild(fragment, textNode)
  }

  /**
   * 批量移除 heatmap-word 标记节点，还原为原始文本
   * @param root 搜索根节点（Document 或 HTMLElement）
   */
  private unwrapMarkNodes(root: Document | HTMLElement) {
    const marks = root.querySelectorAll(`.${HEATMAP_WORD_CLASS}`)
    for (const mark of marks) {
      const parent = mark.parentNode
      if (!parent) continue
      const frag = document.createDocumentFragment()
      while (mark.firstChild) {
        frag.appendChild(mark.firstChild)
      }
      parent.replaceChild(frag, mark)
    }
  }

  private clearDocumentMarks(root: HTMLElement) {
    this.unwrapMarkNodes(root)
    root.normalize()
  }

  private clearAllMarks() {
    this.unwrapMarkNodes(document)
    // 全局清理后对每个文档做 normalize，确保文本节点合并
    const docs = document.querySelectorAll<HTMLElement>(".protyle-wysiwyg")
    for (const doc of docs) {
      doc.normalize()
    }
  }

  destroy() {
    this.disable()
  }
}
