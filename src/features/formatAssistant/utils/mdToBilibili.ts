/**
 * Markdown 转哔哩哔哩专栏格式转换器
 *
 * 哔哩哔哩专栏编辑器特点：
 * 1. 不支持 <style> 标签，所有样式必须内联
 * 2. 不支持 class 属性
 * 3. 支持有限的 HTML 标签
 * 4. 风格偏向年轻化、二次元
 *
 * 策略：先使用 marked 将 Markdown 转为标准 HTML，
 * 再对 HTML 进行后处理，添加内联样式
 */
import hljs from "highlight.js"
import { marked } from "marked"
import type { BilibiliTheme } from "../types/storage"

/**
 * 哔哩哔哩主题配色定义
 */
interface BilibiliThemeColors {
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
  codeBlockHeaderBg: string
  codeBlockHeaderColor: string
}

/**
 * 预定义哔哩哔哩主题
 */
const BILIBILI_THEMES: Record<BilibiliTheme, BilibiliThemeColors> = {
  default: {
    primary: "#00a1d6",
    headingColor: "#18191c",
    textColor: "#333333",
    quoteBorderColor: "#00a1d6",
    quoteBgColor: "#f0faff",
    codeBgColor: "#f6f8fa",
    inlineCodeBgColor: "#fff1f0",
    inlineCodeColor: "#ff4d4f",
    linkColor: "#00a1d6",
    hrColor: "#e3e5e7",
    tableHeaderBg: "#f6f8fa",
    tableBorderColor: "#e3e5e7",
    strongColor: "#18191c",
    codeBlockHeaderBg: "#e3e5e7",
    codeBlockHeaderColor: "#9499a0",
  },
  pink: {
    primary: "#fb7299",
    headingColor: "#18191c",
    textColor: "#333333",
    quoteBorderColor: "#fb7299",
    quoteBgColor: "#fff0f5",
    codeBgColor: "#f9f0f4",
    inlineCodeBgColor: "#fff0f5",
    inlineCodeColor: "#fb7299",
    linkColor: "#fb7299",
    hrColor: "#e3e5e7",
    tableHeaderBg: "#fff0f5",
    tableBorderColor: "#f9b4c8",
    strongColor: "#18191c",
    codeBlockHeaderBg: "#fce4ec",
    codeBlockHeaderColor: "#9499a0",
  },
  dark: {
    primary: "#23ade5",
    headingColor: "#e6e6e6",
    textColor: "#c9c9c9",
    quoteBorderColor: "#23ade5",
    quoteBgColor: "#2a2a2a",
    codeBgColor: "#1e1e1e",
    inlineCodeBgColor: "#2d2d2d",
    inlineCodeColor: "#23ade5",
    linkColor: "#23ade5",
    hrColor: "#3a3a3a",
    tableHeaderBg: "#2a2a2a",
    tableBorderColor: "#3a3a3a",
    strongColor: "#e6e6e6",
    codeBlockHeaderBg: "#333333",
    codeBlockHeaderColor: "#9499a0",
  },
  mint: {
    primary: "#2db84b",
    headingColor: "#18191c",
    textColor: "#333333",
    quoteBorderColor: "#2db84b",
    quoteBgColor: "#f0fff4",
    codeBgColor: "#f0f9f1",
    inlineCodeBgColor: "#f0fff4",
    inlineCodeColor: "#2db84b",
    linkColor: "#2db84b",
    hrColor: "#e3e5e7",
    tableHeaderBg: "#f0fff4",
    tableBorderColor: "#b7eb8f",
    strongColor: "#18191c",
    codeBlockHeaderBg: "#e8f5e9",
    codeBlockHeaderColor: "#9499a0",
  },
}

/**
 * HTML 转义
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

/**
 * 对 HTML 字符串中的标签添加内联样式（哔哩哔哩风格）
 */
function applyInlineStyles(html: string, colors: BilibiliThemeColors, fontSize: number, lineHeight: number): string {
  let result = html

  // h1 - h6
  for (let i = 1; i <= 6; i++) {
    const size = Math.round(fontSize * (1 + (7 - i) * 0.15))
    const marginTop = i <= 2 ? "30px" : "20px"
    const borderStyle = i === 1
      ? `border-bottom: 2px solid ${colors.primary}; padding-bottom: 8px;`
      : i === 2
        ? `border-bottom: 1px solid ${colors.hrColor}; padding-bottom: 6px;`
        : ""
    const style = `margin-top: ${marginTop}; margin-bottom: 10px; font-size: ${size}px; font-weight: bold; color: ${colors.headingColor}; line-height: ${lineHeight}; ${borderStyle}`
    result = result.replace(new RegExp(`<h${i}>`, "g"), `<h${i} style="${style}">`)
  }

  // p
  result = result.replace(
    /<p>/g,
    `<p style="margin-top: 0; margin-bottom: 16px; font-size: ${fontSize}px; color: ${colors.textColor}; line-height: ${lineHeight}; letter-spacing: 0.5px;">`,
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
    `<img src="$1" alt="$2" style="max-width: 100%; border-radius: 8px; margin: 10px 0;" />`,
  )

  // blockquote
  result = result.replace(
    /<blockquote>/g,
    `<blockquote style="margin: 16px 0; padding: 12px 16px; border-left: 4px solid ${colors.quoteBorderColor}; background-color: ${colors.quoteBgColor}; color: ${colors.textColor}; font-size: ${fontSize}px; line-height: ${lineHeight}; border-radius: 0 8px 8px 0;">`,
  )

  // pre (代码块)
  result = result.replace(
    /<pre>/g,
    `<pre style="margin: 16px 0; padding: 0; background-color: ${colors.codeBgColor}; border-radius: 8px; overflow: hidden; line-height: 1.6;">`,
  )

  // code with class (代码块内的 code)
  result = result.replace(
    /<code class="language-(\w+)">/g,
    (_, lang) => `<code class="language-${lang}" style="font-family: 'Menlo', 'Monaco', 'Consolas', monospace; font-size: ${Math.round(fontSize * 0.85)}px; color: ${colors.textColor}; background: none; padding: 0; border-radius: 0;">`,
  )

  // code (行内代码，不含 class 的)
  result = result.replace(
    /<code>(?!.*class="language-)/g,
    `<code style="background-color: ${colors.inlineCodeBgColor}; color: ${colors.inlineCodeColor}; padding: 2px 6px; border-radius: 4px; font-family: 'Menlo', 'Monaco', 'Consolas', monospace; font-size: ${Math.round(fontSize * 0.9)}px;">`,
  )

  // hr
  result = result.replace(
    /<hr\s*\/?>/g,
    `<hr style="border: none; border-top: 1px solid ${colors.hrColor}; margin: 24px 0;" />`,
  )

  // ul
  result = result.replace(
    /<ul>/g,
    `<ul style="padding-left: 20px; margin: 10px 0; list-style-type: disc;">`,
  )

  // ol
  result = result.replace(
    /<ol>/g,
    `<ol style="padding-left: 24px; margin: 10px 0; list-style-type: decimal;">`,
  )

  // li
  result = result.replace(
    /<li>/g,
    `<li style="margin-bottom: 6px; font-size: ${fontSize}px; color: ${colors.textColor}; line-height: ${lineHeight};">`,
  )

  // table
  result = result.replace(
    /<table>/g,
    `<table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: ${fontSize}px; border-radius: 8px; overflow: hidden;">`,
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
    `<th style="padding: 10px 14px; background-color: ${colors.tableHeaderBg}; border: 1px solid ${colors.tableBorderColor}; font-size: ${fontSize}px; font-weight: bold; color: ${colors.headingColor}; text-align: left;">`,
  )

  // td
  result = result.replace(
    /<td>/g,
    `<td style="padding: 10px 14px; border: 1px solid ${colors.tableBorderColor}; font-size: ${fontSize}px; color: ${colors.textColor};">`,
  )

  return result
}

/**
 * 将 Markdown 转换为哔哩哔哩专栏格式
 */
export async function convertMdToBilibili(
  markdown: string,
  options: {
    theme: BilibiliTheme
    fontSize: number
    lineHeight: number
    codeHighlight: boolean
  },
): Promise<string> {
  const { theme, fontSize, lineHeight, codeHighlight } = options
  const colors = BILIBILI_THEMES[theme]

  // 使用 marked.use 配置代码高亮
  marked.use({
    breaks: true,
    gfm: true,
    renderer: {
      code({ text, lang }: { text: string, lang?: string }) {
        const langAttr = lang ? ` class="language-${lang}"` : ""
        const langLabel = lang
          ? `<div style="font-size: 12px; color: ${colors.codeBlockHeaderColor}; background-color: ${colors.codeBlockHeaderBg}; padding: 6px 12px; border-bottom: 1px solid ${colors.hrColor}; text-transform: uppercase; letter-spacing: 0.5px;">${lang}</div>`
          : ""
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
        return `<pre><code${langAttr}>${langLabel}${highlighted}</code></pre>`
      },
    },
  })

  const html = await marked.parse(markdown)

  // 添加内联样式
  const styledHtml = applyInlineStyles(html, colors, fontSize, lineHeight)

  // 哔哩哔哩专栏需要完整的外层包裹
  return `<section style="padding: 16px; max-width: 100%; box-sizing: border-box; word-wrap: break-word;">${styledHtml}</section>`
}

/**
 * 获取哔哩哔哩主题列表
 */
export function getBilibiliThemes(): { value: BilibiliTheme; label: string; color: string }[] {
  return [
    { value: "default", label: "哔哩蓝", color: "#00a1d6" },
    { value: "pink", label: "少女粉", color: "#fb7299" },
    { value: "dark", label: "暗夜黑", color: "#333333" },
    { value: "mint", label: "薄荷绿", color: "#2db84b" },
  ]
}
