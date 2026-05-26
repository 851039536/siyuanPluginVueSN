import type { WechatTheme } from "../types/storage"
/**
 * Markdown 转微信公众号格式转换器
 *
 * 微信公众号编辑器特点：
 * 1. 不支持 <style> 标签，所有样式必须内联
 * 2. 不支持 class 属性
 * 3. 支持有限的 HTML 标签
 *
 * 策略：先使用 marked 将 Markdown 转为标准 HTML，
 * 再对 HTML 进行后处理，添加内联样式
 */
import hljs from "highlight.js"
import { marked } from "marked"
import { escapeHtml } from "@/utils/stringUtils"
import { normalizeWidths } from "../../htmlViewer/utils/normalizeWidths"

/**
 * 微信主题配色定义
 */
interface ThemeColors {
  primary: string
  headingColor: string
  textColor: string
  quoteBorderColor: string
  quoteBgColor: string
  codeBgColor: string
  inlineCodeBgColor: string
  inlineCodeColor: string
  linkColor: string
  hrColor: string
  tableHeaderBg: string
  tableBorderColor: string
  strongColor: string
}

/**
 * 预定义主题
 */
const WECHAT_THEMES: Record<WechatTheme, ThemeColors> = {
  default: {
    primary: "#07c160",
    headingColor: "#1a1a1a",
    textColor: "#3f3f3f",
    quoteBorderColor: "#07c160",
    quoteBgColor: "#f0faf4",
    codeBgColor: "#f6f8fa",
    inlineCodeBgColor: "#fff5f5",
    inlineCodeColor: "#ff502c",
    linkColor: "#07c160",
    hrColor: "#e0e0e0",
    tableHeaderBg: "#f6f8fa",
    tableBorderColor: "#dfe2e5",
    strongColor: "#1a1a1a",
  },
  green: {
    primary: "#52c41a",
    headingColor: "#135200",
    textColor: "#333333",
    quoteBorderColor: "#52c41a",
    quoteBgColor: "#f6ffed",
    codeBgColor: "#f0f5eb",
    inlineCodeBgColor: "#f6ffed",
    inlineCodeColor: "#52c41a",
    linkColor: "#52c41a",
    hrColor: "#d9d9d9",
    tableHeaderBg: "#f6ffed",
    tableBorderColor: "#b7eb8f",
    strongColor: "#135200",
  },
  orange: {
    primary: "#fa8c16",
    headingColor: "#873800",
    textColor: "#333333",
    quoteBorderColor: "#fa8c16",
    quoteBgColor: "#fff7e6",
    codeBgColor: "#fff8f0",
    inlineCodeBgColor: "#fff7e6",
    inlineCodeColor: "#fa8c16",
    linkColor: "#fa8c16",
    hrColor: "#d9d9d9",
    tableHeaderBg: "#fff7e6",
    tableBorderColor: "#ffd591",
    strongColor: "#873800",
  },
  purple: {
    primary: "#722ed1",
    headingColor: "#22075e",
    textColor: "#333333",
    quoteBorderColor: "#722ed1",
    quoteBgColor: "#f9f0ff",
    codeBgColor: "#f5f0f8",
    inlineCodeBgColor: "#f9f0ff",
    inlineCodeColor: "#722ed1",
    linkColor: "#722ed1",
    hrColor: "#d9d9d9",
    tableHeaderBg: "#f9f0ff",
    tableBorderColor: "#d3adf7",
    strongColor: "#22075e",
  },
  blue: {
    primary: "#1890ff",
    headingColor: "#003a8c",
    textColor: "#333333",
    quoteBorderColor: "#1890ff",
    quoteBgColor: "#e6f7ff",
    codeBgColor: "#f0f7ff",
    inlineCodeBgColor: "#e6f7ff",
    inlineCodeColor: "#1890ff",
    linkColor: "#1890ff",
    hrColor: "#d9d9d9",
    tableHeaderBg: "#e6f7ff",
    tableBorderColor: "#91d5ff",
    strongColor: "#003a8c",
  },
}

/**
 * 对 HTML 字符串中的标签添加内联样式
 */
function applyInlineStyles(html: string, colors: ThemeColors, fontSize: number, lineHeight: number): string {
  let result = html

  // h1 - h6
  for (let i = 1; i <= 6; i++) {
    const size = Math.round(fontSize * (1 + (7 - i) * 0.15))
    const marginTop = i <= 2 ? "24px" : "16px"
    const borderStyle = i <= 2 ? `border-bottom: 1px solid ${colors.hrColor}; padding-bottom: 6px;` : ""
    const style = `margin-top: ${marginTop}; margin-bottom: 8px; font-size: ${size}px; font-weight: bold; color: ${colors.headingColor}; line-height: ${lineHeight}; ${borderStyle}`
    result = result.replace(new RegExp(`<h${i}>`, "g"), `<h${i} style="${style}">`)
  }

  // p
  result = result.replace(
    /<p>/g,
    `<p style="margin-top: 0; margin-bottom: 12px; font-size: ${fontSize}px; color: ${colors.textColor}; line-height: ${lineHeight}; letter-spacing: 0.5px;">`,
  )

  // strong
  result = result.replace(
    /<strong>/g,
    `<strong style="color: ${colors.strongColor}; font-weight: bold;">`,
  )

  // em
  result = result.replace(
    /<em>/g,
    `<em style="font-style: italic; color: ${colors.primary};">`,
  )

  // del
  result = result.replace(
    /<del>/g,
    `<del style="text-decoration: line-through; color: #999;">`,
  )

  // a
  result = result.replace(
    /<a href="([^"]*)">/g,
    `<a href="$1" style="color: ${colors.linkColor}; text-decoration: none; border-bottom: 1px solid ${colors.linkColor};">`,
  )

  // img
  result = result.replace(
    /<img src="([^"]*)" alt="([^"]*)"[^/]*\/?>/g,
    `<img src="$1" alt="$2" style="max-width: 100%; border-radius: 4px; margin: 8px 0;" />`,
  )

  // blockquote
  result = result.replace(
    /<blockquote>/g,
    `<blockquote style="margin: 12px 0; padding: 8px 14px; border-left: 4px solid ${colors.quoteBorderColor}; background-color: ${colors.quoteBgColor}; color: ${colors.textColor}; font-size: ${fontSize}px; line-height: ${lineHeight};">`,
  )

  // pre (代码块)
  result = result.replace(
    /<pre>/g,
    `<pre style="margin: 12px 0; padding: 0; background-color: ${colors.codeBgColor}; border-radius: 4px; overflow-x: auto; line-height: 1.5;">`,
  )

  // code with class (代码块内的 code，如 <code class="language-javascript">)
  result = result.replace(
    /<code class="language-(\w+)">/g,
    (_, lang) => `<code class="language-${lang}" style="display: block; white-space: pre; overflow-x: auto; padding: 14px; font-family: 'Menlo', 'Monaco', 'Consolas', monospace; font-size: ${Math.round(fontSize * 0.85)}px; color: #333; background: none; border-radius: 0 0 4px 4px;">`,
  )

  // code (行内代码，不含 class 的)
  result = result.replace(
    /<code>(?!.*class="language-)/g,
    `<code style="background-color: ${colors.inlineCodeBgColor}; color: ${colors.inlineCodeColor}; padding: 2px 6px; border-radius: 3px; font-family: 'Menlo', 'Monaco', 'Consolas', monospace; font-size: ${Math.round(fontSize * 0.9)}px;">`,
  )

  // hr
  result = result.replace(
    /<hr\s*\/?>/g,
    `<hr style="border: none; border-top: 1px solid ${colors.hrColor}; margin: 18px 0;" />`,
  )

  // ul
  result = result.replace(
    /<ul>/g,
    `<ul style="padding-left: 18px; margin: 8px 0; list-style-type: disc;">`,
  )

  // ol
  result = result.replace(
    /<ol>/g,
    `<ol style="padding-left: 24px; margin: 8px 0; list-style-type: decimal;">`,
  )

  // li
  result = result.replace(
    /<li>/g,
    `<li style="margin-bottom: 4px; font-size: ${fontSize}px; color: ${colors.textColor}; line-height: ${lineHeight};">`,
  )

  // table
  result = result.replace(
    /<table>/g,
    `<table style="width: 100%; border-collapse: collapse; margin: 12px 0; font-size: ${fontSize}px;">`,
  )

  // thead
  result = result.replace(
    /<thead>/g,
    `<thead style="background-color: ${colors.tableHeaderBg};">`,
  )

  // tbody
  result = result.replace(
    /<tbody>/g,
    `<tbody>`,
  )

  // tr
  result = result.replace(
    /<tr>/g,
    `<tr style="border-bottom: 1px solid ${colors.tableBorderColor};">`,
  )

  // th
  result = result.replace(
    /<th>/g,
    `<th style="padding: 8px 12px; background-color: ${colors.tableHeaderBg}; border: 1px solid ${colors.tableBorderColor}; font-size: ${fontSize}px; font-weight: bold; color: ${colors.headingColor}; text-align: left;">`,
  )

  // td
  result = result.replace(
    /<td>/g,
    `<td style="padding: 8px 12px; border: 1px solid ${colors.tableBorderColor}; font-size: ${fontSize}px; color: ${colors.textColor};">`,
  )

  return result
}

/**
 * 将 Markdown 转换为微信公众号格式
 */
export async function convertMdToWechat(
  markdown: string,
  options: {
    theme: WechatTheme
    fontSize: number
    lineHeight: number
    codeHighlight: boolean
  },
): Promise<string> {
  const {
    theme,
    fontSize,
    lineHeight,
    codeHighlight,
  } = options
  const colors = WECHAT_THEMES[theme]

  // 使用 marked.use 配置代码高亮
  marked.use({
    breaks: true,
    gfm: true,
    renderer: {
      code({
        text,
        lang,
      }: { text: string, lang?: string }) {
        const langAttr = lang ? ` class="language-${lang}"` : ""
        const langLabel = lang ? `<div style="font-size: 12px; color: #999; padding: 8px 16px 4px; text-align: right; background-color: ${colors.codeBgColor}; border-radius: 4px 4px 0 0;">${lang}</div>` : ""
        let highlighted: string
        if (codeHighlight && lang) {
          try {
            highlighted = hljs.getLanguage(lang)
              ? hljs.highlight(text, { language: lang }).value
              : escapeHtml(text)
          } catch {
            highlighted = escapeHtml(text)
          }
        } else {
          highlighted = escapeHtml(text)
        }
        return `<pre>${langLabel}<code${langAttr}>${highlighted}</code></pre>`
      },
    },
  })

  const html = await marked.parse(markdown)

  // 添加内联样式
  const styledHtml = applyInlineStyles(html, colors, fontSize, lineHeight)

  // 净化固定宽度，适配手机端发布
  const normalizedHtml = normalizeWidths(styledHtml).html

  // 微信公众号需要完整的外层包裹
  return `<section style="padding: 14px; max-width: 100%; box-sizing: border-box; word-wrap: break-word;">${normalizedHtml}</section>`
}

/**
 * 获取主题列表
 */
export function getWechatThemes(): { value: WechatTheme, label: string, color: string }[] {
  return [
    {
      value: "default",
      label: "微信绿",
      color: "#07c160",
    },
    {
      value: "green",
      label: "清新绿",
      color: "#52c41a",
    },
    {
      value: "orange",
      label: "活力橙",
      color: "#fa8c16",
    },
    {
      value: "purple",
      label: "优雅紫",
      color: "#722ed1",
    },
    {
      value: "blue",
      label: "科技蓝",
      color: "#1890ff",
    },
  ]
}
