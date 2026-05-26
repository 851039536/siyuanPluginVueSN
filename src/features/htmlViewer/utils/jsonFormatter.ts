/**
 * JSON 格式化工具
 *
 * 将 JSON 字符串转换为带语法高亮的 HTML（内联样式，兼容微信公众号等平台）。
 * 参考 GitHub 浅色主题配色方案。
 */

import { escapeHtml, escapeHtmlFull } from "@/utils/stringUtils"

// GitHub 浅色主题配色（公众号兼容，白底浅灰代码区）
const LIGHT_COLORS = {
  background: "#f6f8fa",
  key: "#d73a49",
  string: "#032f62",
  number: "#005cc5",
  boolean: "#005cc5",
  null: "#005cc5",
  punctuation: "#24292e",
  property: "#6f42c1",
  text: "#24292e",
} as const

export interface JsonFormatterOptions {
  indent?: number
  backgroundColor?: string
  fontSize?: number
}

export interface JsonFormatterResult {
  html: string
  error?: string
}

function wrapToken(text: string, color: string, bold = false): string {
  const fw = bold ? "font-weight: bold;" : ""
  return `<span style="color: ${color};${fw}">${escapeHtmlFull(text)}</span>`
}

/**
 * 对格式化后的 JSON 字符串做语法高亮（内联样式）
 */
function highlightJson(formatted: string): string {
  const result: string[] = []
  let i = 0
  const len = formatted.length

  while (i < len) {
    const ch = formatted[i]

    // 字符串（双引号包裹）
    if (ch === '"') {
      let strContent = ""
      let j = i + 1
      let escaped = false
      while (j < len) {
        if (escaped) {
          strContent += formatted[j]
          escaped = false
          j++
          continue
        }
        if (formatted[j] === "\\") {
          strContent += "\\"
          escaped = true
          j++
          continue
        }
        if (formatted[j] === '"') {
          break
        }
        strContent += formatted[j]
        j++
      }
      if (j < len) {
        // 判断是键名还是字符串值
        // 键名后面是冒号（可能隔空白）
        let k = j + 1
        while (k < len && (formatted[k] === " " || formatted[k] === "\t")) {
          k++
        }
        if (k < len && formatted[k] === ":") {
          result.push(`<span style="color: ${LIGHT_COLORS.key};">"${escapeHtml(strContent)}"</span>`)
        } else {
          result.push(`<span style="color: ${LIGHT_COLORS.string};">"${escapeHtml(strContent)}"</span>`)
        }
        i = j + 1
        continue
      }
    }

    // 数字
    if ((ch >= "0" && ch <= "9") || (ch === "-" && i + 1 < len && formatted[i + 1] >= "0" && formatted[i + 1] <= "9")) {
      let numStr = ""
      if (ch === "-") {
        numStr += "-"
        i++
      }
      while (i < len && /[\d.e+\-]/i.test(formatted[i])) {
        numStr += formatted[i]
        i++
      }
      result.push(wrapToken(numStr, LIGHT_COLORS.number))
      continue
    }

    // true / false / null
    if (ch === "t" && formatted.slice(i, i + 4) === "true") {
      result.push(wrapToken("true", LIGHT_COLORS.boolean))
      i += 4
      continue
    }
    if (ch === "f" && formatted.slice(i, i + 5) === "false") {
      result.push(wrapToken("false", LIGHT_COLORS.boolean))
      i += 5
      continue
    }
    if (ch === "n" && formatted.slice(i, i + 4) === "null") {
      result.push(wrapToken("null", LIGHT_COLORS.null))
      i += 4
      continue
    }

    // 标点符号
    if ("{}[]:,".includes(ch)) {
      result.push(wrapToken(ch, LIGHT_COLORS.punctuation))
      i++
      continue
    }

    // 空白和换行
    result.push(escapeHtml(ch))
    i++
  }

  return result.join("")
}

/**
 * 将 JSON 字符串转换为格式化的 HTML（公众号兼容，内联样式）
 *
 * @param input - JSON 字符串
 * @param options - 格式化选项
 * @returns 格式化结果
 */
export function jsonToHtml(
  input: string,
  options: JsonFormatterOptions = {},
): JsonFormatterResult {
  const {
    indent = 2,
    backgroundColor = LIGHT_COLORS.background,
    fontSize = 13,
  } = options

  let formatted: string
  try {
    const parsed = JSON.parse(input)
    formatted = JSON.stringify(parsed, null, indent)
  } catch (e) {
    return {
      html: "",
      error: `JSON 解析失败: ${(e as Error).message}`,
    }
  }

  const highlighted = highlightJson(formatted)

  const html = [
    `<pre style="`,
    `background-color: ${backgroundColor};`,
    `padding: 16px;`,
    `border-radius: 6px;`,
    `overflow-x: auto;`,
    `overflow-y: auto;`,
    `max-height: 600px;`,
    `font-family: 'SF Mono', 'Menlo', 'Monaco', 'Consolas', 'Courier New', monospace;`,
    `font-size: ${fontSize}px;`,
    `line-height: 1.6;`,
    `color: ${LIGHT_COLORS.text};`,
    `margin: 0;`,
    `white-space: pre-wrap;`,
    `word-wrap: break-word;`,
    `border: 1px solid #e1e4e8;`,
    `">`,
    `<code style="background: none; padding: 0; font-size: inherit; color: inherit; font-family: inherit;">`,
    highlighted,
    `</code>`,
    `</pre>`,
  ].join("")

  return { html }
}

/**
 * 检测字符串是否为有效 JSON
 */
export function isJsonString(str: string): boolean {
  const trimmed = str.trim()
  if (!trimmed) return false
  if (
    !(
      (trimmed.startsWith("{") && trimmed.endsWith("}"))
      || (trimmed.startsWith("[") && trimmed.endsWith("]"))
    )
  ) {
    return false
  }
  try {
    JSON.parse(trimmed)
    return true
  } catch {
    return false
  }
}
