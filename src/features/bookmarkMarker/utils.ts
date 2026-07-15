// 书签标记 — 纯工具函数

import type { BookmarkRule, RowStyleProps } from "./types"

/** hex 颜色转 rgba 字符串 */
export function hexToRgba(hex: string, alpha: number): string {
  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function resolveMode(rule: BookmarkRule): string {
  return rule.displayMode || "bg"
}

export function resolveAlpha(rule: BookmarkRule): number {
  return rule.alpha ?? 0.25
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
