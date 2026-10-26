/**
 * rssReader 纯函数层行为断言：looksLikeXml / clampNumber / getPubDateTimestamp / trimItemsPerFeed / toggleStar 联合主键
 */
import { describe, expect, it } from "vitest"
import { ref } from "vue"
import { looksLikeXml } from "./fetchRss"
import { getPubDateTimestamp } from "./date"
import { clampNumber } from "./settings"
import { trimItemsPerFeed } from "./itemTrim"
import { useArticleOps } from "../composables/useArticleOps"
import type { RssItem } from "../types"

describe("looksLikeXml（代理 fallback 的 XML 特征检测）", () => {
  it.each([
    ["<?xml version=\"1.0\" encoding=\"UTF-8\"?>", true],
    ["<rss version=\"2.0\"><channel/></rss>", true],
    ["<feed xmlns=\"http://www.w3.org/2005/Atom\">", true],
    ["<rdf:RDF xmlns:rdf=\"...\">", true],
    ["  \n  <rss version=\"2.0\">", true],
  ])("XML 特征文本 %j 判定为 true", (text, expected) => {
    expect(looksLikeXml(text)).toBe(expected)
  })

  it.each([
    ["<!DOCTYPE html><html><body>error page</body></html>"],
    ["<html>403 blocked</html>"],
    ["Rate limit exceeded"],
    [""],
  ])("HTML 错误页/纯文本 %j 判定为 false（不得提前终止 fallback 链）", (text) => {
    expect(looksLikeXml(text)).toBe(false)
  })
})

describe("clampNumber（NaN 不得穿透存盘）", () => {
  it("NaN 回退 fallback", () => {
    expect(clampNumber(Number.NaN, 10, 500, 100)).toBe(100)
  })

  it("范围内取整保留，越界钳制", () => {
    expect(clampNumber(55.4, 10, 500, 100)).toBe(55)
    expect(clampNumber(3, 10, 500, 100)).toBe(10)
    expect(clampNumber(9999, 10, 500, 100)).toBe(500)
  })
})

describe("getPubDateTimestamp", () => {
  it("缺失/无效日期返回 0（排序时归为最旧）", () => {
    expect(getPubDateTimestamp(undefined)).toBe(0)
    expect(getPubDateTimestamp("not-a-date")).toBe(0)
  })

  it("有效日期返回毫秒时间戳", () => {
    expect(getPubDateTimestamp("2026-01-02T03:04:05Z")).toBe(Date.parse("2026-01-02T03:04:05Z"))
  })
})

describe("trimItemsPerFeed（优先保留收藏，超限裁剪最旧非收藏）", () => {
  const makeItem = (feedId: string, link: string, pubDate: string, starred = false): RssItem => ({
    title: link,
    link,
    pubDate,
    feedId,
    read: true,
    starred,
  })

  it("超过上限时保留收藏与最新非收藏，裁掉最旧非收藏", () => {
    const items = ref<RssItem[]>([
      makeItem("a", "a-old", "2026-01-01"),
      makeItem("a", "a-mid", "2026-01-02"),
      makeItem("a", "a-starred", "2025-12-01", true),
      makeItem("a", "a-new", "2026-01-03"),
      makeItem("b", "b-new", "2026-01-03"),
    ])
    trimItemsPerFeed(items, 2)
    const feedA = items.value.filter((i) => i.feedId === "a")
    expect(feedA.map((i) => i.link).sort()).toEqual(["a-new", "a-starred"])
    // 其他源不受影响
    expect(items.value.some((i) => i.link === "b-new")).toBe(true)
  })

  it("收藏数超过上限时收藏全部保留（仅裁非收藏）", () => {
    const items = ref<RssItem[]>([
      makeItem("a", "s1", "2026-01-01", true),
      makeItem("a", "s2", "2026-01-02", true),
      makeItem("a", "u1", "2026-01-03"),
    ])
    trimItemsPerFeed(items, 1)
    expect(items.value.map((i) => i.link).sort()).toEqual(["s1", "s2"])
  })
})

describe("toggleStar（feedId + link 联合主键，跨源同 link 不错改）", () => {
  it("只切换目标源的同 link 条目", async () => {
    const sameLink = "https://example.com/reposted"
    const items = ref<RssItem[]>([
      { title: "A", link: sameLink, feedId: "feed-a", read: true, starred: false },
      { title: "B", link: sameLink, feedId: "feed-b", read: true, starred: false },
    ])
    let persistCalls = 0
    const ops = useArticleOps({
      items,
      selectedItem: ref(null),
      showItemDetail: ref(false),
      persist: async () => {
        persistCalls++
      },
    })

    await ops.toggleStar("feed-b", sameLink)

    expect(persistCalls).toBe(1)
    expect(items.value.find((i) => i.feedId === "feed-a")?.starred).toBe(false)
    expect(items.value.find((i) => i.feedId === "feed-b")?.starred).toBe(true)
  })

  it("feedId 不匹配时不做任何变更也不落盘", async () => {
    const items = ref<RssItem[]>([
      { title: "A", link: "https://example.com/x", feedId: "feed-a", read: true, starred: false },
    ])
    let persistCalls = 0
    const ops = useArticleOps({
      items,
      selectedItem: ref(null),
      showItemDetail: ref(false),
      persist: async () => {
        persistCalls++
      },
    })

    await ops.toggleStar("feed-missing", "https://example.com/x")

    expect(persistCalls).toBe(0)
    expect(items.value[0].starred).toBe(false)
  })
})
