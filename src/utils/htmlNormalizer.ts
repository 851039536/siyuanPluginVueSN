/**
 * HTML 内容宽度净化工具
 *
 * 遵循微信公众平台插件规范 #2.4 width：
 *   禁止元素使用固定像素宽度（width: Npx），只允许 auto 或 100%。
 */
export interface NormalizeResult {
  html: string
  changedCount: number
}

const FIXED_WIDTH_IN_STYLE = /\bwidth\s*:\s*\d+(\.\d+)?px\b/gi
const FIXED_MIN_WIDTH_IN_STYLE = /\bmin-width\s*:\s*\d+(\.\d+)?px\b/gi
const HAS_MAX_WIDTH = /max-width\s*:\s*100%/i

export function normalizeWidths(html: string): NormalizeResult {
  let count = 0

  let result = html.replace(
    /<(\w+)([^>]*?)\bstyle\s*=\s*("|')([\s\S]*?)\3([^>]*?)(\s*\/?)>/gi,
    (full, tag, before, _q, style, after, close) => {
      let s = style

      if (FIXED_WIDTH_IN_STYLE.test(s) && !HAS_MAX_WIDTH.test(s)) {
        s = s.replace(FIXED_WIDTH_IN_STYLE, "max-width: 100%; width: auto")
        s = s.replace(/max-width:\s*100%;\s*max-width:\s*100%;/gi, "max-width: 100%;")
      }

      if (FIXED_MIN_WIDTH_IN_STYLE.test(s)) {
        s = s.replace(FIXED_MIN_WIDTH_IN_STYLE, "min-width: 0")
      }

      s = s.replace(/;\s*;+/g, ";").replace(/;\s*$/, "").trim()

      if (s === style) return full
      count++
      return `<${tag}${before}style="${s}"${after}${close}>`
    },
  )

  result = result
    .replace(/<(col|colgroup)([^>]*?)\bwidth\s*=\s*["']?\d+(\.\d+)?["']?([^>]*)>/gi, (_, tag, before, _v, after) => {
      count++
      return `<${tag}${before}${after}>`
    })
    .replace(/<(table|td|th)([^>]*?)\bwidth\s*=\s*["']?\d+(\.\d+)?["']?([^>]*)>/gi, (_, tag, before, _v, after) => {
      count++
      return `<${tag}${before}${after}>`
    })

  return { html: result, changedCount: count }
}
