/**
 * AI 内容生成器共享工具函数
 */
import { marked } from "marked"

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
