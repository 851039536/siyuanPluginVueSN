/**
 * 统一 Markdown 渲染工具 — 项目唯一 marked + highlight.js 渲染入口
 * 各功能模块通过此模块调用，避免重复实现 Renderer 和代码高亮逻辑
 */
import hljs from "highlight.js"
import {
  marked,
  type TokenizerAndRendererExtension,
  Renderer,
} from "marked"
import { escapeHtml } from "@/utils/stringUtils"

// ============================================================
// hljs class → inline style 颜色映射（微信等不支持 class 的平台需要）
// ============================================================
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
 * 将 hljs 输出的 class-based spans 转换为 inline style spans（微信兼容）
 */
export function convertHljsToInlineStyles(highlighted: string): string {
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

// ============================================================
// 渲染选项
// ============================================================
export interface ParseMarkdownOptions {
  /** 启用 highlight.js 代码高亮（默认 false） */
  codeHighlight?: boolean
  /** 代码高亮时是否转为内联样式（默认 false，桌面预览保留 class） */
  inlineStyles?: boolean
  /** GFM 换行（默认 true） */
  breaks?: boolean
  /** GFM 表格/任务列表等（默认 true） */
  gfm?: boolean
  /** marked 自定义扩展（透传给 marked.parse()） */
  extensions?: TokenizerAndRendererExtension[]
}

// ============================================================
// 命名预设
// ============================================================

/** 常用渲染预设 */
export type MarkdownPreset = "basic" | "highlight" | "wechat"

/** 预设 → 选项映射 */
const PRESETS: Record<MarkdownPreset, ParseMarkdownOptions> = {
  basic: {},
  highlight: { codeHighlight: true },
  wechat: { codeHighlight: true, inlineStyles: true },
}

// ============================================================
// 渲染器缓存 — 按 key 缓存 Renderer 实例
// ============================================================
type RendererKey = "highlight" | "highlight-inline"

let cachedRenderers: Partial<Record<RendererKey, Renderer>> = {}

function createCodeRenderer(inlineStyles = false): Renderer {
  const renderer = new Renderer()

  renderer.code = function ({ text, lang }: { text: string, lang?: string }) {
    const langAttr = lang ? ` class="language-${escapeHtml(lang)}"` : ""
    let highlighted: string
    if (lang) {
      try {
        const value = hljs.highlight(text, { language: lang }).value
        highlighted = hljs.getLanguage(lang)
          ? (inlineStyles ? convertHljsToInlineStyles(value) : value)
          : escapeHtml(text)
      } catch {
        highlighted = escapeHtml(text)
      }
    } else {
      highlighted = escapeHtml(text)
    }
    return `<pre><code${langAttr}>${highlighted}</code></pre>`
  }

  return renderer
}

function getRenderer(codeHighlight: boolean, inlineStyles: boolean): Renderer | null {
  if (!codeHighlight) return null

  const key: RendererKey = inlineStyles ? "highlight-inline" : "highlight"
  if (!cachedRenderers[key]) {
    cachedRenderers[key] = createCodeRenderer(inlineStyles)
  }
  return cachedRenderers[key]
}

/**
 * 清除缓存的 Renderer 实例（HMR / 测试 / onunload 时调用）
 */
export function clearRendererCache(): void {
  cachedRenderers = {}
}

// ============================================================
// 核心渲染函数
// ============================================================

/**
 * 解析 Markdown 为 HTML
 * @param mdText Markdown 原始文本
 * @param options 渲染选项或预设名称
 * @returns HTML 字符串
 */
export function parseMarkdown(mdText: string, options?: ParseMarkdownOptions | MarkdownPreset): string {
  const resolved: ParseMarkdownOptions = typeof options === "string"
    ? (PRESETS[options] ?? {})
    : (options ?? {})

  const {
    codeHighlight = false,
    inlineStyles = false,
    breaks = true,
    gfm = true,
    extensions,
  } = resolved

  if (!mdText) return ""

  const renderer = getRenderer(codeHighlight, inlineStyles)
  return marked.parse(mdText, {
    breaks,
    gfm,
    ...(extensions ? { extensions } : {}),
    ...(renderer ? { renderer } : {}),
  }) as string
}
