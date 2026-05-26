/**
 * 通用字符串工具函数
 */

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

const FULL_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;",
  "`": "&#96;",
}

export function escapeHtmlFull(str: string): string {
  return str.replace(/[&<>"'`]/g, (ch) => FULL_ESCAPE_MAP[ch] || ch)
}

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

export function stripHtml(html?: string): string | undefined {
  if (!html) return undefined
  const result = html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
  return result || undefined
}

export function stripHtmlSimple(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
}

export function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, num) => String.fromCharCode(Number(num)))
}
