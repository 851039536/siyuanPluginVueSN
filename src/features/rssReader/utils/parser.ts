/**
 * RSS解析工具 - 解析RSS/Atom XML格式
 */
import type {
  RssFeed,
  RssItem,
} from "../types"
import { stripHtml } from "@/utils/stringUtils"

/**
 * 解析RSS/Atom XML文本为订阅源和条目
 */
export function parseRssXml(xml: string, feedUrl: string): {
  feed: Partial<RssFeed>
  items: Partial<RssItem>[]
} {
  const doc = parseXmlDocument(xml, "XML解析失败")

  // 尝试检测 RSS 或 Atom 格式
  const isAtom = doc.querySelector("feed") !== null
  const isRss = doc.querySelector("rss") !== null || doc.querySelector("channel") !== null

  if (isAtom) {
    return parseAtom(doc, feedUrl)
  } else if (isRss) {
    return parseRss(doc, feedUrl)
  }

  throw new Error("无法识别的Feed格式，请确保URL指向有效的RSS或Atom源")
}

/**
 * 解析RSS 2.0格式
 */
function parseRss(doc: Document, feedUrl: string): {
  feed: Partial<RssFeed>
  items: Partial<RssItem>[]
} {
  const channel = doc.querySelector("channel")
  if (!channel) {
    throw new Error("RSS格式无效：缺少channel元素")
  }

  const feed: Partial<RssFeed> = {
    title: getTextContent(channel, "title") || "未知订阅源",
    url: feedUrl,
    description: getTextContent(channel, "description"),
    siteUrl: getTextContent(channel, "link"),
    iconUrl: getIconUrl(channel),
  }

  const items: Partial<RssItem>[] = []
  const itemElements = channel.querySelectorAll("item")

  itemElements.forEach((item) => {
    const link = getTextContent(item, "link") || getAttributeValue(item, "link", "href")
    const description = getTextContent(item, "description")
    const content = getTextContent(item, "content\:encoded") || getTextContent(item, "content")

    items.push({
      title: getTextContent(item, "title") || "无标题",
      link,
      description: stripHtml(description)?.slice(0, 300),
      pubDate: getTextContent(item, "pubDate"),
      author: getTextContent(item, "dc\:creator") || getTextContent(item, "author"),
      content: content || description,
      coverImage: extractCoverImage(item, description),
      categories: extractCategories(item),
    })
  })

  return {
    feed,
    items,
  }
}

/**
 * 解析Atom格式
 */
function parseAtom(doc: Document, feedUrl: string): {
  feed: Partial<RssFeed>
  items: Partial<RssItem>[]
} {
  const feedEl = doc.querySelector("feed")
  if (!feedEl) {
    throw new Error("Atom格式无效：缺少feed元素")
  }

  const feed: Partial<RssFeed> = {
    title: getTextContent(feedEl, "title") || "未知订阅源",
    url: feedUrl,
    description: getTextContent(feedEl, "subtitle"),
    siteUrl: getAttributeValue(feedEl, "link[rel='alternate']", "href") || getAttributeValue(feedEl, "link", "href"),
    iconUrl: getTextContent(feedEl, "icon") || getTextContent(feedEl, "logo"),
  }

  const items: Partial<RssItem>[] = []
  const entryElements = feedEl.querySelectorAll("entry")

  entryElements.forEach((entry) => {
    const link = getAttributeValue(entry, "link[rel='alternate']", "href")
      || getAttributeValue(entry, "link", "href")
    const summary = getTextContent(entry, "summary")
    const content = getTextContent(entry, "content")
    const rawHtml = content || summary

    items.push({
      title: getTextContent(entry, "title") || "无标题",
      link,
      description: stripHtml(summary)?.slice(0, 300),
      pubDate: getTextContent(entry, "published") || getTextContent(entry, "updated"),
      author: getAttributeValue(entry, "author name", ""),
      content: rawHtml,
      coverImage: extractCoverImage(entry, rawHtml),
      categories: extractCategories(entry),
    })
  })

  return {
    feed,
    items,
  }
}

// ========== 辅助函数 ==========

/**
 * 解析 XML 文本，并统一检查解析错误（RSS/Atom/OPML 共用）
 */
export function parseXmlDocument(xml: string, errorPrefix = "XML解析失败"): Document {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, "text/xml")
  const parseError = doc.querySelector("parsererror")
  if (parseError) {
    throw new Error(`${errorPrefix}: ${parseError.textContent}`)
  }
  return doc
}

function getTextContent(parent: Element, selector: string): string | undefined {
  const el = parent.querySelector(selector)
  return el?.textContent?.trim() || undefined
}

function getAttributeValue(parent: Element, selector: string, attr: string): string | undefined {
  const el = parent.querySelector(selector)
  return el?.getAttribute(attr) || undefined
}

function getIconUrl(channel: Element): string | undefined {
  // RSS 2.0 没有 icon 标准标签，尝试 image/url
  return getTextContent(channel, "image url")
}

/**
 * 提取封面图片：优先 enclosure 图片，其次 HTML 中第一张 <img>
 */
function extractCoverImage(parent: Element, html?: string): string | undefined {
  const enclosure = parent.querySelector("enclosure")
  if (enclosure?.getAttribute("type")?.startsWith("image/")) {
    const url = enclosure.getAttribute("url")
    if (url) return url
  }
  return html ? extractFirstImage(html) : undefined
}

/**
 * 提取分类标签（RSS category 文本 / Atom category term 共用）
 */
function extractCategories(parent: Element): string[] {
  return Array.from(parent.querySelectorAll("category"))
    .map((c) => c.textContent?.trim() || c.getAttribute("term") || "")
    .filter(Boolean)
}

/**
 * 从HTML中提取第一张图片URL
 */
function extractFirstImage(html: string): string | undefined {
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/)
  return match?.[1]
}

/**
 * 将解析结果转换为完整的 RssItem（addFeed/refreshFeed 共用）
 */
export function createRssItemFromParsed(
  pi: Partial<RssItem>,
  feedId: string,
  feedTitle: string,
  untitledLabel: string,
): RssItem {
  return {
    title: pi.title || untitledLabel,
    link: pi.link || "",
    description: pi.description,
    pubDate: pi.pubDate,
    author: pi.author,
    feedId,
    feedTitle,
    read: false,
    starred: false,
    content: pi.content,
    coverImage: pi.coverImage,
    categories: pi.categories,
  }
}

/**
 * 提取发布时间戳（无效/缺失返回 0，用于排序比较）
 */
export function getPubDateTimestamp(dateStr?: string): number {
  if (!dateStr) return 0
  const time = new Date(dateStr).getTime()
  return Number.isNaN(time) ? 0 : time
}

/**
 * 生成唯一ID
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}
