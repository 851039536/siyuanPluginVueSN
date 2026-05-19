/**
 * RSS订阅功能 - 类型定义
 */

/** RSS订阅源 */
export interface RssFeed {
  /** 唯一ID */
  id: string
  /** 订阅源标题 */
  title: string
  /** 订阅源URL */
  url: string
  /** 订阅源描述 */
  description?: string
  /** 网站链接 */
  siteUrl?: string
  /** 图标URL */
  iconUrl?: string
  /** 最后更新时间 */
  lastUpdated?: string
  /** 添加时间 */
  addedAt: number
  /** 分组名称 */
  group?: string
  /** 是否启用 */
  enabled: boolean
}

/** RSS文章条目 */
export interface RssItem {
  /** 标题 */
  title: string
  /** 文章链接 */
  link: string
  /** 文章描述/摘要 */
  description?: string
  /** 发布时间 */
  pubDate?: string
  /** 作者 */
  author?: string
  /** 所属订阅源ID */
  feedId: string
  /** 所属订阅源标题 */
  feedTitle?: string
  /** 是否已读 */
  read: boolean
  /** 是否收藏 */
  starred: boolean
  /** 内容（完整文章） */
  content?: string
  /** 封面图片URL */
  coverImage?: string
  /** 分类标签 */
  categories?: string[]
}

/** RSS订阅源设置 */
export interface RssSettings {
  /** 自动刷新间隔（分钟），0表示不自动刷新 */
  refreshInterval: number
  /** 最大保留文章数（每个订阅源） */
  maxItemsPerFeed: number
  /** 默认视图模式 */
  viewMode: RssViewMode
  /** 是否显示描述/摘要 */
  showDescription: boolean
  /** 文章排序方式 */
  sortOrder: RssSortOrder
}

/** 视图模式 */
export type RssViewMode = "list" | "card"

/** 排序方式 */
export type RssSortOrder = "newest" | "oldest"

/** 查询状态 */
export type RssLoadingStatus = "idle" | "loading" | "success" | "error"

/** 默认设置 */
export const DEFAULT_RSS_SETTINGS: RssSettings = {
  refreshInterval: 30,
  maxItemsPerFeed: 100,
  viewMode: "list",
  showDescription: true,
  sortOrder: "newest",
}
