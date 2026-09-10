// 书签标记 — 类型定义、共享常量与 DOM 常量

/** 徽章显示模式：文字标签 / 仅图标 / 图标+背景 / 字体背景（省略时按 bg 处理） */
export type DisplayMode = "bg" | "icon" | "icon-bg" | "row"

/** 书签名匹配模式：精确 / 前缀 / 包含（省略时按 exact 处理） */
export type MatchMode = "exact" | "prefix" | "contains"

export interface BookmarkRule {
  bookmarkNames: string[]
  color: string
  backgroundColor: string
  icon?: string
  displayMode?: DisplayMode
  /** 背景透明度 0~1，默认 0.25 */
  alpha?: number
  /** 匹配模式，默认 exact */
  matchMode?: MatchMode
}

/**
 * 规则卡片向父级提交的单字段补丁。
 * 父级在**自己拥有**的规则对象上 Object.assign，避免子组件直接改写 props；
 * 同时禁止回传全量规则对象（`AGENTS.md § 子组件数据流规则`）。
 */
export type RulePatch = Partial<Pick<
  BookmarkRule,
  "bookmarkNames" | "color" | "backgroundColor" | "icon" | "displayMode" | "alpha" | "matchMode"
>>

export interface BookmarkMarkerOptions {
  rules: BookmarkRule[]
  updateInterval: number
}

/** Manager 变更动作（面板派发 / Manager 消费） */
export type BookmarkMarkerAction = "toggle" | "rulesChanged" | "intervalChanged"

/** Manager 变更载荷（判别联合，取代原先的 `data?: any`） */
export type BookmarkMarkerActionPayload =
  | { action: "toggle", enabled: boolean, rules: BookmarkRule[], updateInterval: number }
  | { action: "rulesChanged", rules: BookmarkRule[] }
  | { action: "intervalChanged", updateInterval: number }

/** 更新间隔可选项（毫秒 → i18n 键）——面板下拉的单一数据源 */
export const UPDATE_INTERVAL_OPTIONS: ReadonlyArray<{ value: number, labelKey: keyof BookmarkMarkerI18n }> = [
  { value: 1800000, labelKey: "markerInterval30min" },
  { value: 3600000, labelKey: "markerInterval1hour" },
  { value: 7200000, labelKey: "markerInterval2hour" },
  { value: 14400000, labelKey: "markerInterval4hour" },
]

/** 模块 i18n 键（扁平结构，取自 plugin.i18n 顶层；键名见 src/i18n/{zh_CN,en_US}/bookmarkMarker.json） */
export interface BookmarkMarkerI18n {
  bookmarkMarkerTitle: string
  bookmarkMarkerDescription: string
  panelCloseLabel: string
  bookmarkRules: string
  bookmarkName: string
  bookmarkNamePlaceholder: string
  markerIcon: string
  markerIconPlaceholder: string
  presetIcons: string
  markerTextColor: string
  markerBgColor: string
  markerDisplayMode: string
  modeTextLabel: string
  modeIconOnly: string
  modeIconBg: string
  modeRow: string
  bgAlpha: string
  matchMode: string
  matchExact: string
  matchPrefix: string
  matchContains: string
  addRule: string
  ruleRemoveLabel: string
  markerUpdateInterval: string
  markerInterval30min: string
  markerInterval1hour: string
  markerInterval2hour: string
  markerInterval4hour: string
  bookmarkMarkerMsgEnabled: string
  bookmarkMarkerMsgDisabled: string
  msgRulesUpdated: string
  msgIntervalUpdated: string
  previewLabel: string
  unnamed: string
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

/** 默认背景透明度（规则未设置 alpha 时生效，UI 与标记渲染共用单一数据源） */
export const DEFAULT_ALPHA = 0.25

/** 行样式注入值：直接写入思源自有 DOM 的行内样式，不经 SCSS，无设计 Token 可用 */
export const ROW_STYLE_RADIUS = "3px"
export const ROW_STYLE_PADDING = "0 4px"

export const BOOKMARK_MARKER_CLASS = "bookmark-marker-tag"
export const BOOKMARK_PROTYLE_CLASS = "bookmark-marker-protyle"
export const BOOKMARK_MARKER_STYLE_ID = "bookmark-marker-styles"
