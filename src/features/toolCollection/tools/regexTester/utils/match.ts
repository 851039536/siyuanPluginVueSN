/**
 * 正则测试器工具 - 纯函数
 * 安全执行正则匹配，防止无效正则导致崩溃
 */

export interface MatchResult {
  success: boolean
  matches: MatchItem[]
  error?: string
  total: number
}

export interface MatchItem {
  text: string
  index: number
  groups: (string | undefined)[]
}

/**
 * 安全执行正则匹配
 * @param pattern 正则表达式文本（不含定界符）
 * @param flags 标志字符串（g/i/m/s/u）
 * @param text 测试文本
 */
export function safeMatch(pattern: string, flags: string, text: string): MatchResult {
  if (!pattern) return { success: false, matches: [], error: "empty", total: 0 }

  let regex: RegExp
  try {
    // 确保有 g 标志以获取所有匹配
    const effectiveFlags = flags.includes("g") ? flags : `${flags}g`
    regex = new RegExp(pattern, effectiveFlags)
  } catch (e) {
    return {
      success: false,
      matches: [],
      error: e instanceof Error ? e.message : String(e),
      total: 0,
    }
  }

  const matches: MatchItem[] = []
  const maxMatches = 500 // 防止 ReDoS 或无限匹配
  let match: RegExpExecArray | null
  let count = 0

  try {
    while ((match = regex.exec(text)) !== null && count < maxMatches) {
      matches.push({
        text: match[0],
        index: match.index,
        groups: match.slice(1),
      })
      count++
      // 防止零宽匹配导致无限循环
      if (match[0].length === 0) regex.lastIndex++
    }
  } catch {
    return { success: false, matches: [], error: "Execution error", total: 0 }
  }

  return { success: true, matches, total: matches.length }
}
