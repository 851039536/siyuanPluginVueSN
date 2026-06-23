/**
 * 技能学习 - Markdown 批量导入解析器
 *
 * 支持格式（每张卡片）：
 * ## 标题
 * 答案内容
 * - 错误选项1
 * - 错误选项2
 * - 错误选项3
 *
 * ```language
 * 代码片段
 * ```
 */
/** 解析结果条目 */
export interface ParsedCard {
  title: string
  answer: string
  distractors: string[]
  codeSnippet?: string
}

/**
 * 从 Markdown 文本解析多张卡片
 */
export function parseMarkdownCards(input: string): ParsedCard[] {
  const cards: ParsedCard[] = []

  // 按 ## 标题分割（要求标题必须是 ## 开头）
  const sections = input.split(/(?=^## )/m).filter(Boolean)

  for (const section of sections) {
    const lines = section.trim().split("\n")
    if (lines.length < 2) continue

    // 标题行
    const titleLine = lines[0]
    const title = titleLine.replace(/^##\s+/, "").trim()
    if (!title) continue

    // 剩余内容
    const rest = lines.slice(1).join("\n").trim()
    if (!rest) {
      cards.push({ title, answer: "", distractors: [] })
      continue
    }

    // 分离代码块和文本
    const codeMatch = rest.match(/```(\w*)\s*\n([\s\S]*?)```/)
    const textPart = codeMatch
      ? rest.slice(0, codeMatch.index).trim() + "\n" + rest.slice(codeMatch.index! + codeMatch[0].length).trim()
      : rest
    const codeSnippet = codeMatch ? codeMatch[2].trim() : undefined

    // 解析文本部分：提取答案和干扰项
    const textLines = textPart.split("\n").filter((l) => l.trim())
    const answer: string[] = []
    const distractors: string[] = []

    let inDistractors = false
    for (const line of textLines) {
      const trimmed = line.trim()
      if (/^[-*]\s+/.test(trimmed)) {
        inDistractors = true
        distractors.push(trimmed.replace(/^[-*]\s+/, ""))
      } else if (!inDistractors) {
        answer.push(trimmed)
      }
    }

    cards.push({
      title,
      answer: answer.join("\n").trim(),
      distractors: distractors.filter(Boolean),
      codeSnippet,
    })
  }

  return cards
}
