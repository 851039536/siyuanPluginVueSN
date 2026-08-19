// 书签标记 — 纯工具函数

import type { BookmarkRule, RowStyleProps } from "./types"

/** hex 颜色转 rgba 字符串；非法输入回退为透明色，alpha 钳制到 0~1 */
export function hexToRgba(hex: string, alpha: number): string {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex)
  const a = Number.isFinite(alpha) ? Math.min(1, Math.max(0, alpha)) : 0.25
  if (!match) return "rgba(0, 0, 0, 0)"
  const r = Number.parseInt(match[1].slice(0, 2), 16)
  const g = Number.parseInt(match[1].slice(2, 4), 16)
  const b = Number.parseInt(match[1].slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

export function resolveMode(rule: BookmarkRule): string {
  return rule.displayMode || "bg"
}

export function resolveAlpha(rule: BookmarkRule): number {
  return rule.alpha ?? 0.25
}

/** 归一化规则：兼容旧格式 bookmarkName（单数）→ bookmarkNames（数组），过滤空书签名与无书签名的空规则 */
export function normalizeRules(rules: any[]): BookmarkRule[] {
  if (!Array.isArray(rules)) return []
  return rules
    .map((r) => ({
      ...r,
      bookmarkNames: Array.isArray(r.bookmarkNames)
        ? r.bookmarkNames.filter((n: unknown) => typeof n === "string" && n.trim().length > 0)
        : (r.bookmarkName ? [r.bookmarkName] : []),
    }))
    .filter((r) => r.bookmarkNames.length > 0)
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
  const mode = rule.matchMode || "exact"
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
    borderRadius: "3px",
    padding: "0 4px",
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
