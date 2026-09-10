// 书签标记 — 纯工具函数

import type {
  BookmarkRule,
  DisplayMode,
  MatchMode,
  RowStyleProps,
} from "./types"
import {
  DEFAULT_ALPHA,
  ROW_STYLE_PADDING,
  ROW_STYLE_RADIUS,
} from "./types"

/** 合法 hex 颜色：3 位缩写或 6 位完整写法（均已归一化为 6 位后再解析） */
const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

const DISPLAY_MODES: readonly DisplayMode[] = ["bg", "icon", "icon-bg", "row"]
const MATCH_MODES: readonly MatchMode[] = ["exact", "prefix", "contains"]

/** hex 颜色转 rgba 字符串；非法输入回退为透明色，alpha 钳制到 0~1 */
export function hexToRgba(hex: string, alpha: number): string {
  const a = Number.isFinite(alpha) ? Math.min(1, Math.max(0, alpha)) : DEFAULT_ALPHA
  const match = typeof hex === "string" ? HEX_COLOR_RE.exec(hex.trim()) : null
  if (!match) return "rgba(0, 0, 0, 0)"
  // 3 位缩写展开为 6 位（#abc → #aabbcc），避免合法 CSS 简写被误判为非法
  const full = match[1].length === 3
    ? match[1].split("").map((c) => c + c).join("")
    : match[1]
  const r = Number.parseInt(full.slice(0, 2), 16)
  const g = Number.parseInt(full.slice(2, 4), 16)
  const b = Number.parseInt(full.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

export function resolveMode(rule: BookmarkRule): DisplayMode {
  return rule.displayMode ?? "bg"
}

export function resolveAlpha(rule: BookmarkRule): number {
  return rule.alpha ?? DEFAULT_ALPHA
}

/** 判断是否为可索引的普通对象（用于 unknown 输入的类型守卫） */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback
}

function asDisplayMode(value: unknown): DisplayMode | undefined {
  return typeof value === "string" && (DISPLAY_MODES as readonly string[]).includes(value)
    ? value as DisplayMode
    : undefined
}

function asMatchMode(value: unknown): MatchMode | undefined {
  return typeof value === "string" && (MATCH_MODES as readonly string[]).includes(value)
    ? value as MatchMode
    : undefined
}

function asAlpha(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : undefined
}

/** 归一化单条书签名列表：兼容旧格式 bookmarkName（单数）→ bookmarkNames（数组），过滤空白项 */
function normalizeNames(raw: Record<string, unknown>): string[] {
  if (Array.isArray(raw.bookmarkNames)) {
    return raw.bookmarkNames.filter(
      (n): n is string => typeof n === "string" && n.trim().length > 0,
    )
  }
  const legacy = raw.bookmarkName
  return typeof legacy === "string" && legacy.trim().length > 0 ? [legacy] : []
}

/**
 * 归一化规则列表：字段白名单 + 类型守卫，过滤空书签名与无书签名的空规则
 * （避免 contains 模式误匹配），兼容旧格式 bookmarkName（单数）。
 */
export function normalizeRules(rules: unknown): BookmarkRule[] {
  if (!Array.isArray(rules)) return []
  const normalized: BookmarkRule[] = []
  for (const raw of rules) {
    if (!isRecord(raw)) continue
    const bookmarkNames = normalizeNames(raw)
    if (bookmarkNames.length === 0) continue
    normalized.push({
      bookmarkNames,
      color: asString(raw.color, "#ffffff"),
      backgroundColor: asString(raw.backgroundColor, "#1890ff"),
      icon: typeof raw.icon === "string" ? raw.icon : undefined,
      displayMode: asDisplayMode(raw.displayMode),
      alpha: asAlpha(raw.alpha),
      matchMode: asMatchMode(raw.matchMode),
    })
  }
  return normalized
}

/** 生成规则样式签名，用于判断已渲染标记是否需要重建 */
export function buildRuleSignature(rule: BookmarkRule): string {
  return [
    resolveMode(rule),
    rule.color,
    rule.backgroundColor,
    rule.icon ?? "",
    resolveAlpha(rule),
  ].join("|")
}

/** 检查书签名是否匹配规则 */
export function matchesBookmarkName(bookmarkName: string, rule: BookmarkRule): boolean {
  const mode = rule.matchMode ?? "exact"
  return rule.bookmarkNames.some((name) => {
    if (mode === "exact") return name === bookmarkName
    if (mode === "prefix") return bookmarkName.startsWith(name)
    return bookmarkName.includes(name)
  })
}

export function buildRowStyle(rule: BookmarkRule): RowStyleProps {
  return {
    backgroundColor: hexToRgba(rule.backgroundColor, resolveAlpha(rule)),
    color: rule.color,
    borderRadius: ROW_STYLE_RADIUS,
    padding: ROW_STYLE_PADDING,
  }
}

export function applyRowStyle(el: HTMLElement, style: RowStyleProps, bookmarkName: string): void {
  el.style.backgroundColor = style.backgroundColor
  el.style.color = style.color
  el.style.borderRadius = style.borderRadius
  el.style.padding = style.padding
  el.dataset.bookmarkRow = bookmarkName
}

export function clearRowStyle(el: HTMLElement): void {
  el.style.backgroundColor = ""
  el.style.color = ""
  el.style.borderRadius = ""
  el.style.padding = ""
  delete el.dataset.bookmarkRow
}

export function clearAllRowMarkers(selector: string): void {
  document.querySelectorAll(selector).forEach((el) => clearRowStyle(el as HTMLElement))
}

export function createMarkerElement(
  className: string,
  bookmarkName: string,
  rule: BookmarkRule,
): HTMLSpanElement {
  const mode = resolveMode(rule)
  const marker = document.createElement("span")
  marker.className = className
  marker.dataset.bookmark = bookmarkName
  marker.dataset.sig = buildRuleSignature(rule)
  marker.style.color = rule.color

  if (mode === "icon" && rule.icon) {
    marker.style.backgroundColor = "transparent"
    marker.textContent = rule.icon
  } else if (mode === "icon-bg" && rule.icon) {
    marker.style.backgroundColor = rule.backgroundColor
    marker.textContent = rule.icon
  } else {
    marker.style.backgroundColor = hexToRgba(rule.backgroundColor, resolveAlpha(rule))
    marker.textContent = rule.icon ? `${rule.icon} ${bookmarkName}` : bookmarkName
  }

  return marker
}
