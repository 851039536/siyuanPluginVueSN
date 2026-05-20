/**
 * HTML 内容宽度净化工具
 *
 * 遵循微信公众平台插件规范 #2.4 width：
 *   禁止元素使用固定像素宽度（width: Npx），只允许 auto 或 100%。
 *   参考：https://developers.weixin.qq.com/doc/service/guide/product/plugin_spec.html#_2-4-width
 *
 * 处理：
 *   - inline style 中的 width: Npx  →  max-width: 100%; width: auto
 *   - inline style 中的 min-width: Npx  →  min-width: 0
 *   - HTML width 属性固定值（如 width="500"）→  移除属性
 *   - 保留 width="100%" / width="auto" / max-width: 100%
 */

export interface NormalizeResult {
  html: string
  /** 修改的元素数量 */
  changedCount: number
  /** 每个修改的详情 */
  changes: { index: number; tag: string; reason: string }[]
}

/** 匹配固定像素宽度（小数也支持，如 586.438px） */
const FIXED_WIDTH_IN_STYLE = /\bwidth\s*:\s*\d+(\.\d+)?px\b/gi
const FIXED_MIN_WIDTH_IN_STYLE = /\bmin-width\s*:\s*\d+(\.\d+)?px\b/gi
const HAS_MAX_WIDTH = /max-width\s*:\s*100%/i

/**
 * 修复单个 style 属性值中的宽度
 */
function fixStyleWidth(style: string): { fixed: string; changed: boolean } {
  let s = style

  // 1. 检查并替换固定 width（已有 max-width: 100% 的跳过）
  if (FIXED_WIDTH_IN_STYLE.test(s) && !HAS_MAX_WIDTH.test(s)) {
    s = s.replace(FIXED_WIDTH_IN_STYLE, 'max-width: 100%; width: auto')
    // 注意：上面的替换可能产生重复，后面会清理
  }

  // 2. 固定 min-width → 0
  if (FIXED_MIN_WIDTH_IN_STYLE.test(s)) {
    s = s.replace(FIXED_MIN_WIDTH_IN_STYLE, 'min-width: 0')
  }

  // 3. 清理重复的 max-width / width 声明
  s = s.replace(/max-width:\s*100%;\s*max-width:\s*100%;/gi, 'max-width: 100%;')
  s = s.replace(/(max-width:\s*100%;\s*width:\s*auto;)\s*\1/gi, '$1')

  // 4. 清理多余分号
  s = s.replace(/;\s*;+/g, ';').replace(/;\s*$/, '').trim()

  return { fixed: s, changed: s !== style }
}

/**
 * 净化 HTML 中的固定宽度样式（style 属性）
 */
export function normalizeWidths(html: string): NormalizeResult {
  const changes: NormalizeResult['changes'] = []
  let count = 0

  // 同时匹配双引号和单引号的 style 属性
  const normalized = html.replace(
    // 匹配 <tag ... style="..." ...> 或 <tag ... style='...' ...>
    // 支持自闭合标签 <tag ... style="..." />
    /<(\w+)([^>]*?)\bstyle\s*=\s*("|')([\s\S]*?)\3([^>]*?)(\s*\/?)>/gi,
    (fullMatch, tag, beforeAttrs, _quote, styleValue, afterAttrs, selfClose) => {
      const { fixed, changed } = fixStyleWidth(styleValue)

      if (!changed) return fullMatch

      count++
      const fixedTag = `<${tag}${beforeAttrs}style="${fixed}"${afterAttrs}${selfClose}>`
      changes.push({
        index: count,
        tag,
        reason: `style 中 width→max-width:100%`,
      })
      return fixedTag
    },
  )

  return { html: normalized, changedCount: count, changes }
}

/**
 * 净化 <table>/<td>/<th>/<col>/<colgroup> 等元素上的 HTML width 属性
 * 保留 width="100%" / width="auto"
 */
export function normalizeTableWidths(html: string): string {
  return html
    // 移除 <colgroup>/<col> 的固定 width（整组替换为空属性）
    .replace(
      /<(col|colgroup)([^>]*?)\bwidth\s*=\s*["']\d+(\.\d+)?["']([^>]*?)>/gi,
      '<$1$2$4>',
    )
    // 移除 <colgroup>/<col> 的固定 width（无引号）
    .replace(
      /<(col|colgroup)([^>]*?)\bwidth\s*=\s*\d+(\.\d+)?([^>]*?)>/gi,
      '<$1$2$4>',
    )
    // 其他元素（table/td/th）的固定像素 width 属性 → 移除
    .replace(
      /<(table|td|th)([^>]*?)\bwidth\s*=\s*["']\d+(\.\d+)?["']([^>]*?)>/gi,
      (_, tag, before, _val, after) => `<${tag}${before}${after}>`,
    )
    .replace(
      /<(table|td|th)([^>]*?)\bwidth\s*=\s*\d+(\.\d+)?([^>]*?)>/gi,
      (_, tag, before, _val, after) => `<${tag}${before}${after}>`,
    )
}
