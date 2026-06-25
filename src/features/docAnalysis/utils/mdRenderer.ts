/**
 * Markdown 渲染器
 * 使用 marked + highlight.js 将 Markdown 转为带 hljs class 的 HTML
 * 不依赖 formatAssistant 模块，使用独立的 Renderer 实例避免全局冲突
 */
import hljs from "highlight.js"
import {
  marked,
  Renderer,
} from "marked"
import { escapeHtml } from "@/utils/stringUtils"

// ============================================================
// hljs class → inline style 颜色映射
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
 * 复制自 formatAssistant/utils/mdToShared.ts，保持独立避免跨模块依赖
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
 * 创建自定义 marked Renderer（带 highlight.js 代码高亮）
 */
function createRenderer(): Renderer {
  const renderer = new Renderer()

  renderer.code = function ({ text, lang }: { text: string, lang?: string }) {
    const langAttr = lang ? ` class="language-${lang}"` : ""
    let highlighted: string
    if (lang) {
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
    return `<pre><code${langAttr}>${highlighted}</code></pre>`
  }

  return renderer
}

/** 缓存的 Renderer 实例 */
let cachedRenderer: Renderer | null = null

/**
 * 解析 Markdown 为带内联样式 hljs 的 HTML
 * 使用独立的 Renderer 实例，不调用 marked.use()，避免全局冲突
 */
export function parseMarkdown(mdText: string): string {
  if (!cachedRenderer) {
    cachedRenderer = createRenderer()
  }

  marked.setOptions({
    breaks: true,
    gfm: true,
  })

  return marked.parse(mdText, { renderer: cachedRenderer }) as string
}
