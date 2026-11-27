/**
 * 笔记本文档数统计管理器
 * 在文件树笔记本名称后追加文档数。思源 3.8.x 起文档树改为虚拟滚动扁平结构
 * （行带 data-tree-key="notebook:<id>"，不再有 ul[data-url]），DOM 中只保留可见行，
 * 因此以「全量计数缓存 + 行挂载监听」替代原先的一次性遍历。
 */
import { sql } from "@/api"
import { TimerRegistry, type TimerHandle } from "@/utils/timerRegistry"
import { DOC_COUNT_FORMATTERS, type DocCountFormat } from "../types/storage"

/** 笔记本行选择器（新旧文档树结构通用） */
const NOTEBOOK_ROW_SELECTOR = 'li[data-type="navigation-root"]'
/** 注入的计数标记类名（同时用于清空与样式更新） */
const COUNT_CLASS = "doc-count-number"
/** 新版虚拟滚动文档树的行标识前缀 */
const TREE_KEY_PREFIX = "notebook:"

export class DocCountManager {
  private readonly timers = new TimerRegistry()
  private updateTimer: TimerHandle | null = null
  private updateInterval = 3600000 // 默认1小时
  private displayFormat: DocCountFormat = "bracket"
  private fontStyle: {
    fontSize: string
    color: string
    fontWeight: string
    opacity: number
  } = {
    fontSize: "12px",
    color: "#8c8c8c",
    fontWeight: "normal",
    opacity: 0.8,
  }
  /** 笔记本 ID → 文档数缓存（一次全量查询填充，虚拟滚动复用行时直接取用） */
  private countCache = new Map<string, number>()
  /** 行挂载/重建监听（虚拟滚动只挂载可见行，且重渲染会冲掉注入的计数） */
  private treeObserver: MutationObserver | null = null
  private applyFrame = 0
  private refreshing = false
  private refreshPending = false
  private active = false

  /**
   * 启动文档数统计功能
   */
  public start(): void {
    this.active = true
    this.observeTreeRows()
    void this.refreshCounts()
    this.startAutoUpdate()
  }

  /**
   * 停止文档数统计功能
   */
  public stop(): void {
    this.active = false
    this.treeObserver?.disconnect()
    this.treeObserver = null
    if (this.applyFrame) {
      cancelAnimationFrame(this.applyFrame)
      this.applyFrame = 0
    }
    this.stopAutoUpdate()
    this.timers.clearAll()
    this.countCache.clear()
    this.clearAllCounts()
  }

  /**
   * 设置更新间隔
   */
  public setUpdateInterval(interval: number): void {
    this.updateInterval = interval
    if (this.updateTimer) {
      this.stopAutoUpdate()
      this.startAutoUpdate()
    }
  }

  /**
   * 设置显示格式
   */
  public setDisplayFormat(format: DocCountFormat): void {
    this.displayFormat = format
    this.applyCounts()
  }

  /**
   * 设置字体样式
   */
  public setFontStyle(style: {
    fontSize: string
    color: string
    fontWeight: string
    opacity: number
  }): void {
    this.fontStyle = style
    this.updateCountStyles()
  }

  /**
   * 监听文档树行的挂载与重建：虚拟滚动滚动时新行进入视口、
   * 重渲染会冲掉注入的计数，都需要按缓存即时补齐
   */
  private observeTreeRows(): void {
    if (this.treeObserver) return
    this.treeObserver = new MutationObserver((mutations) => {
      if (this.hasNotebookRowMutation(mutations)) this.scheduleApply()
    })
    this.treeObserver.observe(document.body, { childList: true, subtree: true })
  }

  private hasNotebookRowMutation(mutations: MutationRecord[]): boolean {
    for (const mutation of mutations) {
      for (const node of [...mutation.addedNodes, ...mutation.removedNodes]) {
        if (!(node instanceof Element)) continue
        if (
          node.classList.contains(COUNT_CLASS) ||
          node.matches(NOTEBOOK_ROW_SELECTOR) ||
          node.querySelector(NOTEBOOK_ROW_SELECTOR) ||
          node.closest(NOTEBOOK_ROW_SELECTOR)
        ) {
          return true
        }
      }
    }
    return false
  }

  private scheduleApply(): void {
    if (this.applyFrame) return
    this.applyFrame = requestAnimationFrame(() => {
      this.applyFrame = 0
      this.applyCounts()
    })
  }

  /**
   * 全量刷新文档数缓存：一次 GROUP BY 覆盖所有笔记本，
   * 未出现在结果中的笔记本按 0 篇处理（空笔记本不写 blocks）
   */
  private async refreshCounts(): Promise<void> {
    if (!this.active) return
    if (this.refreshing) {
      this.refreshPending = true
      return
    }
    this.refreshing = true
    try {
      const rows = await this.query<{ box: string; count: number }>(
        "SELECT box, count(*) as count FROM blocks WHERE type = 'd' GROUP BY box",
      )
      if (!this.active) return
      const next = new Map<string, number>()
      for (const row of rows) {
        if (row.box) next.set(row.box, Number(row.count) || 0)
      }
      this.countCache = next
      this.applyCounts()
    } finally {
      this.refreshing = false
      if (this.refreshPending) {
        this.refreshPending = false
        void this.refreshCounts()
      }
    }
  }

  /**
   * 将缓存中的文档数应用到当前已挂载的笔记本行
   */
  private applyCounts(): void {
    if (!this.active) return
    const rows = document.querySelectorAll<HTMLElement>(NOTEBOOK_ROW_SELECTOR)
    rows.forEach((row) => {
      const notebookId = this.resolveNotebookId(row)
      if (!notebookId) return
      this.applyCountToRow(row, this.countCache.get(notebookId) ?? 0)
    })
  }

  /**
   * 解析笔记本 ID：新结构取行上的 data-tree-key，旧结构回退到父级 ul[data-url]
   */
  private resolveNotebookId(row: HTMLElement): string | null {
    const treeKey = row.dataset.treeKey
    if (treeKey?.startsWith(TREE_KEY_PREFIX)) {
      return treeKey.slice(TREE_KEY_PREFIX.length) || null
    }
    return row.closest<HTMLElement>("ul[data-url]")?.dataset.url || null
  }

  /**
   * 为单个笔记本行应用计数：0 时不显示（与旧行为一致），标题原文保持不变
   */
  private applyCountToRow(row: HTMLElement, count: number): void {
    const textEl = row.querySelector<HTMLElement>("span.b3-list-item__text")
    if (!textEl) return

    const existing = textEl.querySelector<HTMLElement>(`.${COUNT_CLASS}`)
    if (!count) {
      existing?.remove()
      return
    }

    const countSpan = existing ?? document.createElement("span")
    if (!existing) {
      countSpan.className = COUNT_CLASS
      textEl.appendChild(countSpan)
    }
    const text = DOC_COUNT_FORMATTERS[this.displayFormat](count)
    if (countSpan.textContent !== text) countSpan.textContent = text
    this.applyStyleToSpan(countSpan)
  }

  /**
   * 将当前字体样式应用至 span 元素
   */
  private applyStyleToSpan(span: HTMLElement): void {
    span.style.fontSize = this.fontStyle.fontSize
    span.style.color = this.fontStyle.color
    span.style.fontWeight = this.fontStyle.fontWeight
    span.style.opacity = String(this.fontStyle.opacity)
  }

  /**
   * 启动自动更新定时器
   */
  private startAutoUpdate(): void {
    this.updateTimer = this.timers.setInterval(() => {
      void this.refreshCounts()
    }, this.updateInterval)
  }

  /**
   * 停止自动更新定时器
   */
  private stopAutoUpdate(): void {
    this.timers.clear(this.updateTimer)
    this.updateTimer = null
  }

  /**
   * 更新所有文档数的样式
   */
  private updateCountStyles(): void {
    const countSpans = document.querySelectorAll<HTMLElement>(`.${COUNT_CLASS}`)
    countSpans.forEach((span) => this.applyStyleToSpan(span))
  }

  /**
   * 清除所有文档数显示
   */
  private clearAllCounts(): void {
    const countSpans = document.querySelectorAll(`.${COUNT_CLASS}`)
    countSpans.forEach((span) => {
      span.remove()
    })
  }

  /**
   * 查询SQL函数
   */
  private async query<T = any>(stmt: string): Promise<T[]> {
    try {
      const result = await sql(stmt)
      if (Array.isArray(result)) {
        return result as T[]
      }
      console.warn("[DocCountManager] SQL 查询返回异常结果:", result)
      return []
    } catch (error) {
      console.error("[DocCountManager] SQL 查询失败:", error)
      return []
    }
  }
}
