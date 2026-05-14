/**
 * 书签标记管理器
 * 根据文档的书签内容，在文件树中对文档名称进行颜色标记
 *
 * 重要：思源笔记中，书签 NOT stored in blocks.bookmark（该列不存在），
 * 而是存储在 attributes 表中：name='bookmark', value='书签名'
 *
 * 正确的 SQL 查询：
 *   SELECT block_id as id, value as bookmark
 *   FROM attributes WHERE name = 'bookmark' AND block_id = root_id
 *
 * 思源文件树 DOM 结构（参考 DocCountManager）：
 *   ul[data-url="notebookId"]               ← 笔记本容器
 *     li[data-type="navigation-root"]         ← 笔记本标题（DocCountManager 标记这里）
 *       span.b3-list-item__text              ← 笔记本名
 *     ul                                     ← 文档列表
 *       li[data-node-id][data-path]           ← 文档项（本功能标记这里）
 *         span.b3-list-item__text             ← 文档名
 *       li[data-node-id][data-path]           ← 子文档项
 *         ...
 *
 * 文件树是懒加载的，子文档只在展开时才渲染到 DOM，
 * 因此需要 MutationObserver 监听 DOM 变化，动态应用标记。
 */
const BOOKMARK_MARKER_CLASS = "bookmark-marker-tag"
/** 文章展开页面（protyle）书签标记的 CSS 类名 */
const BOOKMARK_PROTYLE_CLASS = "bookmark-marker-protyle"
const BOOKMARK_MARKER_STYLE_ID = "bookmark-marker-styles"

export interface BookmarkMarkerOptions {
  /** 书签名 → 颜色 的映射规则 */
  rules: BookmarkRule[]
  /** 更新间隔（毫秒） */
  updateInterval: number
}

export interface BookmarkRule {
  /** 书签名称（精确匹配） */
  bookmarkName: string
  /** 标记颜色 */
  color: string
  /** 标记背景色 */
  backgroundColor: string
  /** 可选图标（emoji） */
  icon?: string
  /** 显示模式：bg=文字标签, icon=仅图标, icon-bg=图标+背景，默认为文字标签模式 */
  displayMode?: "bg" | "icon" | "icon-bg"
}

interface AttrRow {
  /** 文档块 ID（= block_id） */
  id: string
  /** 书签名称（= value） */
  bookmark: string
}

export class BookmarkMarker {
  private updateTimer: number | null = null
  private options: BookmarkMarkerOptions
  private active = false
  private styleAdded = false
  /** 文件树 DOM 变动观察器 */
  private fileTreeObserver: MutationObserver | null = null
  /** 文章展开页面（protyle）DOM 变动观察器 */
  private protyleObserver: MutationObserver | null = null
  /** 防抖定时器 */
  private debounceTimer: number | null = null
  /** protyle 防抖定时器 */
  private protyleDebounceTimer: number | null = null
  /** 缓存：文档 ID → 书签名称 */
  private bookmarkCache = new Map<string, string>()
  /** 缓存是否已加载 */
  private cacheLoaded = false

  constructor(options: Partial<BookmarkMarkerOptions> = {}) {
    this.options = {
      rules: [
        { bookmarkName: "已发布", color: "#ffffff", backgroundColor: "#52c41a" },
        { bookmarkName: "待发布", color: "#ffffff", backgroundColor: "#faad14" },
      ],
      updateInterval: 3600000,
      ...options,
    }
  }

  updateOptions(options: Partial<BookmarkMarkerOptions>) {
    Object.assign(this.options, options)
    this.cacheLoaded = false
    if (this.active) {
      this.applyMarkers()
    }
  }

  start(): void {
    if (this.active) return
    this.active = true
    this.addStyles()
    this.applyMarkers()
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

  setUpdateInterval(interval: number): void {
    this.options.updateInterval = interval
    if (this.updateTimer) {
      this.stopAutoUpdate()
      this.startAutoUpdate()
    }
  }

  // ============================================================
  // 书签数据查询 — 使用 attributes 表（而非 blocks.bookmark）
  // ============================================================

  /**
   * 查询所有有书签的文档，并缓存结果
   *
   * 思源笔记中，书签存储在 attributes 表：
   *   name = 'bookmark', value = '书签名称'
   *   block_id = root_id 表示该属性属于文档级块（文档的 block_id 即为 root_id）
   */
  private async loadBookmarkCache(): Promise<void> {
    const sql = `SELECT block_id as id, value as bookmark FROM attributes WHERE name = 'bookmark' AND block_id = root_id`
    const result = await this.query(sql)
    this.bookmarkCache.clear()

    if (result && result.length) {
      for (const row of result as AttrRow[]) {
        this.bookmarkCache.set(row.id, row.bookmark)
      }
    }
    this.cacheLoaded = true
  }

  // ============================================================
  // DOM 标记应用
  // ============================================================

  /**
   * 在所有位置应用书签标记（完整流程：查库 + 标记 DOM）
   */
  private async applyMarkers(): Promise<void> {
    if (!this.active) return

    await this.loadBookmarkCache()

    if (this.bookmarkCache.size) {
      this.applyMarkersToDOM()
      this.applyMarkersToProtyle()
    }
  }

  /**
   * 仅对当前 DOM 中的文档项应用标记（不重新查询数据库）
   * 用于 MutationObserver 触发的增量更新
   */
  private applyMarkersToDOM(): void {
    if (!this.active || !this.cacheLoaded) return

    const notebookContainers = document.querySelectorAll("ul[data-url]")

    for (const container of notebookContainers) {
      const docItems = container.querySelectorAll('li[data-node-id]:not([data-type="navigation-root"])')

      for (const item of docItems) {
        const htmlItem = item as HTMLElement
        const nodeId = htmlItem.dataset.nodeId
        if (!nodeId) continue

        const bookmarkName = this.bookmarkCache.get(nodeId)
        if (!bookmarkName) {
          this.removeMarkerFromItem(htmlItem)
          continue
        }

        const rule = this.options.rules.find(
          (r) => r.bookmarkName === bookmarkName,
        )

        if (rule) {
          this.applyMarkerToItem(htmlItem, bookmarkName, rule)
        } else {
          this.removeMarkerFromItem(htmlItem)
        }
      }
    }
  }

  /**
   * 给文件树文档项添加书签标记
   * 标记添加到 span.b3-list-item__text 内（与 DocCountManager 相同位置）
   * 根据 displayMode 支持三种显示模式：
   *   bg      — 文字标签（默认）：背景色 + 文字名称
   *   icon    — 仅图标：透明背景 + 仅显示 emoji 图标
   *   icon-bg — 图标+背景：背景色 + 仅显示 emoji 图标
   */
  private applyMarkerToItem(
    item: HTMLElement,
    bookmarkName: string,
    rule: BookmarkRule,
  ): void {
    const textEl = item.querySelector(".b3-list-item__text")
    if (!textEl) return

    // 检查是否已存在相同书签的标记
    const existingMarker = textEl.querySelector(`.${BOOKMARK_MARKER_CLASS}`)
    if (existingMarker && (existingMarker as HTMLElement).dataset.bookmark === bookmarkName) {
      return
    }

    // 移除旧标记
    if (existingMarker) existingMarker.remove()

    // 创建标记元素
    const marker = document.createElement("span")
    marker.className = BOOKMARK_MARKER_CLASS
    marker.dataset.bookmark = bookmarkName

    const mode = rule.displayMode || "bg"

    if (mode === "icon" && rule.icon) {
      // 仅图标模式：无背景色，只显示图标
      marker.style.backgroundColor = "transparent"
      marker.textContent = rule.icon
    } else if (mode === "icon-bg" && rule.icon) {
      // 图标+背景模式
      marker.style.backgroundColor = rule.backgroundColor
      marker.textContent = rule.icon
    } else {
      // 文字标签模式（默认）：显示书签名称，带背景
      marker.style.backgroundColor = rule.backgroundColor
      marker.textContent = rule.icon ? `${rule.icon} ${bookmarkName}` : bookmarkName
    }

    marker.style.color = rule.color
    textEl.appendChild(marker)
  }

  /**
   * 移除文件树项的书签标记
   */
  private removeMarkerFromItem(item: HTMLElement): void {
    const textEl = item.querySelector(".b3-list-item__text")
    if (!textEl) return

    const oldMarker = textEl.querySelector(`.${BOOKMARK_MARKER_CLASS}`)
    if (oldMarker) oldMarker.remove()
  }

  /**
   * 清除所有书签标记（包括文件树和 protyle 标题区）
   */
  private clearAllMarkers(): void {
    const markers = document.querySelectorAll(`.${BOOKMARK_MARKER_CLASS}`)
    markers.forEach((m) => m.remove())
    const protyleMarkers = document.querySelectorAll(`.${BOOKMARK_PROTYLE_CLASS}`)
    protyleMarkers.forEach((m) => m.remove())
  }

  // ============================================================
  // MutationObserver — 监听文件树 DOM 变化
  // ============================================================

  /**
   * 启动文件树 DOM 监听
   * 文件树是懒加载的，子文档在展开时才渲染到 DOM，
   * 需要监听 DOM 变化以及时为新出现的文档项添加标记
   */
  private startObserving(): void {
    if (this.fileTreeObserver) return

    const fileTreeEl = this.findFileTreeContainer()
    if (!fileTreeEl) {
      setTimeout(() => {
        if (!this.active) return
        const el = this.findFileTreeContainer()
        if (el) this.attachObserver(el)
      }, 3000)
      return
    }
    this.attachObserver(fileTreeEl)
  }

  private attachObserver(target: Element): void {
    this.fileTreeObserver = new MutationObserver((mutations) => {
      let hasRelevantChange = false
      for (const mutation of mutations) {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node instanceof HTMLElement) {
              // 检查新添加的节点是否包含文档项
              if (
                node.matches("li[data-node-id]")
                || node.querySelector("li[data-node-id]")
                || node.matches("ul[data-url]")
              ) {
                hasRelevantChange = true
                break
              }
            }
          }
        }
        if (hasRelevantChange) break
      }

      if (hasRelevantChange) {
        this.debouncedApplyMarkersToDOM()
      }
    })

    this.fileTreeObserver.observe(target, {
      childList: true,
      subtree: true,
    })
  }

  private stopObserving(): void {
    if (this.fileTreeObserver) {
      this.fileTreeObserver.disconnect()
      this.fileTreeObserver = null
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
  }

  /**
   * 查找文件树容器元素
   * 参考思路：DocCountManager 用 ul[data-url] 找笔记本容器，
   * 文件树外层容器应该在更上层
   */
  private findFileTreeContainer(): Element | null {
    // 方式1: 通过 .file-tree 类（思源桌面端文件树面板）
    const fileTree = document.querySelector(".file-tree")
    if (fileTree) return fileTree

    // 方式2: 通过 ul[data-url] 的父级向上查找
    const notebookUl = document.querySelector("ul[data-url]")
    if (notebookUl) {
      // 向上找到包含所有笔记本的容器
      return notebookUl.parentElement?.parentElement || notebookUl.parentElement || notebookUl
    }

    // 方式3: 其他常见选择器
    return document.querySelector("#fileTree")
      || document.querySelector(".layout__file")
      || null
  }

  /**
   * 防抖应用标记（避免 MutationObserver 频繁触发导致性能问题）
   */
  private debouncedApplyMarkersToDOM(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }
    this.debounceTimer = window.setTimeout(() => {
      if (!this.active) return
      this.applyMarkersToDOM()
    }, 300)
  }

  // ============================================================
  // 文章展开页面（protyle）标记
  // ============================================================

  /**
   * 在文章展开页面标题区应用书签标记
   *
   * 思源笔记中，文章展开时会在编辑器视图创建 protyle 区域：
   *   div.protyle-title[data-node-id]          ← 文档标题容器（本功能标记这里）
   *     div.protyle-title__input                 ← 文档标题（可编辑）
   *       Document Title
   *     span.bookmark-marker-protyle             ← 书签标记（由本功能插入）
   *
   * 参考：HeadingSettings 通过 .protyle-title__input 选择器来设置文档标题样式
   */
  private applyMarkersToProtyle(): void {
    if (!this.active || !this.cacheLoaded) return

    const protyleTitles = document.querySelectorAll(".protyle-title[data-node-id]")

    for (const title of protyleTitles) {
      const htmlTitle = title as HTMLElement
      const nodeId = htmlTitle.dataset.nodeId
      if (!nodeId) continue

      const bookmarkName = this.bookmarkCache.get(nodeId)
      if (!bookmarkName) {
        this.removeMarkerFromProtyle(htmlTitle)
        continue
      }

      const rule = this.options.rules.find(
        (r) => r.bookmarkName === bookmarkName,
      )

      if (rule) {
        this.applyMarkerToProtyle(htmlTitle, bookmarkName, rule)
      } else {
        this.removeMarkerFromProtyle(htmlTitle)
      }
    }
  }

  /**
   * 给文章展开页面的文档标题容器添加书签标记
   * 标记插入到 .protyle-title 末尾（在标题输入框后面），
   * 根据 displayMode 支持三种显示模式：
   *   bg      — 文字标签（默认）：背景色 + 文字名称
   *   icon    — 仅图标：透明背景 + 仅显示 emoji 图标
   *   icon-bg — 图标+背景：背景色 + 仅显示 emoji 图标
   */
  private applyMarkerToProtyle(
    title: HTMLElement,
    bookmarkName: string,
    rule: BookmarkRule,
  ): void {
    // 检查是否已存在相同书签的标记
    const existingMarker = title.querySelector(`.${BOOKMARK_PROTYLE_CLASS}`)
    if (existingMarker && (existingMarker as HTMLElement).dataset.bookmark === bookmarkName) {
      return
    }

    // 移除旧标记
    if (existingMarker) existingMarker.remove()

    // 创建标记元素
    const marker = document.createElement("span")
    marker.className = BOOKMARK_PROTYLE_CLASS
    marker.dataset.bookmark = bookmarkName

    const mode = rule.displayMode || "bg"

    if (mode === "icon" && rule.icon) {
      // 仅图标模式：无背景色，只显示图标
      marker.style.backgroundColor = "transparent"
      marker.textContent = rule.icon
    } else if (mode === "icon-bg" && rule.icon) {
      // 图标+背景模式
      marker.style.backgroundColor = rule.backgroundColor
      marker.textContent = rule.icon
    } else {
      // 文字标签模式（默认）：显示书签名称，带背景
      marker.style.backgroundColor = rule.backgroundColor
      marker.textContent = rule.icon ? `${rule.icon} ${bookmarkName}` : bookmarkName
    }

    marker.style.color = rule.color
    title.appendChild(marker)
  }

  /**
   * 移除文章展开页面标题区的书签标记
   */
  private removeMarkerFromProtyle(title: HTMLElement): void {
    const oldMarker = title.querySelector(`.${BOOKMARK_PROTYLE_CLASS}`)
    if (oldMarker) oldMarker.remove()
  }

  // ============================================================
  // MutationObserver — 监听文章展开页面 DOM 变化
  // ============================================================

  /**
   * 启动文章展开页面 DOM 监听
   * 当用户点击文档时，思源会动态创建或复用 protyle 编辑器实例，
   * 需要监听 DOM 变化以及时为新出现的文档标题添加书签标记
   *
   * 注意两个关键场景：
   * 1. 新增元素：protyle-title 刚添加到 DOM 时可能还没有 data-node-id，
   *    因此匹配条件不能要求 [data-node-id]
   * 2. 复用编辑器：思源会复用现有 protyle 元素，只修改 data-node-id 属性，
   *    因此需要监听 attributes 类型的变更
   */
  private startObservingProtyle(): void {
    if (this.protyleObserver) return

    this.protyleObserver = new MutationObserver((mutations) => {
      let hasNewProtyle = false

      for (const mutation of mutations) {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node instanceof HTMLElement) {
              // 不要求 [data-node-id]，因为该属性可能在添加后才异步设置
              if (
                node.matches(".protyle-title")
                || node.querySelector(".protyle-title")
              ) {
                hasNewProtyle = true
                break
              }
            }
          }
        }

        // 捕获 protyle 复用场景：data-node-id 属性变更
        if (
          !hasNewProtyle
          && mutation.type === "attributes"
          && mutation.attributeName === "data-node-id"
        ) {
          const target = mutation.target as HTMLElement
          if (target.matches(".protyle-title")) {
            hasNewProtyle = true
          }
        }

        if (hasNewProtyle) break
      }

      if (hasNewProtyle) {
        this.debouncedApplyMarkersToProtyle()
      }
    })

    // 监听整个 body 下的节点变化
    this.protyleObserver.observe(document.body, {
      childList: true,
      subtree: true,
      // 监听 data-node-id 属性变化，以覆盖思源复用 protyle 编辑器的场景
      attributes: true,
      attributeFilter: ["data-node-id"],
    })
  }

  /**
   * 在启动初期短时轮询 protyle 标记
   * 某些场景下 data-node-id 可能在 DOM 插入后延迟较久才设置，
   * MutationObserver 可能在第一次匹配后就不再触发，
   * 用短时轮询兜底确保标记不遗漏。
   */
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

      // 轮询 15 次后停止（约 12 秒）
      if (this.protyleRetryCount >= 15) {
        this.stopProtyleRetry()
      }
    }, 800)
  }

  private stopProtyleRetry(): void {
    if (this.protyleRetryTimer) {
      clearInterval(this.protyleRetryTimer)
      this.protyleRetryTimer = null
    }
    this.protyleRetryCount = 0
  }

  private stopObservingProtyle(): void {
    if (this.protyleObserver) {
      this.protyleObserver.disconnect()
      this.protyleObserver = null
    }
    if (this.protyleDebounceTimer) {
      clearTimeout(this.protyleDebounceTimer)
      this.protyleDebounceTimer = null
    }
  }

  /**
   * 防抖应用 protyle 标记
   */
  private debouncedApplyMarkersToProtyle(): void {
    if (this.protyleDebounceTimer) {
      clearTimeout(this.protyleDebounceTimer)
    }
    this.protyleDebounceTimer = window.setTimeout(() => {
      if (!this.active) return
      this.applyMarkersToProtyle()
    }, 300)
  }

  // ============================================================
  // 样式管理
  // ============================================================

  private addStyles(): void {
    if (this.styleAdded) return
    if (document.getElementById(BOOKMARK_MARKER_STYLE_ID)) {
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
    const existing = document.getElementById(BOOKMARK_MARKER_STYLE_ID)
    if (existing) existing.remove()
    this.styleAdded = false
  }

  // ============================================================
  // 定时更新
  // ============================================================

  private startAutoUpdate(): void {
    this.updateTimer = window.setInterval(() => {
      this.applyMarkers()
    }, this.options.updateInterval)
  }

  private stopAutoUpdate(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer)
      this.updateTimer = null
    }
  }

  // ============================================================
  // SQL 查询 — 使用 /api/query/sql
  // ============================================================

  private async query(sql: string): Promise<any[]> {
    const result = await this.fetchSyncPost("/api/query/sql", { stmt: sql })
    if (result.code !== 0) {
      console.error("[BookmarkMarker] 查询数据库出错:", result.msg)
      return []
    }
    return result.data
  }

  private async fetchSyncPost(
    url: string,
    data: any,
    returnType: "json" | "text" = "json",
  ): Promise<any> {
    const init: RequestInit = {
      method: "POST",
    }
    if (data) {
      if (data instanceof FormData) {
        init.body = data
      } else {
        init.body = JSON.stringify(data)
      }
    }
    try {
      const res = await fetch(url, init)
      const res2 = returnType === "json" ? await res.json() : await res.text()
      return res2
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
