/**
 * 全局关系列表纯工具函数
 *
 * 与 Vue 响应式无关，可被 composable 与单元测试直接导入。
 */

/**
 * 解析 refs.content 字段：可能是锚文本明文，也可能是 JSON 字符串/数组/对象
 * （思源在不同引用形态下写入的 content 结构不一致，需逐形态归一为可读文本）
 */
export function parseAnchorText(raw: unknown): string {
  if (raw === null || raw === undefined) return ""
  if (typeof raw !== "string") {
    return String(raw)
  }
  const trimmed = raw.trim()
  if (!trimmed) return ""
  try {
    const parsed = JSON.parse(trimmed)
    if (typeof parsed === "string") return parsed
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => typeof item === "string").join(" ")
    }
    if (parsed && typeof parsed === "object") {
      const text = (parsed as any).text
        ?? (parsed as any).content
        ?? (parsed as any).name
        ?? (parsed as any).anchor
      if (typeof text === "string" && text) return text
      return JSON.stringify(parsed)
    }
    return trimmed
  } catch {
    // 非 JSON，按明文返回
    return trimmed
  }
}
