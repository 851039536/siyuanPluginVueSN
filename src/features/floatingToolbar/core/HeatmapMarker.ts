import { Plugin } from "siyuan"
import { FlashcardStorage } from "@/utils/sharedStorage/flashcardStorage"

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
  private flashcardStorage: FlashcardStorage
  private active = false
  private isScanning = false
  private styleAdded = false
  private wordHeatMap = new Map<string, number>()
  private bodyObserver: MutationObserver | null = null
  private contentObservers = new Map<Element, MutationObserver>()
  private scanTimer: ReturnType<typeof setTimeout> | null = null
  private readonly SCAN_DEBOUNCE_MS = 2000
  private lastScanTime = 0
  private readonly MIN_SCAN_INTERVAL_MS = 3000
  private cacheTimestamp = 0
  private readonly CACHE_TTL_MS = 30000

  constructor(plugin: Plugin) {
    this.flashcardStorage = new FlashcardStorage(plugin)
  }

  async enable() {
    if (this.active) return
    this.active = true

    await this.refreshWordCache()
    this.addStyles()
    this.startBodyObserver()

    if (this.wordHeatMap.size === 0) {
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

    this.contentObservers.forEach((obs) => obs.disconnect())
    this.contentObservers.clear()

    this.clearAllMarks()
    this.removeStyles()
  }

  isActive(): boolean {
    return this.active
  }

  async refreshWordCache() {
    try {
      const cards = await this.flashcardStorage.getAllCards()
      this.wordHeatMap.clear()
      for (const card of cards) {
        const word = card.title.toLowerCase().trim()
        if (word && /^[a-z]+$/i.test(word)) {
          const existing = this.wordHeatMap.get(word)
          if (existing === undefined || card.practiceCount > existing) {
            this.wordHeatMap.set(word, card.practiceCount)
          }
        }
      }
      this.cacheTimestamp = Date.now()
    } catch (error) {
      console.error("[HeatmapMarker] 刷新单词缓存失败:", error)
    }
  }

  private async ensureCacheFresh() {
    if (Date.now() - this.cacheTimestamp > this.CACHE_TTL_MS) {
      await this.refreshWordCache()
    }
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

  private observeDocumentContent(protyle: Element) {
    if (this.contentObservers.has(protyle)) return

    const wysiwyg = protyle.querySelector(".protyle-wysiwyg")
    if (!wysiwyg) return

    const observer = new MutationObserver((mutations) => {
      if (this.isScanning) return

      for (const m of mutations) {
        if (m.type === "childList") {
          for (const node of m.addedNodes) {
            if (node instanceof HTMLElement && node.classList.contains(HEATMAP_WORD_CLASS)) {
              return
            }
          }
          for (const node of m.removedNodes) {
            if (node instanceof HTMLElement && node.classList.contains(HEATMAP_WORD_CLASS)) {
              return
            }
          }
        }
      }

      this.debounceScan()
    })

    observer.observe(wysiwyg, {
      childList: true,
      subtree: true,
    })

    this.contentObservers.set(protyle, observer)
  }

  private debounceScan() {
    if (this.isScanning) return
    if (this.scanTimer) clearTimeout(this.scanTimer)
    this.scanTimer = setTimeout(() => {
      this.scanTimer = null
      if (!this.active || this.isScanning) return
      if (Date.now() - this.lastScanTime < this.MIN_SCAN_INTERVAL_MS) return
      if (this.wordHeatMap.size === 0) {
        this.refreshWordCache().then(() => {
          if (this.wordHeatMap.size > 0) {
            this.scanVisibleDocuments()
          }
        })
        return
      }
      this.scanVisibleDocuments()
    }, this.SCAN_DEBOUNCE_MS)
  }

  async scanVisibleDocuments() {
    if (!this.active || this.isScanning) return

    if (this.wordHeatMap.size === 0) {
      await this.refreshWordCache()
      if (this.wordHeatMap.size === 0) return
    }

    await this.ensureCacheFresh()

    this.isScanning = true

    try {
      const documents = document.querySelectorAll<HTMLElement>(
        ".protyle:not(.fn__none)",
      )

      const visibleDocs: HTMLElement[] = []
      for (const doc of documents) {
        if (doc.offsetParent !== null) {
          visibleDocs.push(doc)
        }
      }

      if (visibleDocs.length === 0) return

      // console.log(`[HeatmapMarker] 扫描 ${visibleDocs.length} 个可见文档`)

      let totalMarks = 0
      for (const doc of visibleDocs) {
        const count = this.scanDocument(doc)
        totalMarks += count
        this.observeDocumentContent(doc)
      }

      if (totalMarks > 0) {
        // console.log(`[HeatmapMarker] 标记了 ${totalMarks} 个单词`)
      }
    } finally {
      this.isScanning = false
      this.lastScanTime = Date.now()
    }
  }

  private scanDocument(protyle: Element): number {
    const wysiwyg = protyle.querySelector(".protyle-wysiwyg")
    if (!wysiwyg) return 0

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

    let markCount = 0
    for (let i = textNodes.length - 1; i >= 0; i--) {
      markCount += this.markWordsInTextNode(textNodes[i])
    }

    wysiwyg.setAttribute(HEATMAP_SCANNED_ATTR, String(Date.now()))
    return markCount
  }

  private markWordsInTextNode(textNode: Text): number {
    const text = textNode.textContent
    if (!text) return 0

    const matches: { start: number, end: number, heat: number, word: string }[] = []
    let match: RegExpExecArray | null

    ENGLISH_WORD_RE.lastIndex = 0
    while ((match = ENGLISH_WORD_RE.exec(text)) !== null) {
      const word = match[0].toLowerCase()
      const practiceCount = this.wordHeatMap.get(word)
      if (practiceCount !== undefined) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          heat: getHeatLevel(practiceCount),
          word: match[0],
        })
      }
    }

    if (matches.length === 0) return 0

    const parent = textNode.parentNode
    if (!parent) return 0

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
    return matches.length
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
