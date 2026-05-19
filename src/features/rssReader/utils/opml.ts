/**
 * OPML 导入导出工具
 * OPML 是 RSS 订阅源交换的标准 XML 格式
 */

export interface OpmlOutline {
  url: string
  title?: string
  group?: string
}

/**
 * 将订阅源列表导出为 OPML XML 字符串
 */
export function exportToOpml(feeds: { title: string; url: string; group?: string; siteUrl?: string }[]): string {
  if (feeds.length === 0) return ""

  const outlines = feeds
    .map((f) => {
      const attrs = [
        `text="${escapeXml(f.title || f.url)}"`,
        `title="${escapeXml(f.title || f.url)}"`,
        `type="rss"`,
        `xmlUrl="${escapeXml(f.url)}"`,
      ]
      if (f.siteUrl) attrs.push(`htmlUrl="${escapeXml(f.siteUrl)}"`)
      if (f.group) attrs.push(`category="${escapeXml(f.group)}"`)
      return `    <outline ${attrs.join(" ")}/>`
    })
    .join("\n")

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<opml version="2.0">\n'
    + "  <head>\n"
    + "    <title>SiYuan RSS Subscriptions</title>\n"
    + "  </head>\n"
    + "  <body>\n"
    + outlines
    + "\n  </body>\n"
    + "</opml>"
  )
}

/**
 * 解析 OPML XML 文本，提取订阅源列表
 */
export function parseOpml(xml: string): OpmlOutline[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, "text/xml")

  const parseError = doc.querySelector("parsererror")
  if (parseError) throw new Error(`OPML 解析失败: ${parseError.textContent}`)

  const outlines: OpmlOutline[] = []
  doc.querySelectorAll("outline").forEach((el) => {
    const type = el.getAttribute("type")
    const xmlUrl = el.getAttribute("xmlUrl")
    if (xmlUrl && (!type || type === "rss")) {
      outlines.push({
        url: xmlUrl,
        title: el.getAttribute("text") || el.getAttribute("title") || undefined,
        group: el.getAttribute("category") || undefined,
      })
    }
  })
  return outlines
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}
