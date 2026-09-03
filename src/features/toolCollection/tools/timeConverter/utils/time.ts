/**
 * 时间转换 - 纯函数层
 * 输入自动识别（Unix 秒/毫秒时间戳、常见日期字符串）与多格式输出，不依赖 Vue 响应式
 */

/** 输入识别结果：无法识别时返回 null */
export type TimeParseResult =
  | { kind: "seconds" | "milliseconds" | "date"; date: Date }
  | null

/** 10 位秒级时间戳下界（2001-09-09 起） */
const SEC_MIN = 1e9
/** 13 位毫秒级时间戳下界（2001-09-09 起） */
const MS_MIN = 1e12

/** 数字补零 */
function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

/** 星期中文映射（索引对应 Date.getDay()） */
const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]

/**
 * 自动识别输入内容：
 * - 10 位纯数字 → Unix 秒
 * - 13 位纯数字 → Unix 毫秒
 * - 日期字符串（YYYY-MM-DD[ HH:mm:ss]、YYYY/MM/DD...、ISO 8601 含 Z/±HH:mm）→ Date
 */
export function parseTimeInput(input: string): TimeParseResult {
  const trimmed = input.trim()
  if (!trimmed) return null

  // 纯数字时间戳识别
  if (/^\d+$/.test(trimmed)) {
    if (trimmed.length === 10 && Number(trimmed) >= SEC_MIN) {
      return { kind: "seconds", date: new Date(Number(trimmed) * 1000) }
    }
    if (trimmed.length === 13 && Number(trimmed) >= MS_MIN) {
      return { kind: "milliseconds", date: new Date(Number(trimmed)) }
    }
    return null
  }

  // 日期字符串识别：统一分隔符后交给 Date 解析
  // 支持 2026-09-03 12:30:00 / 2026/09/03 12:30 / 2026.9.3 / 2026-09-03T12:30:00Z(±HH:mm)
  const normalized = trimmed
    .replace(/\//g, "-")
    .replace(/\./g, "-")
    .replace(" ", "T")
  const date = new Date(normalized)
  if (!Number.isNaN(date.getTime())) {
    return { kind: "date", date }
  }
  return null
}

/** 本地时间格式：YYYY-MM-DD HH:mm:ss */
export function formatLocal(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
    + ` ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
}

/** 日期多格式输出集合 */
export interface DateParts {
  /** 本地标准时间 YYYY-MM-DD HH:mm:ss（含星期） */
  local: string
  /** ISO 8601（UTC，Z 后缀） */
  iso: string
  /** UTC 字符串 */
  utc: string
  /** Unix 秒（10 位） */
  unixSec: number
  /** Unix 毫秒（13 位） */
  unixMs: number
}

/** 将 Date 转换为各格式输出 */
export function formatDateParts(date: Date): DateParts {
  return {
    local: `${formatLocal(date)} ${WEEKDAYS[date.getDay()]}`,
    iso: date.toISOString(),
    utc: date.toUTCString(),
    unixSec: Math.floor(date.getTime() / 1000),
    unixMs: date.getTime(),
  }
}

/** 当前时间信息（供实时刷新区使用） */
export interface NowInfo {
  local: string
  unixSec: number
  unixMs: number
}

/** 获取当前本地标准时间与时间戳 */
export function getNowInfo(): NowInfo {
  const now = new Date()
  return {
    local: `${formatLocal(now)} ${WEEKDAYS[now.getDay()]}`,
    unixSec: Math.floor(now.getTime() / 1000),
    unixMs: now.getTime(),
  }
}
