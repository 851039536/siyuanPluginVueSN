/**
 * DatePicker 格式化模板引擎：dateFormat 令牌渲染与反向解析（纯函数，无 Vue 依赖）
 * 令牌语义严格对齐 PrimeVue dateFormat 表
 */
import type { FormatLabels } from "./types"
import { DEFAULT_FORMAT_LABELS } from "./types"

/** Windows ticks 起点差：0001-01-01 至 1970-01-01 的毫秒数（`!` 令牌用） */
const WINDOWS_TICKS_OFFSET_MS = 62135596800000
/** 两位年份归入 2000 年代的上界 */
const TWO_DIGIT_YEAR_PIVOT = 70

/** 全部合法令牌（两字符令牌优先匹配） */
const FORMAT_TOKENS = new Set([
  "d", "dd", "o", "oo", "D", "DD",
  "m", "mm", "M", "MM", "y", "yy",
  "@", "!",
])

/** 可反向解析的数值令牌（其余令牌为名称/天序，手输解析不支持） */
const NUMERIC_PARSE_TOKENS: Record<string, string> = {
  d: "(\\d{1,2})",
  dd: "(\\d{2})",
  m: "(\\d{1,2})",
  mm: "(\\d{2})",
  y: "(\\d{2})",
  yy: "(\\d{4})",
  "@": "(\\d+)",
  "!": "(\\d+)",
}

/** 不支持反向解析的令牌（名称类 + 年内天序） */
const UNPARSEABLE_TOKENS = new Set(["o", "oo", "D", "DD", "M", "MM"])

const pad = (value: number, length = 2) => String(value).padStart(length, "0")

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** 年内第几天（1 起） */
export function getDayOfYear(date: Date): number {
  const firstDay = new Date(date.getFullYear(), 0, 1)
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.round((day.getTime() - firstDay.getTime()) / 86400000) + 1
}

/**
 * 单个令牌 → 文本
 * d 日 / dd 两位日 / o 年内天序 / oo 三位 / D 星期短名 / DD 星期全名
 * m 月 / mm 两位月 / M 月短名 / MM 月全名 / y 两位年 / yy 四位年
 * @ Unix 毫秒时间戳 / ! Windows ticks（自 0001-01-01 起的 100 纳秒）
 */
function formatToken(date: Date, token: string, labels: FormatLabels): string {
  switch (token) {
    case "d":
      return String(date.getDate())
    case "dd":
      return pad(date.getDate())
    case "o":
      return String(getDayOfYear(date))
    case "oo":
      return pad(getDayOfYear(date), 3)
    case "D":
      return labels.weekdayShort[date.getDay()] ?? ""
    case "DD":
      return labels.weekdayFull[date.getDay()] ?? ""
    case "m":
      return String(date.getMonth() + 1)
    case "mm":
      return pad(date.getMonth() + 1)
    case "M":
      return labels.monthShort[date.getMonth()] ?? ""
    case "MM":
      return labels.monthFull[date.getMonth()] ?? ""
    case "y":
      return pad(date.getFullYear() % 100)
    case "yy":
      return String(date.getFullYear())
    case "@":
      return String(date.getTime())
    case "!":
      return String((date.getTime() + WINDOWS_TICKS_OFFSET_MS) * 10000)
    default:
      return token
  }
}

/** 按 dateFormat 模板格式化日期；成对单引号包裹字面文本，`''` 输出单个单引号 */
export function formatDate(
  date: Date,
  template: string,
  labels: FormatLabels = DEFAULT_FORMAT_LABELS,
): string {
  let result = ""
  let index = 0

  while (index < template.length) {
    const char = template[index]

    if (char === "'") {
      if (template[index + 1] === "'") {
        result += "'"
        index += 2
        continue
      }
      const end = template.indexOf("'", index + 1)
      result += end === -1 ? template.slice(index + 1) : template.slice(index + 1, end)
      index = end === -1 ? template.length : end + 1
      continue
    }

    const twoChar = template.slice(index, index + 2)
    if (FORMAT_TOKENS.has(twoChar)) {
      result += formatToken(date, twoChar, labels)
      index += 2
      continue
    }
    if (FORMAT_TOKENS.has(char)) {
      result += formatToken(date, char, labels)
      index += 1
      continue
    }

    result += char
    index += 1
  }

  return result
}

/**
 * 按 dateFormat 模板反向解析手输文本（manualInput 用）
 * 仅支持数值类令牌 d/dd/m/mm/y/yy/@/!；模板含 o/oo/D/DD/M/MM 或文本不匹配时返回 null
 * 缺失的年/月/日按 当前年 / 1 月 / 1 日 补全，溢出日期（如 2 月 31 日）判定为非法
 */
export function parseDate(text: string, template: string): Date | null {
  const input = text.trim()
  if (!input) {
    return null
  }

  const tokens: string[] = []
  let pattern = "^"
  let index = 0

  while (index < template.length) {
    const char = template[index]

    if (char === "'") {
      if (template[index + 1] === "'") {
        pattern += "'"
        index += 2
        continue
      }
      const end = template.indexOf("'", index + 1)
      pattern += escapeRegExp(end === -1 ? template.slice(index + 1) : template.slice(index + 1, end))
      index = end === -1 ? template.length : end + 1
      continue
    }

    const twoChar = template.slice(index, index + 2)
    if (UNPARSEABLE_TOKENS.has(twoChar)) {
      return null
    }
    if (NUMERIC_PARSE_TOKENS[twoChar]) {
      pattern += NUMERIC_PARSE_TOKENS[twoChar]
      tokens.push(twoChar)
      index += 2
      continue
    }
    if (UNPARSEABLE_TOKENS.has(char)) {
      return null
    }
    if (NUMERIC_PARSE_TOKENS[char]) {
      pattern += NUMERIC_PARSE_TOKENS[char]
      tokens.push(char)
      index += 1
      continue
    }

    pattern += escapeRegExp(char)
    index += 1
  }

  if (tokens.length === 0) {
    return null
  }

  const matched = new RegExp(`${pattern}$`).exec(input)
  if (!matched) {
    return null
  }

  let year = Number.NaN
  let month = 1
  let day = 1
  let timestamp = Number.NaN

  tokens.forEach((token, tokenIndex) => {
    const raw = Number(matched[tokenIndex + 1])
    if (Number.isNaN(raw)) {
      return
    }
    switch (token) {
      case "y":
        year = raw < TWO_DIGIT_YEAR_PIVOT ? 2000 + raw : 1900 + raw
        break
      case "yy":
        year = raw
        break
      case "m":
      case "mm":
        month = raw
        break
      case "d":
      case "dd":
        day = raw
        break
      case "@":
        timestamp = raw
        break
      case "!":
        timestamp = raw / 10000 - WINDOWS_TICKS_OFFSET_MS
        break
      default:
        break
    }
  })

  if (!Number.isNaN(timestamp)) {
    const fromTimestamp = new Date(timestamp)
    return Number.isNaN(fromTimestamp.getTime()) ? null : fromTimestamp
  }
  if (Number.isNaN(year) || month < 1 || month > 12 || day < 1 || day > 31) {
    return null
  }

  const result = new Date(year, month - 1, day)
  // 溢出校验：2 月 31 日会被 Date 自动进位到 3 月，必须回读比对
  const overflow = result.getFullYear() !== year || result.getMonth() !== month - 1 || result.getDate() !== day
  return overflow ? null : result
}
