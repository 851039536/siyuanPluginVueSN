/**
 * AI 内容生成器共享工具函数
 */
import type { Tokens } from "marked"
import type { SkillItem } from "@/types/ai"
import { AI_TOOL_META } from "@/config/aiTools"
import { parseMarkdown } from "@/utils/mdRenderer"

// ============ 系统提示词构建 ============

/**
 * 提取公共的 skill system prompt 构建逻辑（有技能时前缀技能内容，消除多处重复）
 */
export function buildSkillSystemPrompt(
  skill: SkillItem | null,
  fallback: string,
): string {
  if (skill) {
    return `${skill.content}\n\n${fallback}`
  }
  return fallback
}

// ============ 文本/UI 工具 ============

/**
 * 统一的 Markdown 渲染函数
 *
 * 安全说明：marked 默认透传原始 HTML，而本函数输出会被 v-html 渲染
 * （MainContentArea / SkillPreviewModal），AI 生成内容或技能文件可能携带
 * 恶意 HTML（<script> / <img onerror> 等）。此处通过 marked 扩展将
 * html 块/标签渲染为转义文本，从源头杜绝 XSS 注入。
 */
export function renderMarkdown(content: string, stripHeadingBold = true): string {
  if (!content) return ""

  try {
    let processedContent = content
    if (stripHeadingBold) {
      processedContent = processedContent.replace(
        /^(#{1,6})\s+\*\*(.+?)\*\*\s*$/gm,
        "$1 $2",
      )
    }
    return parseMarkdown(processedContent, {
      extensions: [{
        name: "html",
        renderer(token: Tokens.Generic) {
          // 转义原始 HTML：保留可见文本，丢弃标签语义
          return escapeHtmlText((token as { text?: string }).text ?? "")
        },
      }],
    })
  } catch (error) {
    console.error("Markdown渲染失败:", error)
    // 兜底输出也需转义，防止原始内容注入
    return `<pre>${escapeHtmlText(content)}</pre>`
  }
}

/** 简单 HTML 转义（本地实现，避免与共享工具循环依赖） */
function escapeHtmlText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
}

export function truncateTitle(title: string, maxLen = 12): string {
  // 按码点截断，避免 emoji 等代理对字符被截半产生乱码
  const chars = [...title]
  if (chars.length <= maxLen) return title
  return `${chars.slice(0, maxLen).join("")}...`
}

// ============ 技能来源展示 ============

export function getSourceDotColors(skill: SkillItem | null): string[] {
  if (!skill?.sources || skill.sources.length === 0) return []
  return skill.sources.map((s) => {
    const tool = AI_TOOL_META.find((t) => t.id === s.tool)
    return tool?.color || "#999"
  })
}

// ============ 内容处理 ============

/**
 * 移除Markdown内容中的Frontmatter（YAML元数据）
 */
export function removeFrontmatter(content: string): string {
  const frontmatterRegex = /^---\s*\n[\s\S]*?\n---\s*\n/
  return content.replace(frontmatterRegex, "").trim()
}

// ============ 代码围栏识别（convertToSiyuanMarkdown / splitMarkdownBlocks 共用）============

/** 开栏匹配：行首（可缩进）3 个及以上反引号，捕获围栏本体 */
const FENCE_RE = /^(`{3,})/

/** 判断是否为与开栏匹配的闭栏：裸围栏且反引号数不少于开栏 */
function isClosingFence(line: string, openFence: string): boolean {
  const trimmed = line.trim()
  return /^`{3,}$/.test(trimmed) && trimmed.length >= openFence.length
}

/**
 * 转换 Markdown 为思源兼容格式
 * 代码块内容原样保留，仅对块外文本确保各语法块前后有空行、清理多余连续空行
 */
export function convertToSiyuanMarkdown(content: string): string {
  const lines = content.split("\n")
  const segments: Array<{ code: boolean, lines: string[] }> = []
  let current: { code: boolean, lines: string[] } = { code: false, lines: [] }
  let openFence: string | null = null

  // 按围栏切分为文本段/代码段，代码段（含围栏行）不做任何改写
  for (const line of lines) {
    if (openFence) {
      current.lines.push(line)
      if (isClosingFence(line, openFence)) {
        openFence = null
        segments.push(current)
        current = { code: false, lines: [] }
      }
      continue
    }
    const fence = line.trimStart().match(FENCE_RE)
    if (fence) {
      if (current.lines.length) segments.push(current)
      current = { code: true, lines: [line] }
      openFence = fence[1]
      continue
    }
    current.lines.push(line)
  }
  if (current.lines.length) segments.push(current)

  // 段间以空行衔接，天然保证代码块前后有空行
  return segments
    .map((seg) => (seg.code ? seg.lines.join("\n") : normalizeTextSegment(seg.lines.join("\n"))))
    .filter((s) => s.trim() !== "")
    .join("\n\n")
}

/** 对代码块外的文本段应用思源空行规则（按行扫描，行间需要分隔时插入空行） */
function normalizeTextSegment(text: string): string {
  const srcLines = text.split("\n")
  const out: string[] = []
  const isHeading = (s: string): boolean => /^#{1,6}\s/.test(s)
  const isListItem = (s: string): boolean => /^([-*+]|\d+\.)\s/.test(s)

  for (const line of srcLines) {
    const prev = out.length > 0 ? out[out.length - 1] : null
    if (prev !== null && prev.trim() !== "") {
      // 标题的前后、列表的前面需要空行分隔
      const needBlank
        = isHeading(line)
          || isHeading(prev)
          || (isListItem(line) && !isListItem(prev))
      if (needBlank) out.push("")
    }
    out.push(line)
  }

  // 清理多余的连续空行（最多保留两个换行符）
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim()
}

/**
 * 根据内容类型处理内容
 * - 文档模式：移除 frontmatter 和标题，转换为思源兼容格式
 * - 块模式：仅移除 frontmatter，转换为思源兼容格式
 */
export function processContentByType(content: string, isBlock: boolean): string {
  const withoutFrontmatter = removeFrontmatter(content)
  if (isBlock) {
    return convertToSiyuanMarkdown(withoutFrontmatter)
  }
  // 文档模式：仅当首行确为 Markdown 标题时移除（文档标题由思源文档名承载）
  const lines = withoutFrontmatter.split("\n")
  const withoutHeading = /^#{1,6}\s/.test(lines[0] ?? "")
    ? lines.slice(1).join("\n").trim()
    : withoutFrontmatter
  return convertToSiyuanMarkdown(withoutHeading)
}

/**
 * 将Markdown内容按顶层块分割
 * 思源笔记中，每个Markdown块（段落、标题、列表、代码块等）都是独立的
 * 需要按双换行符分割，同时保留代码块等跨行结构不被错误分割
 */
export function splitMarkdownBlocks(content: string): string[] {
  if (!content.trim()) return []

  const blocks: string[] = []
  let currentBlock = ""
  let openFence: string | null = null

  const lines = content.split("\n")

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // 跟踪代码块围栏状态（与 convertToSiyuanMarkdown 同一套判定）
    if (openFence) {
      if (isClosingFence(line, openFence)) openFence = null
    } else {
      const fence = line.trimStart().match(FENCE_RE)
      if (fence) openFence = fence[1]
    }

    if (!openFence && line.trim() === "" && currentBlock.trim()) {
      blocks.push(currentBlock.trim())
      currentBlock = ""
    } else {
      currentBlock += (currentBlock ? "\n" : "") + line
    }
  }

  if (currentBlock.trim()) {
    blocks.push(currentBlock.trim())
  }

  return blocks
}
