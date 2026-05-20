/**
 * HTML 内容宽度净化工具
 *
 * 将固定像素宽度转换为响应式宽度，适配手机端发布（微信公众号等平台要求）：
 * - width: Npx → max-width: 100%; width: auto
 * - min-width: Npx → min-width: 0
 * - 保留 width: auto / width: 100% / max-width: 100%
 */

export interface NormalizeResult {
  html: string
  /** 修改的段落/元素数量 */
  changedCount: number
  /** 每个修改的详情 */
  changes: { index: number; tag: string; before: string; after: string }[]
}

const FIXED_WIDTH_REGEX = /width\s*:\s*\d+(\.\d+)?px/i
const FIXED_MIN_WIDTH_REGEX = /min-width\s*:\s*\d+(\.\d+)?px/i
const MAX_WIDTH_REGEX = /max-width\s*:\s*/i

/**
 * 净化 HTML 中的固定宽度样式
 */
export function normalizeWidths(html: string): NormalizeResult {
  const changes: NormalizeResult['changes'] = []
  let index = 0

  const normalized = html.replace(
    // 匹配带有 style 属性的 HTML 标签
    /(<(\w+)([^>]*)\bstyle\s*=\s*"([^"]*)"([^>]*)>)/gi,
    (fullMatch, _1, tag, _2, styleContent, _3) => {
      const originalStyle = styleContent
      let newStyle = styleContent

      // 检查是否有固定像素宽度
      if (FIXED_WIDTH_REGEX.test(newStyle) && !MAX_WIDTH_REGEX.test(newStyle)) {
        // 替换固定 width 为响应式
        newStyle = newStyle.replace(
          /\bwidth\s*:\s*\d+(\.\d+)?px\s*;?/gi,
          'max-width: 100%; width: auto;',
        )
      }

      // 替换固定 min-width
      if (FIXED_MIN_WIDTH_REGEX.test(newStyle)) {
        newStyle = newStyle.replace(
          /\bmin-width\s*:\s*\d+(\.\d+)?px\s*;?/gi,
          'min-width: 0;',
        )
      }

      // 清理多余分号
      newStyle = newStyle.replace(/;\s*;+/g, ';').replace(/;\s*$/g, '')

      if (newStyle !== originalStyle) {
        index++
        changes.push({
          index,
          tag,
          before: fullMatch,
          after: fullMatch.replace(styleContent, newStyle),
        })
      }

      return fullMatch.replace(styleContent, newStyle)
    },
  )

  return {
    html: normalized,
    changedCount: changes.length,
    changes,
  }
}

/**
 * 可选：也处理 table 内的固定列宽
 */
export function normalizeTableWidths(html: string): string {
  // 表格内的 colgroup/col 固定宽度 → 移除，让表格自适应
  return html.replace(
    /<(col|colgroup)[^>]*\bstyle\s*=\s*"[^"]*width\s*:\s*\d+(\.\d+)?px[^"]*"[^>]*>/gi,
    (match) => {
      // 将 col/colgroup 的固定宽度移除
      return match.replace(
        /\bstyle\s*=\s*"[^"]*"/gi,
        () => 'style=""',
      )
    },
  )
}
