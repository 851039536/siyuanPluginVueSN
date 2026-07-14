/**
 * AI 内容生成器共享工具函数
 */
import type { SkillItem } from "@/types/ai"
import { parseMarkdown } from "@/utils/mdRenderer"
import * as api from "@/api"

// ============ 本地工具元数据（替代跨功能导入 skillsViewer）============

/** AI 工具元数据（仅 id/name/color，用于技能来源展示） */
interface ToolMeta {
  id: string;
  name: string;
  color: string;
}

const TOOL_META: ToolMeta[] = [
  { id: "claude", name: "Claude", color: "#D97757" },
  { id: "codebuddy", name: "CodeBuddy", color: "#4A90D9" },
  { id: "qoder", name: "Qoder", color: "#9B59B6" },
  { id: "trae", name: "Trae", color: "#27AE60" },
  { id: "opencode", name: "Opencode", color: "#00ACC1" },
]

// ============ 文本/UI 工具 ============

/**
 * 统一的 Markdown 渲染函数
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
    return parseMarkdown(processedContent)
  } catch (error) {
    console.error("Markdown渲染失败:", error)
    return `<pre>${content}</pre>`
  }
}

export function truncateText(text: string, maxLength = 50): string {
  if (text.length <= maxLength) return text
  return `${text.substring(0, maxLength)}...`
}

export function getPromptPreview(text: string): string {
  return truncateText(text, 50)
}

export function truncateTitle(title: string, maxLen = 12): string {
  return truncateText(title, maxLen)
}

// ============ 技能来源展示 ============

export function getSourceDotColors(skill: SkillItem): string[] {
  if (!skill.sources || skill.sources.length === 0) return []
  return skill.sources.map((s) => {
    const tool = TOOL_META.find((t) => t.id === s.tool)
    return tool?.color || "#999"
  })
}

export function getSourceHintText(skill: SkillItem): string {
  if (!skill.sources || skill.sources.length === 0) return ""
  const toolNames = skill.sources.map((s) => {
    const tool = TOOL_META.find((t) => t.id === s.tool)
    return tool ? tool.name : s.tool
  })
  return toolNames.join("、")
}

// ============ 内容处理 ============

/**
 * 移除Markdown内容中的Frontmatter（YAML元数据）
 */
export function removeFrontmatter(content: string): string {
  const frontmatterRegex = /^---\s*\n[\s\S]*?\n---\s*\n/
  return content.replace(frontmatterRegex, "").trim()
}

/**
 * 转换 Markdown 为思源兼容格式
 * 确保各语法块前后有空行，清理多余连续空行
 */
export function convertToSiyuanMarkdown(content: string): string {
  let converted = content

  // 1. 确保标题前后有空行
  converted = converted.replace(/([^\n])\n(#{1,6}\s)/g, "$1\n\n$2")
  converted = converted.replace(/(#{1,6}\s[^\n]+)\n([^\n#])/g, "$1\n\n$2")

  // 2. 确保代码块前后有空行
  converted = converted.replace(/([^\n])\n```/g, "$1\n\n```")
  converted = converted.replace(/```\n([^\n])/g, "```\n\n$1")

  // 3. 确保列表前后有空行
  converted = converted.replace(/([^\n])\n([-*+]\s)/g, "$1\n\n$2")
  converted = converted.replace(/([^\n])\n(\d+\.\s)/g, "$1\n\n$2")

  // 4. 清理多余的连续空行（最多保留两个换行符）
  converted = converted.replace(/\n{3,}/g, "\n\n")

  return converted
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
  // 文档模式：额外移除第一行标题
  const lines = withoutFrontmatter.split("\n")
  const withoutHeading = lines.length <= 1 ? "" : lines.slice(1).join("\n").trim()
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
  let inCodeBlock = false

  const lines = content.split("\n")

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // 跟踪代码块状态
    if (line.trimStart().startsWith("```")) {
      inCodeBlock = !inCodeBlock
    }

    if (!inCodeBlock && line.trim() === "" && currentBlock.trim()) {
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

// ============ 审核问题位置匹配 ============

export function extractIssueLocations(
  issues: Array<{ description: string; severity: string }>,
  content: string,
): Array<{ issueIndex: number; excerpt: string }> {
  const locations: Array<{ issueIndex: number; excerpt: string }> = []

  issues.forEach((issue, idx) => {
    const sentences = issue.description.split(/[。；]/).filter((s) => s.length > 5)
    for (const sentence of sentences) {
      const pos = content.indexOf(sentence)
      if (pos >= 0) {
        const excerpt = content.slice(
          Math.max(0, pos - 10),
          pos + sentence.length + 10,
        )
        locations.push({ issueIndex: idx, excerpt })
        break
      }
    }
  })

  return locations
}

// ============ DOM 操作 ============

/**
 * 获取当前光标所在的块ID
 */
export function getCurrentBlockId(): string | null {
  // 方法1: 获取当前选中的块
  const selectedBlock = document.querySelector(".protyle-wysiwyg--select")
  if (selectedBlock) {
    return selectedBlock.getAttribute("data-node-id")
  }

  // 方法2: 获取光标所在的块（聚焦的块）
  const focusedBlock = document.querySelector(
    ".protyle-wysiwyg [data-node-id].protyle-wysiwyg--focus",
  )
  if (focusedBlock) {
    return focusedBlock.getAttribute("data-node-id")
  }

  // 方法3: 通过 window.getSelection() 精确获取光标位置
  const selection = window.getSelection()
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0)
    let node: Node | null = range.startContainer

    while (node) {
      if (node instanceof Element) {
        const nodeId = node.getAttribute("data-node-id")
        const dataType = node.getAttribute("data-type")
        if (nodeId && dataType) {
          return nodeId
        }
      }
      node = node.parentNode
    }
  }

  return null
}

/**
 * 通过块ID获取其所属的文档ID
 */
export async function getDocIdByBlockId(blockId: string): Promise<string | null> {
  try {
    const block = await api.getBlockByID(blockId)
    return block?.root_id || null
  } catch (error) {
    console.error("获取文档ID失败:", error)
    return null
  }
}
