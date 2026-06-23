import type { SkillItem } from "@/types/ai"
/**
 * AI 内容生成器共享工具函数
 */
import { marked } from "marked"
import { AI_TOOLS } from "@/features/skillsViewer/modules/SkillsViewerManager"

// 配置 marked 选项（只需配置一次）
marked.setOptions({
  breaks: true,
  gfm: true,
})

/** 截断文本用于预览显示 */
export function truncateText(text: string, maxLength = 50): string {
  if (text.length <= maxLength) return text
  return `${text.substring(0, maxLength)}...`
}

/** 获取提示词预览文本 */
export function getPromptPreview(text: string): string {
  return truncateText(text, 50)
}

/**
 * 统一的 Markdown 渲染函数
 * @param content Markdown 内容
 * @param stripHeadingBold 是否移除标题中的粗体标记（默认 true）
 */
export function renderMarkdown(content: string, stripHeadingBold = true): string {
  if (!content) return ""

  try {
    let processedContent = content

    // 移除标题中的粗体标记
    if (stripHeadingBold) {
      processedContent = processedContent.replace(
        /^(#{1,6})\s+\*\*(.+?)\*\*\s*$/gm,
        "$1 $2",
      )
    }

    return marked.parse(processedContent) as string
  } catch (error) {
    console.error("Markdown渲染失败:", error)
    return `<pre>${content}</pre>`
  }
}

/** 截断标题用于UI显示 */
export function truncateTitle(title: string, maxLen = 12): string {
  return truncateText(title, maxLen)
}

/** 获取技能来源的颜色数组（用于圆点图标显示） */
export function getSourceDotColors(skill: SkillItem): string[] {
  if (!skill.sources || skill.sources.length === 0) return []
  return skill.sources.map((s) => {
    const tool = AI_TOOLS.find((t) => t.id === s.tool)
    return tool?.color || "#999"
  })
}

/** 获取技能来源提示文字（纯文本） */
export function getSourceHintText(skill: SkillItem): string {
  if (!skill.sources || skill.sources.length === 0) return ""
  const toolNames = skill.sources.map((s) => {
    const tool = AI_TOOLS.find((t) => t.id === s.tool)
    return tool ? tool.name : s.tool
  })
  if (skill.sources.length === 1) {
    return toolNames[0]
  }
  return toolNames.join("、")
}

/**
 * 尝试将审核问题描述与生成内容中的位置进行匹配
 * 用于在内容中标注问题对应的位置
 */
export function extractIssueLocations(
  issues: Array<{ description: string, severity: string }>,
  content: string,
): Array<{ issueIndex: number, excerpt: string }> {
  const locations: Array<{ issueIndex: number, excerpt: string }> = []

  issues.forEach((issue, idx) => {
    const sentences = issue.description.split(/[。；]/).filter((s) => s.length > 5)
    for (const sentence of sentences) {
      const pos = content.indexOf(sentence)
      if (pos >= 0) {
        const excerpt = content.slice(
          Math.max(0, pos - 10),
          pos + sentence.length + 10,
        )
        locations.push({
          issueIndex: idx,
          excerpt,
        })
        break
      }
    }
  })

  return locations
}
