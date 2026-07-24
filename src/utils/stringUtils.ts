/**
 * 通用字符串工具函数
 */

/**
 * 从 unknown 类型的捕获错误中提取可读消息（配合 catch (e: unknown) 使用）
 * 优先取 Error.message，其次字符串本身，否则返回空串
 */
export function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === "string") return e
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message: unknown }).message)
  }
  return ""
}

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
