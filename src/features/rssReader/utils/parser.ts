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
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, "text/xml")

  // 检查解析错误
  const parseError = doc.querySelector("parsererror")
  if (parseError) {
    throw new Error(`XML解析失败: ${parseError.textContent}`)
  }

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
    const content = getTextContent(item, "content\\:encoded") || getTextContent(item, "content")

    // 尝试提取封面图片
    let coverImage: string | undefined
    const enclosure = item.querySelector("enclosure")
    if (enclosure?.getAttribute("type")?.startsWith("image/")) {
      coverImage = enclosure.getAttribute("url") || undefined
    }
    if (!coverImage && description) {
      coverImage = extractFirstImage(description)
    }

    items.push({
      title: getTextContent(item, "title") || "无标题",
      link,
      description: stripHtml(description)?.slice(0, 300),
      pubDate: getTextContent(item, "pubDate"),
      author: getTextContent(item, "dc\\:creator") || getTextContent(item, "author"),
      content: content || description,
      coverImage,
      categories: Array.from(item.querySelectorAll("category")).map((c) => c.textContent || "").filter(Boolean),
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

    let coverImage: string | undefined
    if (summary || content) {
      coverImage = extractFirstImage(content || summary)
    }

    items.push({
      title: getTextContent(entry, "title") || "无标题",
      link,
      description: stripHtml(summary)?.slice(0, 300),
      pubDate: getTextContent(entry, "published") || getTextContent(entry, "updated"),
      author: getAttributeValue(entry, "author name", ""),
      content: content || summary,
      coverImage,
      categories: Array.from(entry.querySelectorAll("category")).map((c) => c.getAttribute("term") || "").filter(Boolean),
    })
  })

  return {
    feed,
    items,
  }
}

// ========== 辅助函数 ==========

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
  const imageUrl = getTextContent(channel, "image url")
  if (imageUrl) return imageUrl
  return undefined
}

/**
 * 从HTML中提取第一张图片URL
 */
function extractFirstImage(html: string): string | undefined {
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/)
  return match?.[1]
}

/**
 * 生成唯一ID
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}
