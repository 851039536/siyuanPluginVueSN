/**
 * JSON 格式化工具 - 纯函数
 * 提供 JSON 格式化、压缩、校验功能
 */

export interface JsonResult {
  success: boolean
  output: string
  error?: string
  errorLine?: number
}

/** 格式化 JSON 字符串 */
export function formatJson(input: string, indent = 2): JsonResult {
  if (!input.trim()) return { success: false, output: "", error: "empty" }
  try {
    const parsed = JSON.parse(input)
    return { success: true, output: JSON.stringify(parsed, null, indent) }
  } catch (e) {
    return { success: false, output: "", error: extractError(e) }
  }
}

/** 压缩 JSON 字符串（移除所有空白） */
export function minifyJson(input: string): JsonResult {
  if (!input.trim()) return { success: false, output: "", error: "empty" }
  try {
    const parsed = JSON.parse(input)
    return { success: true, output: JSON.stringify(parsed) }
  } catch (e) {
    return { success: false, output: "", error: extractError(e) }
  }
}

/** 校验 JSON 是否合法 */
export function validateJson(input: string): JsonResult {
  if (!input.trim()) return { success: false, output: "", error: "empty" }
  try {
    JSON.parse(input)
    return { success: true, output: "valid" }
  } catch (e) {
    return { success: false, output: "", error: extractError(e) }
  }
}

/** 从 SyntaxError 中提取可读错误信息 */
function extractError(e: unknown): string {
  if (e instanceof SyntaxError) {
    // 尝试提取位置信息（V8 格式: "... at position 123"）
    const posMatch = e.message.match(/position (\d+)/)
    if (posMatch) return `${e.message} (position: ${posMatch[1]})`
    return e.message
  }
  return String(e)
}
