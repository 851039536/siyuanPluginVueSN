/**
 * 主题样式注入器
 * 将 PublishTheme 中的元素样式和容器样式注入到渲染后的 HTML 中
 */
import type { PublishTheme } from "../types/index"

/**
 * 构建内联样式字符串（CSS 属性 → 值）
 */
function buildStyleString(styles: Record<string, string>): string {
  return Object.entries(styles)
    .map(([prop, value]) => `${prop}: ${value}`)
    .join("; ")
}

/**
 * 将主题的元素样式注入到各 HTML 标签
 */
function applyElementStyles(html: string, theme: PublishTheme): string {
  let result = html
  const { elements } = theme

  for (const [tag, styles] of Object.entries(elements)) {
    const styleStr = buildStyleString(styles)

    // 处理带 class 的语言标记（pre code 特殊处理）
    if (tag === "pre code") {
      result = result.replace(
        /<code class="language-/g,
        `<code style="${styleStr}" class="language-`,
      )
    } else {
      // 为每个标签注入内联样式（保留原有属性）
      const tagRegex = new RegExp(`<${tag}([>\\s])`, "g")
      result = result.replace(tagRegex, `<${tag} style="${styleStr}"$1`)
    }
  }

  return result
}

/**
 * 为整个内容包裹容器，注入容器样式
 */
function wrapWithContainer(html: string, theme: PublishTheme): string {
  const containerStyle = buildStyleString(theme.container)
  return `<div style="${containerStyle}">${html}</div>`
}

/**
 * 将完整主题样式注入 HTML
 * @param html 原始 HTML（已含内联样式代码高亮）
 * @param theme 目标平台主题
 * @returns 注入主题样式后的完整 HTML
 */
export function applyTheme(html: string, theme: PublishTheme): string {
  const styledHtml = applyElementStyles(html, theme)
  return wrapWithContainer(styledHtml, theme)
}

/**
 * 构建用于复制的完整 HTML（含微信兼容元信息）
 */
export function buildExportableHtml(html: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtmlAttr(title)}</title>
</head>
<body style="margin: 0; padding: 0;">
${html}
</body>
</html>`
}

function escapeHtmlAttr(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}
