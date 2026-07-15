// 书签标记 — 类型定义与 DOM 常量

export interface BookmarkRule {
  bookmarkNames: string[]
  color: string
  backgroundColor: string
  icon?: string
  displayMode?: "bg" | "icon" | "icon-bg" | "row"
  /** 背景透明度 0~1，默认 0.25 */
  alpha?: number
  /** 匹配模式：exact=精确 / prefix=前缀 / contains=包含，默认 exact */
  matchMode?: "exact" | "prefix" | "contains"
}

export interface BookmarkMarkerOptions {
  rules: BookmarkRule[]
  updateInterval: number
}

export interface AttrRow {
  id: string
  bookmark: string
}

export interface RowStyleProps {
  backgroundColor: string
  color: string
  borderRadius: string
  padding: string
}

export const BOOKMARK_MARKER_CLASS = "bookmark-marker-tag"
export const BOOKMARK_PROTYLE_CLASS = "bookmark-marker-protyle"
export const BOOKMARK_MARKER_STYLE_ID = "bookmark-marker-styles"
