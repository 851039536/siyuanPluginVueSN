/**
 * 书签标记管理器
 * 根据文档的书签内容，在文件树中对文档名称进行颜色标记
 */
import { sql } from "@/api"
import { injectStyle, removeStyle } from "@/utils/domUtils"
import { TimerRegistry, type TimerHandle } from "@/utils/timerRegistry"
import type { AttrRow, BookmarkMarkerOptions, BookmarkRule } from "../types"
import {
  BOOKMARK_MARKER_CLASS,
  BOOKMARK_MARKER_STYLE_ID,
  BOOKMARK_PROTYLE_CLASS,
} from "../types"
import {
  applyRowStyle,
  buildRowStyle,
  buildRuleSignature,
  clearAllRowMarkers,
  clearRowStyle,
  createMarkerElement,
  matchesBookmarkName,
  resolveMode,
} from "../utils"

/** 书签查询行数上限（防御性上限，避免异常数据导致内存膨胀） */
const BOOKMARK_QUERY_LIMIT = 999999

/**
 * 文件树内文档行选择器。
 * 思源 3.8.x 起文档树为虚拟滚动扁平结构，文档行带 data-tree-key 与 data-node-id；
 * 旧版按笔记本分 ul[data-url] 的结构保留为回退分支。
 */
const FILE_TREE_DOC_ROW_SELECTOR = [
  '.sy__file li[data-type="navigation-file"][data-node-id]',
  '[data-type="sidebar-file"] li[data-type="navigation-file"][data-node-id]',
  'ul[data-url] li[data-node-id]:not([data-type="navigation-root"])',
].join(", ")

/** 文件树行挂载判定（新结构行带 data-tree-key，旧结构行带 data-node-id） */
const FILE_TREE_ROW_SELECTOR = "li[data-tree-key], li[data-node-id]"

export class BookmarkMarker {
  private readonly timers = new TimerRegistry()
  private updateTimer: TimerHandle | null = null
  private options: BookmarkMarkerOptions
  private active = false
  private styleAdded = false
  private fileTreeObserver: MutationObserver | null = null
  private protyleObserver: MutationObserver | null = null
  private protyleDebounceTimer: TimerHandle | null = null
  private protyleRetryCount = 0
  private protyleRetryTimer: TimerHandle | null = null
  private applyFrame = 0
  private bookmarkCache = new Map<string, string>()
  private cacheLoaded = false

  constructor(options: BookmarkMarkerOptions) {
    this.options = { ...options }
  }

  updateOptions(options: Partial<BookmarkMarkerOptions>) {
    Object.assign(this.options, options)
    // applyMarkers 内部已兜底异常，void 即可（不会产生 unhandled rejection）
    if (this.active) void this.applyMarkers()
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
    this.timers.clearAll()
    this.clearAllMarkers()
    this.removeStyles()
    this.bookmarkCache.clear()
    this.cacheLoaded = false
  }

  setUpdateInterval(interval: number): void {
    // 等值短路：间隔未变化时无需重启定时器
    if (this.options.updateInterval === interval) return
    this.options.updateInterval = interval
    if (this.updateTimer) {
      this.stopAutoUpdate()
      this.startAutoUpdate()
    }
  }

  // ============================================================
  // 书签数据查询
  // ============================================================

  private async loadBookmarkCache(): Promise<void> {
    let result: AttrRow[] = []
    try {
      result = (await sql(
        `SELECT block_id as id, value as bookmark FROM attributes WHERE name = 'bookmark' AND block_id = root_id LIMIT ${BOOKMARK_QUERY_LIMIT}`,
      )) as AttrRow[]
    } catch (error) {
      // 查询失败不抛出：保持 cacheLoaded = false，applyMarkersFor 的既有守卫会跳过本轮标记应用
      console.error("查询书签数据失败:", error)
      return
    }
    // stop() 后在途查询返回时不回填缓存，避免停用后数据驻留
    if (!this.active) return
    this.bookmarkCache.clear()
    if (result?.length) {
      for (const row of result) {
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

  /**
   * 拉取书签缓存并应用标记。
   * 内部兜底所有异常（记录日志后吞掉），因此**永不 reject** —— 定时刷新、
   * 选项变更等 fire-and-forget 调用点无需再逐处 catch。
   */
  private async applyMarkers(): Promise<void> {
    if (!this.active) return
    try {
      await this.loadBookmarkCache()
      if (!this.active) return
      // 缓存为空时也需执行：循环内的 remove 分支负责清理已无书签的旧标记
      this.applyMarkersToDOM()
      this.applyMarkersToProtyle()
    } catch (error) {
      console.error("应用书签标记失败:", error)
    }
  }

  private applyMarkersToDOM(): void {
    this.applyMarkersFor(
      FILE_TREE_DOC_ROW_SELECTOR,
      (el, name, rule) => this.applyMarkerToItem(el, name, rule),
      (el) => this.removeMarkerFromItem(el),
    )
  }

  /** 通用遍历：对匹配元素按缓存书签应用或移除标记 */
  private applyMarkersFor(
    selector: string,
    apply: (el: HTMLElement, bookmarkName: string, rule: BookmarkRule) => void,
    remove: (el: HTMLElement) => void,
  ): void {
    if (!this.active || !this.cacheLoaded) return
    for (const el of document.querySelectorAll(selector)) {
      const target = el as HTMLElement
      const nodeId = target.dataset.nodeId
      if (!nodeId) continue

      const bookmarkName = this.bookmarkCache.get(nodeId)
      if (!bookmarkName) {
        remove(target)
        continue
      }

      const rule = this.findRuleForBookmark(bookmarkName)
      if (rule) apply(target, bookmarkName, rule)
      else remove(target)
    }
  }

  private applyMarkerToItem(item: HTMLElement, bookmarkName: string, rule: BookmarkRule): void {
    const textEl = item.querySelector(".b3-list-item__text") as HTMLElement | null
    if (!textEl) return
    this.applyMarkerToTarget(textEl, textEl, BOOKMARK_MARKER_CLASS, bookmarkName, rule)
  }

  private removeMarkerFromItem(item: HTMLElement): void {
    const textEl = item.querySelector(".b3-list-item__text") as HTMLElement | null
    if (!textEl) return
    this.removeMarkerFromTarget(textEl, textEl, BOOKMARK_MARKER_CLASS)
  }

  // ============================================================
  // DOM 标记应用 — protyle 标题区
  // ============================================================

  private applyMarkersToProtyle(): void {
    this.applyMarkersFor(
      ".protyle-title[data-node-id]",
      (el, name, rule) => this.applyMarkerToProtyle(el, name, rule),
      (el) => this.removeMarkerFromProtyle(el),
    )
  }

  private applyMarkerToProtyle(title: HTMLElement, bookmarkName: string, rule: BookmarkRule): void {
    const inputEl = title.querySelector(".protyle-title__input") as HTMLElement | null
    if (!inputEl) return
    this.applyMarkerToTarget(inputEl, title, BOOKMARK_PROTYLE_CLASS, bookmarkName, rule)
  }

  private removeMarkerFromProtyle(title: HTMLElement): void {
    const inputEl = title.querySelector(".protyle-title__input") as HTMLElement | null
    if (!inputEl) return
    this.removeMarkerFromTarget(inputEl, title, BOOKMARK_PROTYLE_CLASS)
  }

  /** 通用标记应用：row 行样式 / 徽章模式的对称切换清理与幂等判断 */
  private applyMarkerToTarget(
    textEl: HTMLElement,
    markerHost: HTMLElement,
    markerClass: string,
    bookmarkName: string,
    rule: BookmarkRule,
  ): void {
    const mode = resolveMode(rule)

    if (mode === "row") {
      // 模式切换对称清理：移除旧徽章，避免与行样式叠加
      markerHost.querySelector(`.${markerClass}`)?.remove()
      applyRowStyle(textEl, buildRowStyle(rule), bookmarkName)
      return
    }

    // 模式切换对称清理：清除旧行样式，避免与徽章叠加
    if (textEl.dataset.bookmarkRow) clearRowStyle(textEl)

    const existingMarker = markerHost.querySelector(`.${markerClass}`) as HTMLElement | null
    if (
      existingMarker?.dataset.bookmark === bookmarkName
      && existingMarker.dataset.sig === buildRuleSignature(rule)
    ) {
      return
    }
    existingMarker?.remove()

    markerHost.appendChild(createMarkerElement(markerClass, bookmarkName, rule))
  }

  /** 通用标记移除 */
  private removeMarkerFromTarget(
    textEl: HTMLElement,
    markerHost: HTMLElement,
    markerClass: string,
  ): void {
    if (textEl.dataset.bookmarkRow) clearRowStyle(textEl)
    markerHost.querySelector(`.${markerClass}`)?.remove()
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

  /**
   * 监听 body 而非单个容器：虚拟滚动列表会随滚动持续挂载/卸载行，
   * 思源也可能重建文件树容器；按行选择器过滤后只对命中变更做一次 rAF 应用
   */
  private startObserving(): void {
    if (this.fileTreeObserver) return
    this.fileTreeObserver = new MutationObserver((mutations) => {
      if (!this.active) return
      const relevant = mutations.some(
        (m) =>
          m.type === "childList"
          && [...m.addedNodes, ...m.removedNodes].some((n) => this.isFileTreeRowNode(n)),
      )
      if (relevant) this.scheduleFileTreeApply()
    })
    this.fileTreeObserver.observe(document.body, {
      childList: true,
      subtree: true,
    })
  }

  /**
   * 命中文件树行变更：行挂载（虚拟滚动）或行内注入内容被重渲染冲掉
   */
  private isFileTreeRowNode(node: Node): boolean {
    if (!(node instanceof Element)) return false
    return (
      node.classList.contains(BOOKMARK_MARKER_CLASS)
      || node.matches(FILE_TREE_ROW_SELECTOR)
      || node.querySelector(FILE_TREE_ROW_SELECTOR) !== null
    )
  }

  private scheduleFileTreeApply(): void {
    if (this.applyFrame) return
    this.applyFrame = requestAnimationFrame(() => {
      this.applyFrame = 0
      if (!this.active) return
      this.applyMarkersToDOM()
    })
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
      if (hasNew) this.debounceProtyle(() => this.applyMarkersToProtyle())
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
    if (this.applyFrame) {
      cancelAnimationFrame(this.applyFrame)
      this.applyFrame = 0
    }
  }

  private stopObservingProtyle(): void {
    this.protyleObserver?.disconnect()
    this.protyleObserver = null
    this.clearProtyleDebounce()
  }

  // ============================================================
  // 防抖 & 轮询
  // ============================================================

  private debounceProtyle(fn: () => void): void {
    this.timers.clear(this.protyleDebounceTimer)
    this.protyleDebounceTimer = this.timers.setTimeout(() => {
      if (!this.active) return
      fn()
    }, 300)
  }

  private clearProtyleDebounce(): void {
    this.timers.clear(this.protyleDebounceTimer)
    this.protyleDebounceTimer = null
  }

  private startProtyleRetry(): void {
    if (this.protyleRetryTimer) return
    this.protyleRetryCount = 0
    this.protyleRetryTimer = this.timers.setInterval(() => {
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
    this.timers.clear(this.protyleRetryTimer)
    this.protyleRetryTimer = null
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
    // 防御：确保无残留定时器，避免异常路径下重复 interval
    this.stopAutoUpdate()
    this.updateTimer = this.timers.setInterval(
      () => void this.applyMarkers(),
      this.options.updateInterval,
    )
  }

  private stopAutoUpdate(): void {
    this.timers.clear(this.updateTimer)
    this.updateTimer = null
  }
}
