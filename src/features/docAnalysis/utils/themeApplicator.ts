/**
 * 主题样式注入器
 * 将 PublishTheme 中的元素样式和容器样式注入到渲染后的 HTML 中
 */
import type { PublishTheme } from "../types/index"
import { escapeHtml } from "@/utils/stringUtils"

/**
 * 构建内联样式字符串（CSS 属性 → 值）
 * 值中双引号转义为 &quot; 防止截断 style 属性
 */
function buildStyleString(styles: Record<string, string>): string {
  return Object.entries(styles)
    .map(([prop, value]) => `${prop}: ${value.replace(/"/g, "&quot;")}`)
    .join("; ")
}

/**
 * 将主题的元素样式注入到各 HTML 标签
 * 三阶段处理：pre code → 行内 code → 其余标签，确保幂等且不覆盖已有 style
 */
function applyElementStyles(html: string, theme: PublishTheme): string {
  let result = html
  const { elements } = theme

  // 阶段 1：处理 pre code（围栏代码块）
  const preCodeStyles = elements["pre code"]
  if (preCodeStyles) {
    const s = buildStyleString(preCodeStyles)
    // 有语言标记的围栏代码
    result = result.replace(/<code class="language-/g, `<code style="${s}" class="language-`)
    // 无语言标记的围栏代码
    result = result.replace(/<pre><code>/g, `<pre><code style="${s}">`)
  }

  // 阶段 2：处理行内 code（此时块级 code 已带 style=，不会被误伤）
  const codeStyles = elements["code"]
  if (codeStyles) {
    const s = buildStyleString(codeStyles)
    result = result.replace(/<code>/g, `<code style="${s}">`)
  }

  // 阶段 3：处理其余标签（跳过 code 和 pre code），负向前瞻跳过已含 style 的标签
  for (const [tag, styles] of Object.entries(elements)) {
    if (tag === "code" || tag === "pre code") continue
    const styleStr = buildStyleString(styles)
    const tagRegex = new RegExp(`<${tag}(?=[>\\s])(?![^>]*\\bstyle=)`, "g")
    result = result.replace(tagRegex, `<${tag} style="${styleStr}"`)
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
<title>${escapeHtml(title)}</title>
</head>
<body style="margin: 0; padding: 0;">
${html}
</body>
</html>`
}
