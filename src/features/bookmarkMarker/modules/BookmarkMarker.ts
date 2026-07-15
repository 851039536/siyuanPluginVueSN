/**
 * 书签标记管理器
 * 根据文档的书签内容，在文件树中对文档名称进行颜色标记
 */
import { sql } from "@/api"
import { injectStyle, removeStyle } from "@/utils/domUtils"
import type { AttrRow, BookmarkMarkerOptions, BookmarkRule } from "../types"
import {
  BOOKMARK_MARKER_CLASS,
  BOOKMARK_MARKER_STYLE_ID,
  BOOKMARK_PROTYLE_CLASS,
} from "../types"
import {
  applyRowStyle,
  buildRowStyle,
  clearAllRowMarkers,
  clearRowStyle,
  createMarkerElement,
  matchesBookmarkName,
  resolveMode,
} from "../utils"

export class BookmarkMarker {
  private updateTimer: number | null = null
  private options: BookmarkMarkerOptions
  private active = false
  private styleAdded = false
  private fileTreeObserver: MutationObserver | null = null
  private protyleObserver: MutationObserver | null = null
  private debounceTimer: number | null = null
  private protyleDebounceTimer: number | null = null
  private bookmarkCache = new Map<string, string>()
  private cacheLoaded = false

  constructor(options: BookmarkMarkerOptions) {
    this.options = { ...options }
  }

  updateOptions(options: Partial<BookmarkMarkerOptions>) {
    Object.assign(this.options, options)
    this.cacheLoaded = false
    if (this.active) this.applyMarkers()
  }

  async start(): Promise<void> {
    if (this.active) return
    this.active = true
    this.addStyles()
    await this.applyMarkers()
    this.startAutoUpdate()
    this.startObserving()
    this.startObservingProtyle()
    this.startProtyleRetry()
  }

  stop(): void {
    if (!this.active) return
    this.active = false
    this.stopObserving()
    this.stopObservingProtyle()
    this.stopProtyleRetry()
    this.stopAutoUpdate()
    this.clearAllMarkers()
    this.removeStyles()
    this.bookmarkCache.clear()
    this.cacheLoaded = false
  }

  get isActive(): boolean {
    return this.active
  }

  setUpdateInterval(interval: number): void {
    this.options.updateInterval = interval
    if (this.updateTimer) {
      this.stopAutoUpdate()
      this.startAutoUpdate()
    }
  }

  getRules(): BookmarkRule[] {
    return this.options.rules
  }

  // ============================================================
  // 书签数据查询
  // ============================================================

  private async loadBookmarkCache(): Promise<void> {
    const result = await sql(
      `SELECT block_id as id, value as bookmark FROM attributes WHERE name = 'bookmark' AND block_id = root_id LIMIT 999999`,
    )
    this.bookmarkCache.clear()
    if (result?.length) {
      for (const row of result as AttrRow[]) {
        this.bookmarkCache.set(row.id, row.bookmark)
      }
    }
    this.cacheLoaded = true
  }

  // ============================================================
  // 规则匹配
  // ============================================================

  private findRuleForBookmark(bookmark: string): BookmarkRule | undefined {
    return this.options.rules.find((r) => matchesBookmarkName(bookmark, r))
  }

  // ============================================================
  // DOM 标记应用 — 文件树
  // ============================================================

  private async applyMarkers(): Promise<void> {
    if (!this.active) return
    await this.loadBookmarkCache()
    if (this.bookmarkCache.size) {
      this.applyMarkersToDOM()
      this.applyMarkersToProtyle()
    }
  }

  private applyMarkersToDOM(): void {
    if (!this.active || !this.cacheLoaded) return

    for (const container of document.querySelectorAll("ul[data-url]")) {
      const docItems = container.querySelectorAll(
        'li[data-node-id]:not([data-type="navigation-root"])',
      )
      for (const item of docItems) {
        const el = item as HTMLElement
        const nodeId = el.dataset.nodeId
        if (!nodeId) continue

        const bookmarkName = this.bookmarkCache.get(nodeId)
        if (!bookmarkName) {
          this.removeMarkerFromItem(el)
          continue
        }

        const rule = this.findRuleForBookmark(bookmarkName)
        if (rule) {
          this.applyMarkerToItem(el, bookmarkName, rule)
        } else {
          this.removeMarkerFromItem(el)
        }
      }
    }
  }

  private applyMarkerToItem(item: HTMLElement, bookmarkName: string, rule: BookmarkRule): void {
    const mode = resolveMode(rule)
    const textEl = item.querySelector(".b3-list-item__text") as HTMLElement | null
    if (!textEl) return

    if (mode === "row") {
      applyRowStyle(textEl, buildRowStyle(rule), bookmarkName)
      return
    }

    const existingMarker = textEl.querySelector(`.${BOOKMARK_MARKER_CLASS}`) as HTMLElement | null
    if (existingMarker?.dataset.bookmark === bookmarkName) return
    existingMarker?.remove()

    textEl.appendChild(createMarkerElement(BOOKMARK_MARKER_CLASS, bookmarkName, rule))
  }

  private removeMarkerFromItem(item: HTMLElement): void {
    const textEl = item.querySelector(".b3-list-item__text") as HTMLElement | null
    if (!textEl) return

    if (textEl.dataset.bookmarkRow) clearRowStyle(textEl)

    textEl.querySelector(`.${BOOKMARK_MARKER_CLASS}`)?.remove()
  }

  // ============================================================
  // DOM 标记应用 — protyle 标题区
  // ============================================================

  private applyMarkersToProtyle(): void {
    if (!this.active || !this.cacheLoaded) return

    for (const title of document.querySelectorAll(".protyle-title[data-node-id]")) {
      const el = title as HTMLElement
      const nodeId = el.dataset.nodeId
      if (!nodeId) continue

      const bookmarkName = this.bookmarkCache.get(nodeId)
      if (!bookmarkName) {
        this.removeMarkerFromProtyle(el)
        continue
      }

      const rule = this.findRuleForBookmark(bookmarkName)
      if (rule) {
        this.applyMarkerToProtyle(el, bookmarkName, rule)
      } else {
        this.removeMarkerFromProtyle(el)
      }
    }
  }

  private applyMarkerToProtyle(title: HTMLElement, bookmarkName: string, rule: BookmarkRule): void {
    const mode = resolveMode(rule)

    if (mode === "row") {
      const inputEl = title.querySelector(".protyle-title__input") as HTMLElement | null
      if (!inputEl) return
      applyRowStyle(inputEl, buildRowStyle(rule), bookmarkName)
      return
    }

    const existingMarker = title.querySelector(`.${BOOKMARK_PROTYLE_CLASS}`) as HTMLElement | null
    if (existingMarker?.dataset.bookmark === bookmarkName) return
    existingMarker?.remove()

    title.appendChild(createMarkerElement(BOOKMARK_PROTYLE_CLASS, bookmarkName, rule))
  }

  private removeMarkerFromProtyle(title: HTMLElement): void {
    const inputEl = title.querySelector(".protyle-title__input") as HTMLElement | null
    if (inputEl?.dataset.bookmarkRow) clearRowStyle(inputEl)

    title.querySelector(`.${BOOKMARK_PROTYLE_CLASS}`)?.remove()
  }

  // ============================================================
  // 清理
  // ============================================================

  private clearAllMarkers(): void {
    document.querySelectorAll(`.${BOOKMARK_MARKER_CLASS}`).forEach((m) => m.remove())
    document.querySelectorAll(`.${BOOKMARK_PROTYLE_CLASS}`).forEach((m) => m.remove())
    clearAllRowMarkers(".b3-list-item__text[data-bookmark-row]")
    clearAllRowMarkers(".protyle-title__input[data-bookmark-row]")
  }

  // ============================================================
  // MutationObserver — 文件树
  // ============================================================

  private startObserving(): void {
    if (this.fileTreeObserver) return

    const target = this.findFileTreeContainer()
    if (!target) {
      setTimeout(() => {
        if (!this.active) return
        const el = this.findFileTreeContainer()
        if (el) {
          this.attachObserver(el)
          this.applyMarkersToDOM()
        }
      }, 3000)
      return
    }
    this.attachObserver(target)
  }

  private attachObserver(target: Element): void {
    this.fileTreeObserver = new MutationObserver((mutations) => {
      const relevant = mutations.some((m) => {
        if (m.type !== "childList" || !m.addedNodes.length) return false
        return Array.from(m.addedNodes).some(
          (n) => n instanceof HTMLElement && (n.matches("li[data-node-id]") || n.querySelector("li[data-node-id]") || n.matches("ul[data-url]")),
        )
      })
      if (relevant) this.debounce(() => this.applyMarkersToDOM(), this, "debounceTimer")
    })

    this.fileTreeObserver.observe(target, {
      childList: true,
      subtree: true,
    })
  }

  private findFileTreeContainer(): Element | null {
    return document.querySelector(".file-tree")
      ?? document.querySelector("ul[data-url]")?.parentElement?.parentElement
      ?? document.querySelector("#fileTree")
      ?? document.querySelector(".layout__file")
      ?? null
  }

  // ============================================================
  // MutationObserver — protyle
  // ============================================================

  private startObservingProtyle(): void {
    if (this.protyleObserver) return

    this.protyleObserver = new MutationObserver((mutations) => {
      const hasNew = mutations.some((m) => {
        if (m.type === "childList") {
          return Array.from(m.addedNodes).some(
            (n) => n instanceof HTMLElement && (n.matches(".protyle-title") || n.querySelector(".protyle-title")),
          )
        }
        return m.type === "attributes"
          && m.attributeName === "data-node-id"
          && (m.target as HTMLElement).matches(".protyle-title")
      })
      if (hasNew) this.debounce(() => this.applyMarkersToProtyle(), this, "protyleDebounceTimer")
    })

    this.protyleObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-node-id"],
    })
  }

  // ============================================================
  // 观察器生命周期
  // ============================================================

  private stopObserving(): void {
    this.fileTreeObserver?.disconnect()
    this.fileTreeObserver = null
    this.clearDebounce("debounceTimer")
  }

  private stopObservingProtyle(): void {
    this.protyleObserver?.disconnect()
    this.protyleObserver = null
    this.clearDebounce("protyleDebounceTimer")
  }

  // ============================================================
  // 防抖 & 轮询
  // ============================================================

  private debounce(fn: () => void, scope: this, timerKey: "debounceTimer" | "protyleDebounceTimer"): void {
    if (scope[timerKey]) clearTimeout(scope[timerKey] as number)
    scope[timerKey] = window.setTimeout(() => {
      if (!scope.active) return
      fn()
    }, 300)
  }

  private clearDebounce(timerKey: "debounceTimer" | "protyleDebounceTimer"): void {
    if (this[timerKey]) {
      clearTimeout(this[timerKey] as number)
      this[timerKey] = null
    }
  }

  private protyleRetryCount = 0
  private protyleRetryTimer: number | null = null

  private startProtyleRetry(): void {
    if (this.protyleRetryTimer) return
    this.protyleRetryCount = 0
    this.protyleRetryTimer = window.setInterval(() => {
      if (!this.active) {
        this.stopProtyleRetry()
        return
      }
      this.protyleRetryCount++
      this.applyMarkersToProtyle()
      if (this.protyleRetryCount >= 15) this.stopProtyleRetry()
    }, 800)
  }

  private stopProtyleRetry(): void {
    if (this.protyleRetryTimer) {
      clearInterval(this.protyleRetryTimer)
      this.protyleRetryTimer = null
    }
    this.protyleRetryCount = 0
  }

  // ============================================================
  // 样式注入
  // ============================================================

  private addStyles(): void {
    if (this.styleAdded) return
    injectStyle(BOOKMARK_MARKER_STYLE_ID, `
      .${BOOKMARK_MARKER_CLASS} {
        display: inline-block;
        font-size: 10px;
        line-height: 1;
        padding: 2px 5px;
        margin-left: 6px;
        border-radius: 3px;
        font-weight: 500;
        vertical-align: middle;
        white-space: nowrap;
        letter-spacing: 0.5px;
      }
      .${BOOKMARK_PROTYLE_CLASS} {
        display: inline-block;
        font-size: 11px;
        line-height: 1;
        padding: 3px 8px;
        margin-left: 8px;
        border-radius: 4px;
        font-weight: 500;
        vertical-align: middle;
        white-space: nowrap;
        letter-spacing: 0.5px;
        position: relative;
        top: -1px;
        cursor: default;
      }
    `)
    this.styleAdded = true
  }

  private removeStyles(): void {
    removeStyle(BOOKMARK_MARKER_STYLE_ID)
    this.styleAdded = false
  }

  // ============================================================
  // 定时更新
  // ============================================================

  private startAutoUpdate(): void {
    this.updateTimer = window.setInterval(() => this.applyMarkers(), this.options.updateInterval)
  }

  private stopAutoUpdate(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer)
      this.updateTimer = null
    }
  }
}
