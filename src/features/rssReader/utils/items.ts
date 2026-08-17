/**
 * RSS 文章条目工具 — 解析结果规范化（过滤空链接、去重）
 */
import type { RssItem } from "../types"
import { createRssItemFromParsed } from "./parser"

/**
 * 将解析出的条目转换为完整 RssItem：
 * - 过滤无 link 的条目（列表 key 与刷新去重都依赖 link）
 * - 按 link 去重
 */
export function normalizeParsedItems(
  parsedItems: Partial<RssItem>[],
  feedId: string,
  feedTitle: string,
  untitledLabel: string,
): RssItem[] {
  const seen = new Set<string>()
  const result: RssItem[] = []
  for (const pi of parsedItems) {
    const link = pi.link?.trim()
    if (!link || seen.has(link)) continue
    seen.add(link)
    result.push(createRssItemFromParsed(pi, feedId, feedTitle, untitledLabel))
  }
  return result
}
