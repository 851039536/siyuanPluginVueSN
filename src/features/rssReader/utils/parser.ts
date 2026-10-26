/**
 * RSS解析工具 - 解析RSS/Atom XML格式
 */
import type {
  RssFeed,
  RssItem,
} from "../types"
import { stripHtml } from "@/utils/stringUtils"

/** 用户可见的解析错误文案（由调用方传入 i18n，缺省仅兜底） */
export interface RssParseMessages {
  /** Feed 格式无法识别 */
  unrecognizedFormat?: string
  /** XML 解析失败前缀 */
  xmlParseFailed?: string
}

/**
 * 解析RSS/Atom XML文本为订阅源和条目
 */
export function parseRssXml(xml: string, feedUrl: string, msgs?: RssParseMessages): {
  feed: Partial<RssFeed>
  items: Partial<RssItem>[]
} {
  const doc = parseXmlDocument(xml, msgs?.xmlParseFailed ?? "XML parse failed")

  // 尝试检测 RSS 或 Atom 格式
  const isAtom = doc.querySelector("feed") !== null
  const isRss = doc.querySelector("rss") !== null || doc.querySelector("channel") !== null

  if (isAtom) {
    return parseAtom(doc, feedUrl)
  } else if (isRss) {
    return parseRss(doc, feedUrl)
  }

  throw new Error(msgs?.unrecognizedFormat ?? "Unrecognized feed format. Make sure the URL points to a valid RSS or Atom feed")
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
    // title 交由调用方兜底（i18n / url），此处不做硬编码文案
    title: getTextContent(channel, "title"),
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
      // title 交由 normalizeParsedItems 的 untitledLabel（i18n）兜底
      title: getTextContent(item, "title"),
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
    // title 交由调用方兜底（i18n / url），此处不做硬编码文案
    title: getTextContent(feedEl, "title"),
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
      // title 交由 normalizeParsedItems 的 untitledLabel（i18n）兜底
      title: getTextContent(entry, "title"),
      link,
      description: stripHtml(summary)?.slice(0, 300),
      pubDate: getTextContent(entry, "published") || getTextContent(entry, "updated"),
      // Atom 作者在 <author><name> 子元素内（部分源直接把文本写在 <author> 里）
      author: getTextContent(entry, "author name") || getTextContent(entry, "author"),
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
 * 生成唯一ID
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}
