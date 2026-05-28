/**
 * 书签标记管理器
 * 根据文档的书签内容，在文件树中对文档名称进行颜色标记
 */
const BOOKMARK_MARKER_CLASS = "bookmark-marker-tag"
const BOOKMARK_PROTYLE_CLASS = "bookmark-marker-protyle"
const BOOKMARK_MARKER_STYLE_ID = "bookmark-marker-styles"

function hexToRgba(hex: string, alpha: number): string {
  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export interface BookmarkMarkerOptions {
  rules: BookmarkRule[]
  updateInterval: number
}

export interface BookmarkRule {
  bookmarkNames: string[]
  color: string
  backgroundColor: string
  icon?: string
  displayMode?: "bg" | "icon" | "icon-bg" | "row"
  /** 背景透明度 0~1，默认 0.25 */
  alpha?: number
  /** 匹配模式：exact=精确, prefix=前缀, contains=包含，默认 exact */
  matchMode?: "exact" | "prefix" | "contains"
}

interface AttrRow {
  id: string
  bookmark: string
}

/** row 模式应用的样式集合 */
interface RowStyleProps {
  backgroundColor: string
  color: string
  borderRadius: string
  padding: string
}

function resolveMode(rule: BookmarkRule): string {
  return rule.displayMode || "bg"
}

function resolveAlpha(rule: BookmarkRule): number {
  return rule.alpha ?? 0.25
}

/**
 * 检查书签名是否匹配规则
 */
function matchesBookmarkName(bookmarkName: string, rule: BookmarkRule): boolean {
  const mode = rule.matchMode || "exact"
  return rule.bookmarkNames.some((name) => {
    if (mode === "exact") return name === bookmarkName
    if (mode === "prefix") return bookmarkName.startsWith(name)
    return bookmarkName.includes(name)
  })
}

function buildRowStyle(rule: BookmarkRule): RowStyleProps {
  return {
    backgroundColor: hexToRgba(rule.backgroundColor, resolveAlpha(rule)),
    color: rule.color,
    borderRadius: "3px",
    padding: "0 4px",
  }
}

function applyRowStyle(el: HTMLElement, style: RowStyleProps, bookmarkName: string): void {
  el.style.backgroundColor = style.backgroundColor
  el.style.color = style.color
  el.style.borderRadius = style.borderRadius
  el.style.padding = style.padding
  el.dataset.bookmarkRow = bookmarkName
}

function clearRowStyle(el: HTMLElement): void {
  el.style.backgroundColor = ""
  el.style.color = ""
  el.style.borderRadius = ""
  el.style.padding = ""
  delete el.dataset.bookmarkRow
}

function clearAllRowMarkers(selector: string): void {
  document.querySelectorAll(selector).forEach((el) => clearRowStyle(el as HTMLElement))
}

function createMarkerElement(
  className: string,
  bookmarkName: string,
  rule: BookmarkRule,
): HTMLSpanElement {
  const mode = resolveMode(rule)
  const marker = document.createElement("span")
  marker.className = className
  marker.dataset.bookmark = bookmarkName
  marker.style.color = rule.color

  if (mode === "icon" && rule.icon) {
    marker.style.backgroundColor = "transparent"
    marker.textContent = rule.icon
  } else if (mode === "icon-bg" && rule.icon) {
    marker.style.backgroundColor = rule.backgroundColor
    marker.textContent = rule.icon
  } else {
    marker.style.backgroundColor = hexToRgba(rule.backgroundColor, resolveAlpha(rule))
    marker.textContent = rule.icon ? `${rule.icon} ${bookmarkName}` : bookmarkName
  }

  return marker
}

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

  constructor(options: Partial<BookmarkMarkerOptions> = {}) {
    this.options = {
      rules: [
        {
          bookmarkNames: ["已发布"],
          color: "#ffffff",
          backgroundColor: "#52c41a",
          alpha: 0.25,
          matchMode: "exact",
        },
        {
          bookmarkNames: ["待发布"],
          color: "#ffffff",
          backgroundColor: "#faad14",
          alpha: 0.25,
          matchMode: "exact",
        },
      ],
      updateInterval: 3600000,
      ...options,
    }
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

  getUpdateInterval(): number {
    return this.options.updateInterval
  }

  // ============================================================
  // 书签数据查询
  // ============================================================

  private async loadBookmarkCache(): Promise<void> {
    const result = await this.query(
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

    const findRule = (bookmark: string) =>
      this.options.rules.find((r) => matchesBookmarkName(bookmark, r))

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

        const rule = findRule(bookmarkName)
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

    const findRule = (bookmark: string) =>
      this.options.rules.find((r) => matchesBookmarkName(bookmark, r))

    for (const title of document.querySelectorAll(".protyle-title[data-node-id]")) {
      const el = title as HTMLElement
      const nodeId = el.dataset.nodeId
      if (!nodeId) continue

      const bookmarkName = this.bookmarkCache.get(nodeId)
      if (!bookmarkName) {
        this.removeMarkerFromProtyle(el)
        continue
      }

      const rule = findRule(bookmarkName)
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
    if (this.styleAdded || document.getElementById(BOOKMARK_MARKER_STYLE_ID)) {
      this.styleAdded = true
      return
    }

    const style = document.createElement("style")
    style.id = BOOKMARK_MARKER_STYLE_ID
    style.textContent = `
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
    `
    document.head.appendChild(style)
    this.styleAdded = true
  }

  private removeStyles(): void {
    document.getElementById(BOOKMARK_MARKER_STYLE_ID)?.remove()
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

  // ============================================================
  // SQL 查询
  // ============================================================

  private async query(sql: string): Promise<any[]> {
    const result = await this.fetchPost("/api/query/sql", { stmt: sql })
    if (result.code !== 0) {
      console.error("[BookmarkMarker] 查询数据库出错:", result.msg)
      return []
    }
    return result.data
  }

  private async fetchPost(url: string, data: unknown, returnType: "json" | "text" = "json"): Promise<any> {
    const init: RequestInit = { method: "POST" }
    if (data) init.body = data instanceof FormData ? data : JSON.stringify(data)

    try {
      const res = await fetch(url, init)
      return returnType === "json" ? await res.json() : await res.text()
    } catch (e: any) {
      console.error("[BookmarkMarker] 请求失败:", e)
      return returnType === "json"
        ? {
            code: e.code || 1,
            msg: e.message || "",
            data: null,
          }
        : ""
    }
  }
}
