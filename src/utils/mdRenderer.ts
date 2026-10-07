/**
 * 统一 Markdown 渲染工具 — 项目唯一 marked + highlight.js 渲染入口
 * 各功能模块通过此模块调用，避免重复实现 Renderer 和代码高亮逻辑
 *
 * 安全：本模块是 `v-html` 的唯一数据来源，渲染结果默认经 DOMPurify 消毒（见 sanitizeHtml）。
 * 渲染内容包含 AI 生成文本与外部日志（git stderr 等）时，marked 会原样透传其中的原始 HTML，
 * 不消毒即等于在该渲染上下文中执行任意脚本。
 */
import DOMPurify, { type Config } from "dompurify"
import hljs from "highlight.js"
import {
  Marked,
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

/**
 * 高亮单段代码为内层 HTML（不含 <pre>/<code> 包裹）
 * - 语言未注册或 hljs.highlight 抛异常时回退为转义纯文本
 * - inlineStyles=true 时将 hljs class 转为内联样式（微信等平台兼容）
 * 供 mdRenderer 与 formatAssistant 共用，避免高亮逻辑重复
 */
export function highlightCode(
  text: string,
  lang: string | undefined,
  inlineStyles = false,
): string {
  // 先确认语言已注册再高亮：未注册语言 hljs.highlight 会抛异常，
  // 提前判断可避免无谓的 try/catch 命中，并直接回退为转义文本
  if (lang && hljs.getLanguage(lang)) {
    try {
      const value = hljs.highlight(text, { language: lang }).value
      return inlineStyles ? convertHljsToInlineStyles(value) : value
    } catch {
      return escapeHtml(text)
    }
  }
  return escapeHtml(text)
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
  /**
   * 关闭输出消毒（默认 false = 消毒开启）。
   * 只有在「待渲染内容完全可信」且确实需要保留原始 HTML 时才应显式关闭；
   * 渲染 AI 生成文本或外部日志的调用方务必保持默认开启。
   */
  skipSanitize?: boolean
}

// ============================================================
// HTML 消毒（v-html 安全边界）
// ============================================================

/**
 * 允许保留的标签与属性（比 DOMPurify 默认更严：剔除表单/媒体/嵌入类元素）。
 * 保留 `class` 供 highlight.js 与既有排版样式使用；`target`/`rel` 供外链。
 * 注意：DOMPurify `Config` 的数组字段要求可变数组，故此处不能用 `as const`。
 */
const SANITIZE_CONFIG: Config = {
  ALLOWED_TAGS: [
    "a", "b", "blockquote", "br", "code", "del", "em", "h1", "h2", "h3", "h4", "h5", "h6",
    "hr", "i", "img", "input", "li", "ol", "p", "pre", "s", "span", "strong", "sub", "sup",
    "table", "tbody", "td", "th", "thead", "tr", "ul",
  ],
  ALLOWED_ATTR: ["class", "href", "src", "alt", "title", "target", "rel", "align", "type", "checked", "disabled", "colspan", "rowspan"],
  // 阻断 data:/javascript: 等危险协议（img.src 只允许图片类协议）
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|ftp):|[^&:/?#]*(?:[/?#]|$))/i,
}

/**
 * 消毒 marked 产出的 HTML。
 *
 * 为什么必须有：marked 会原样透传 Markdown 中的原始 HTML 块与内联 HTML，
 * 而 `parseMarkdown` 的消费方普遍直接 `v-html`。渲染内容是 AI 生成文本
 * （模型回复，或经 prompt 注入的 git 日志）时，等于给未可信文本一个脚本执行入口。
 *
 * 无 DOM 环境（如 Node 单测 / SSR）时 DOMPurify 不可用，此时退化为「剥离明显危险片段」
 * 的保守处理，而不是直接放行原文。
 */
export function sanitizeHtml(html: string): string {
  if (!html) return ""

  // DOMPurify 在无 window 的环境下 isSupported === false，此时 purify 会原样返回输入
  if (typeof window === "undefined" || !DOMPurify.isSupported) {
    return stripDangerousHtml(html)
  }
  return String(DOMPurify.sanitize(html, SANITIZE_CONFIG))
}

/**
 * 无 DOM 环境的兜底剥离：移除 script/style/iframe 等元素与 on* 事件属性、危险协议。
 * 非完整消毒实现，仅用于无 DOMPurify 的降级路径。
 */
function stripDangerousHtml(html: string): string {
  return html
    .replace(/<(script|style|iframe|object|embed|form|link|meta)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(script|style|iframe|object|embed|form|link|meta)\b[^>]*\/?>/gi, "")
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(?:"|')?\s*(?:javascript|data|vbscript):[^"'>\s]*(?:"|')?/gi, "")
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
    return `<pre><code${langAttr}>${highlightCode(text, lang, inlineStyles)}</code></pre>`
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
    skipSanitize = false,
  } = resolved

  if (!mdText) return ""

  const renderer = getRenderer(codeHighlight, inlineStyles)

  // 使用隔离的 Marked 实例，不污染全局 marked 单例（避免与
  // 其他模块的 marked.use() 相互干扰，也不被其他模块污染）
  const md = new Marked({
    breaks,
    gfm,
    ...(renderer ? { renderer } : {}),
  })

  // 自定义扩展必须通过 use() 注册；marked v17 的 per-call
  // options.extensions 只接受编译后的内部形态，数组会被静默忽略
  if (extensions) {
    md.use({ extensions })
  }

  const html = md.parse(mdText) as string
  // 消毒后再返回：本模块是 v-html 的唯一来源，出口即安全边界
  return skipSanitize ? html : sanitizeHtml(html)
}
