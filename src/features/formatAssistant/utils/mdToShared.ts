/**
 * Markdown 转富文本格式的共享逻辑
 *
 * 微信公众号和哔哩哔哩专栏的编辑器都不支持 <style> 标签和 class 属性，
 * 所有样式必须内联。本模块提供共享的 Markdown → 内联样式 HTML 转换逻辑，
 * 通过 StyleOverrides 配置实现平台差异化。
 */
import type { CodeWrapMode } from "../types/storage"
import hljs from "highlight.js"
import { marked } from "marked"
import { escapeHtml } from "@/utils/stringUtils"
import { normalizeWidths } from "../../htmlViewer/utils/normalizeWidths"

/**
 * hljs class → inline style 映射（微信不支持 class，需转为内联样式）
 */
const HLJS_INLINE_COLORS: Record<string, string> = {
  "hljs-keyword": "#d73a49",
  "hljs-built_in": "#e36209",
  "hljs-type": "#d73a49",
  "hljs-literal": "#d73a49",
  "hljs-number": "#005cc5",
  "hljs-string": "#032f62",
  "hljs-template-variable": "#005cc5",
  "hljs-regexp": "#032f62",
  "hljs-symbol": "#005cc5",
  "hljs-variable": "#e36209",
  "hljs-title": "#6f42c1",
  "hljs-title.class_": "#6f42c1",
  "hljs-title.function_": "#6f42c1",
  "hljs-params": "#24292e",
  "hljs-comment": "#6a737d",
  "hljs-doctag": "#d73a49",
  "hljs-meta": "#6a737d",
  "hljs-meta-keyword": "#d73a49",
  "hljs-meta-string": "#032f62",
  "hljs-section": "#005cc5",
  "hljs-selector-tag": "#005cc5",
  "hljs-selector-id": "#6f42c1",
  "hljs-selector-class": "#6f42c1",
  "hljs-selector-attr": "#6f42c1",
  "hljs-selector-pseudo": "#6f42c1",
  "hljs-attr": "#6f42c1",
  "hljs-attribute": "#005cc5",
  "hljs-name": "#005cc5",
  "hljs-tag": "#22863a",
  "hljs-link": "#005cc5",
  "hljs-addition": "#22863a",
  "hljs-deletion": "#b31d28",
  "hljs-emphasis": "font-style: italic",
  "hljs-strong": "font-weight: bold",
  "hljs-property": "#005cc5",
  "hljs-punctuation": "#24292e",
  "hljs-operator": "#d73a49",
}

/**
 * 将 hljs 输出的 class-based spans 转换为 inline style spans（兼容微信）
 */
function convertHljsToInlineStyles(highlighted: string): string {
  return highlighted.replace(
    /<span class="([^"]+)">/g,
    (_, classes: string) => {
      const classList = classes.split(/\s+/)
      const styles: string[] = []
      for (const cls of classList) {
        const mapped = HLJS_INLINE_COLORS[cls]
        if (mapped) {
          if (mapped.includes(":")) {
            styles.push(mapped)
          } else {
            styles.push(`color: ${mapped}`)
          }
        }
      }
      return styles.length ? `<span style="${styles.join("; ")};">` : "<span>"
    },
  )
}

/**
 * 基础主题颜色（所有平台共有字段）
 */
export interface BaseThemeColors {
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
  [key: string]: string
}

/**
 * 平台样式差异配置
 */
export interface StyleOverrides {
  imgBorderRadius: string
  blockquotePadding: string
  blockquoteBorderRadius: string
  preBorderRadius: string
  codeLangColor: string
  codeLangBorderRadius: string
  inlineCodeBorderRadius: string
  ulPaddingLeft: string
  tableBorderRadius: string
  thPadding: string
  tdPadding: string
  h1BorderStyle: (colors: BaseThemeColors) => string
  h2BorderStyle: (colors: BaseThemeColors) => string
  langLabelStyle: (colors: BaseThemeColors, lang: string) => string
}

/**
 * 微信公众号样式覆盖
 */
export const WECHAT_STYLE_OVERRIDES: StyleOverrides = {
  imgBorderRadius: "4px",
  blockquotePadding: "8px 14px",
  blockquoteBorderRadius: "",
  preBorderRadius: "4px",
  codeLangColor: "#333",
  codeLangBorderRadius: "0 0 4px 4px",
  inlineCodeBorderRadius: "3px",
  ulPaddingLeft: "18px",
  tableBorderRadius: "",
  thPadding: "8px 12px",
  tdPadding: "8px 12px",
  h1BorderStyle: (colors) => `border-bottom: 1px solid ${colors.hrColor}; padding-bottom: 6px;`,
  h2BorderStyle: (colors) => `border-bottom: 1px solid ${colors.hrColor}; padding-bottom: 6px;`,
  langLabelStyle: (colors, lang) =>
    `<div style="font-size: 12px; color: #999; padding: 8px 16px 4px; text-align: right; background-color: ${colors.codeBgColor}; border-radius: 4px 4px 0 0;">${lang}</div>`,
}

/**
 * 哔哩哔哩专栏样式覆盖
 */
export const BILIBILI_STYLE_OVERRIDES: StyleOverrides = {
  imgBorderRadius: "8px",
  blockquotePadding: "10px 14px",
  blockquoteBorderRadius: "border-radius: 0 8px 8px 0;",
  preBorderRadius: "8px",
  codeLangColor: "", // 使用 colors.textColor，运行时动态填充
  codeLangBorderRadius: "0 0 8px 8px",
  inlineCodeBorderRadius: "4px",
  ulPaddingLeft: "20px",
  tableBorderRadius: "border-radius: 8px; overflow: hidden;",
  thPadding: "10px 14px",
  tdPadding: "10px 14px",
  h1BorderStyle: (colors) => `border-bottom: 2px solid ${colors.primary}; padding-bottom: 6px;`,
  h2BorderStyle: (colors) => `border-bottom: 1px solid ${colors.hrColor}; padding-bottom: 4px;`,
  langLabelStyle: (colors, lang) =>
    `<div style="font-size: 12px; color: ${colors.codeBlockHeaderColor}; background-color: ${colors.codeBlockHeaderBg}; padding: 6px 12px; border-bottom: 1px solid ${colors.hrColor}; text-transform: uppercase; letter-spacing: 0.5px; border-radius: 8px 8px 0 0;">${lang}</div>`,
}

/**
 * 对 HTML 字符串中的标签添加内联样式
 */
function applyInlineStyles(html: string, colors: BaseThemeColors, fontSize: number, lineHeight: number, overrides: StyleOverrides, codeWrap: CodeWrapMode = "scroll"): string {
  let result = html

  // h1 - h6
  for (let i = 1; i <= 6; i++) {
    const size = Math.round(fontSize * (1 + (7 - i) * 0.15))
    const marginTop = i <= 2 ? "24px" : "16px"
    const borderStyle = i === 1
      ? overrides.h1BorderStyle(colors)
      : i === 2
        ? overrides.h2BorderStyle(colors)
        : ""

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
    `<img src="$1" alt="$2" style="max-width: 100%; border-radius: ${overrides.imgBorderRadius}; margin: 8px 0;" />`,
  )

  // blockquote
  const blockquoteRadius = overrides.blockquoteBorderRadius ? ` ${overrides.blockquoteBorderRadius}` : ""
  result = result.replace(
    /<blockquote>/g,
    `<blockquote style="margin: 12px 0; padding: ${overrides.blockquotePadding}; border-left: 4px solid ${colors.quoteBorderColor}; background-color: ${colors.quoteBgColor}; color: ${colors.textColor}; font-size: ${fontSize}px; line-height: ${lineHeight};${blockquoteRadius}">`,
  )

  // pre (代码块) — 用 section 包裹以兼容微信手机端
  const preWhiteSpace = codeWrap === "wrap" ? "pre-wrap" : "pre"
  const preWordBreak = codeWrap === "wrap" ? "word-break: break-all; " : ""
  result = result.replace(
    /<pre>/g,
    `<section style="margin: 12px 0; max-width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; background-color: ${colors.codeBgColor}; border-radius: ${overrides.preBorderRadius};"><pre style="margin: 0; padding: 0; background: none; border-radius: 0; overflow-x: visible; line-height: 1.5;">`,
  )
  result = result.replace(
    /<\/pre>/g,
    `</pre></section>`,
  )

  // code with class (代码块内的 code)
  const codeLangColor = overrides.codeLangColor || colors.textColor
  const codeFontSize = Math.round(fontSize * 0.75)
  result = result.replace(
    /<code class="language-(\w+)">/g,
    (_, lang) => `<code class="language-${lang}" style="display: block; white-space: ${preWhiteSpace}; ${preWordBreak}overflow-x: auto; padding: 14px; font-family: 'Menlo', 'Monaco', 'Consolas', monospace; font-size: ${codeFontSize}px; color: ${codeLangColor}; background: none; border-radius: ${overrides.codeLangBorderRadius}; max-width: 100%; box-sizing: border-box;">`,
  )

  // code (行内代码，不含 class 的)
  result = result.replace(
    /<code>(?!.*class="language-)/g,
    `<code style="background-color: ${colors.inlineCodeBgColor}; color: ${colors.inlineCodeColor}; padding: 2px 6px; border-radius: ${overrides.inlineCodeBorderRadius}; font-family: 'Menlo', 'Monaco', 'Consolas', monospace; font-size: ${Math.round(fontSize * 0.9)}px;">`,
  )

  // hr
  result = result.replace(
    /<hr\s*\/?>/g,
    `<hr style="border: none; border-top: 1px solid ${colors.hrColor}; margin: 18px 0;" />`,
  )

  // ul
  result = result.replace(
    /<ul>/g,
    `<ul style="padding-left: ${overrides.ulPaddingLeft}; margin: 8px 0; list-style-type: disc;">`,
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
  const tableExtra = overrides.tableBorderRadius ? ` ${overrides.tableBorderRadius}` : ""
  result = result.replace(
    /<table>/g,
    `<table style="width: 100%; border-collapse: collapse; margin: 12px 0; font-size: ${fontSize}px;${tableExtra}">`,
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
    `<th style="padding: ${overrides.thPadding}; background-color: ${colors.tableHeaderBg}; border: 1px solid ${colors.tableBorderColor}; font-size: ${fontSize}px; font-weight: bold; color: ${colors.headingColor}; text-align: left;">`,
  )

  // td
  result = result.replace(
    /<td>/g,
    `<td style="padding: ${overrides.tdPadding}; border: 1px solid ${colors.tableBorderColor}; font-size: ${fontSize}px; color: ${colors.textColor};">`,
  )

  return result
}

/**
 * 将 Markdown 转换为目标平台格式
 */
export async function convertMarkdown(
  markdown: string,
  options: {
    fontSize: number
    lineHeight: number
    codeHighlight: boolean
    codeWrap?: CodeWrapMode
  },
  colors: BaseThemeColors,
  overrides: StyleOverrides,
): Promise<string> {
  const {
    fontSize,
    lineHeight,
    codeHighlight,
    codeWrap = "scroll",
  } = options

  marked.use({
    breaks: true,
    gfm: true,
    renderer: {
      code({
        text,
        lang,
      }: { text: string, lang?: string }) {
        const langAttr = lang ? ` class="language-${lang}"` : ""
        const langLabel = lang ? overrides.langLabelStyle(colors, lang) : ""
        let highlighted: string
        if (codeHighlight && lang) {
          try {
            highlighted = hljs.getLanguage(lang)
              ? convertHljsToInlineStyles(hljs.highlight(text, { language: lang }).value)
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
  const styledHtml = applyInlineStyles(html, colors, fontSize, lineHeight, overrides, codeWrap)
  const normalizedHtml = normalizeWidths(styledHtml).html

  return `<section style="padding: 14px; max-width: 100%; box-sizing: border-box; word-wrap: break-word;">${normalizedHtml}</section>`
}

/**
 * 构建主题列表（供 UI 选择器使用）
 */
export function buildThemeList<T extends string>(
  themes: Record<T, { label: string, color: string }>,
): { value: T, label: string, color: string }[] {
  return (Object.entries(themes) as [T, { label: string, color: string }][]).map(
    ([value, meta]) => ({
      value,
      label: meta.label,
      color: meta.color,
    }),
  )
}
