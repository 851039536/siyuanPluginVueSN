import { sql } from "@/api"
import type { DocCountFormat } from "../types/storage"
import {
  DOC_COUNT_FORMATTERS,
} from "../types/storage"

/**
 * 笔记本文档数统计管理器
 * 用于在笔记本列表中显示文档数量
 */
export class DocCountManager {
  private updateTimer: number | null = null
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

  /**
   * 启动文档数统计功能
   */
  public start(): void {
    this.setBoxCount()
    this.startAutoUpdate()
  }

  /**
   * 停止文档数统计功能
   */
  public stop(): void {
    this.stopAutoUpdate()
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
    // 重新渲染所有笔记本的文档数
    if (this.updateTimer) {
      this.setBoxCount()
    }
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
   * 给笔记本添加文档数（批量查询优化）
   */
  private async setBoxCount(): Promise<void> {
    const boxes = document.querySelectorAll("ul[data-url]")
    if (boxes.length === 0) return

    // 收集所有 box URL，构建批量查询
    const urls: string[] = []
    const boxMap = new Map<string, Element>()
    boxes.forEach((box) => {
      const url = (box as HTMLElement).dataset.url
      if (url) {
        urls.push(url)
        boxMap.set(url, box)
      }
    })
    if (urls.length === 0) return

    // 一次批量查询所有笔记本的文档数
    const inClause = urls.map((u) => `'${u}'`).join(",")
    const response = await this.query(
      `SELECT box, count(*) as count FROM blocks WHERE box IN (${inClause}) AND type = 'd' GROUP BY box`,
    )

    // 构建 box → count 索引
    const countMap = new Map<string, number>()
    for (const row of response) {
      if (row.box && row.count) countMap.set(row.box, row.count)
    }

    // 遍历 DOM，应用计数
    for (const [url, box] of boxMap) {
      const count = countMap.get(url)
      if (!count) continue

      const li = box.querySelector('li[data-type="navigation-root"]')
      if (!li) continue

      const boxText = li.querySelector("span.b3-list-item__text")
      if (!boxText) continue

      // 移除旧的文档数显示
      const oldCountSpan = boxText.querySelector(".doc-count-number")
      if (oldCountSpan) oldCountSpan.remove()

      // 移除文本中的文档数（兼容所有格式）
      const text = boxText.textContent?.replace(/\s*[([·]?\d+[)\]]?$/, "") || ""
      boxText.textContent = text

      // 创建带样式的文档数显示
      const countSpan = document.createElement("span")
      countSpan.className = "doc-count-number"
      countSpan.textContent = DOC_COUNT_FORMATTERS[this.displayFormat](count)
      this.applyStyleToSpan(countSpan)
      boxText.appendChild(countSpan)
    }
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
    this.updateTimer = window.setInterval(() => {
      this.setBoxCount()
    }, this.updateInterval)
  }

  /**
   * 停止自动更新定时器
   */
  private stopAutoUpdate(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer)
      this.updateTimer = null
    }
  }

  /**
   * 更新所有文档数的样式
   */
  private updateCountStyles(): void {
    const countSpans = document.querySelectorAll<HTMLElement>(".doc-count-number")
    countSpans.forEach((span) => this.applyStyleToSpan(span))
  }

  /**
   * 清除所有文档数显示
   */
  private clearAllCounts(): void {
    const countSpans = document.querySelectorAll(".doc-count-number")
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
