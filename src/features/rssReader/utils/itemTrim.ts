/**
 * RSS文章数量裁剪工具 — 每个订阅源仅保留 maxItems 篇（优先保留收藏）
 */
import type {
  Ref,
} from "vue"
import type {
  RssItem,
} from "../types"
import { getPubDateTimestamp } from "./parser"

/**
 * 限制每个订阅源的文章数量（原地替换 items.value）
 */
export function trimItemsPerFeed(items: Ref<RssItem[]>, maxItems: number): void {
  const feedItemMap = new Map<string, RssItem[]>()

  if (!Array.isArray(items.value)) return
  for (const item of items.value) {
    if (!feedItemMap.has(item.feedId)) {
      feedItemMap.set(item.feedId, [])
    }
    feedItemMap.get(item.feedId)!.push(item)
  }

  const trimmedItems: RssItem[] = []
  for (const [, feedItems] of feedItemMap) {
    // 保留收藏的，从非收藏中截断
    const starred = feedItems.filter((i) => i.starred)
    const unstarred = feedItems.filter((i) => !i.starred)

    // 按日期排序（最新在前）
    unstarred.sort((a, b) => getPubDateTimestamp(b.pubDate) - getPubDateTimestamp(a.pubDate))

    const kept = unstarred.slice(0, Math.max(0, maxItems - starred.length))
    trimmedItems.push(...starred, ...kept)
  }

  items.value = trimmedItems
}
