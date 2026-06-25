/**
 * 文档分析功能 - 类型定义
 */

// ============================================================
// 类型定义
// ============================================================

/** 文档信息 */
export interface DocInfo {
  /** 文档ID */
  id: string
  /** 文档标题 */
  title: string
  /** 文档路径（人类可读） */
  hpath: string
  /** 笔记本ID */
  notebookId: string
  /** 笔记本名称 */
  notebookName: string
  /** 内容大小（字节） */
  contentSize: number
  /** 字数 */
  wordCount: number
  /** 最后更新时间（yyyyMMddHHmmss 格式字符串，如 "20210604222535"） */
  updated?: string
  /** 创建时间（yyyyMMddHHmmss 格式字符串） */
  created?: string
  /** 文档深度（路径层级数） */
  depth?: number
  /** 引用块数量 */
  refCount?: number
  /** 图片/资源数量 */
  imageCount?: number
  /** 书签名称（如果该文档有书签） */
  bookmark?: string
  /** 未发布的平台名称列表 */
  unpublishedPlatforms?: string[]
}

/** 深度分析统计 */
export interface DepthStats {
  /** 各深度的文档数量 */
  depthDistribution: { depth: number, count: number }[]
  /** 最大深度 */
  maxDepth: number
  /** 平均深度 */
  avgDepth: number
}

/** 排序方式 */
export type SortField = "wordCount" | "title" | "notebook" | "updated" | "depth" | "refCount" | "imageCount" | "bookmark"
export type SortOrder = "asc" | "desc"

/** 查询状态 */
export type QueryStatus = "idle" | "loading" | "success" | "error" | "empty"

/** 过滤选项 */
export interface FilterOptions {
  /** 标题模糊查询关键词 */
  titleKeyword: string
  /** 全文内容搜索关键词 */
  contentKeyword: string
  /** 选中的笔记本ID（空字符串表示全部） */
  notebookId: string
  /** 排序字段 */
  sortField: SortField
  /** 排序方向 */
  sortOrder: SortOrder
  /** 字数过滤最小值（0 表示不过滤） */
  wordCountMin: number
  /** 字数过滤最大值（0 表示不过滤） */
  wordCountMax: number
  /** 书签名称过滤（空字符串表示全部） */
  bookmarkName: string
  /** 自定义时间过滤 - 更新于此日期之后（yyyy-MM-dd 格式，空字符串表示不限制） */
  updatedAfter: string
  /** 自定义时间过滤 - 更新于此日期之前（yyyy-MM-dd 格式，空字符串表示不限制） */
  updatedBefore: string
}

/** 查询结果状态 */
export interface QueryState {
  /** 状态 */
  status: QueryStatus
  /** 结果列表 */
  results: DocInfo[]
  /** 错误信息 */
  errorMessage: string
  /** 是否已查询过 */
  hasQueried: boolean
}

/** 重名文档组 */
export interface DuplicateNameGroup {
  /** 重复的文档标题 */
  title: string
  /** 重复数量 */
  count: number
}

/** 文档统计信息 */
export interface DocStats {
  /** 总文档数 */
  totalDocs: number
  /** 0B 空文档数 */
  zeroByteDocs: number
  /** < 1KB 文档数 */
  smallDocs: number
  /** 1~10KB 文档数 */
  mediumDocs: number
  /** 重名文档组数（有多少组同名文档） */
  duplicateNameGroups: number
  /** 重名文档总数（所有重名组的文档数之和） */
  duplicateNameDocs: number
  /** 7天内更新的文档数 */
  updatedIn7Days: number
  /** 7~30天未更新的文档数 */
  updatedIn30Days: number
  /** 1~2个月更新的文档数 */
  updatedIn1To2Months: number
  /** 2~3个月更新的文档数 */
  updatedIn2To3Months: number
  /** 半年以上未更新的文档数 */
  updatedOverHalfYear: number
  /** 深层文档数（深度 >= 5） */
  deepDocs: number
  /** 包含引用的文档数 */
  refDocs: number
  /** 引用块总数 */
  totalRefs: number
  /** 包含图片的文档数 */
  imageDocs: number
  /** 图片/资源块总数 */
  totalImages: number
  /** 带有书签的文档数 */
  bookmarkedDocs: number
  /** 没有书签的文档数 */
  noBookmarkDocs: number
  /** 标记"待发布"的文档数 */
  pendingPublishDocs: number
  /** 标记"已发布"的文档数 */
  publishedDocs: number
  /** 标记"不使用"的文档数 */
  unusedDocs: number
  /** 标记"无"的文档数 */
  noneBookmarkDocs: number
  /** 全平台已发布文档数 */
  fullPublishDocs: number
  /** 部分平台已发布文档数 */
  partialPublishDocs: number
  /** 未在任何平台发布文档数 */
  noPublishDocs: number
  /** 有标签文档数 */
  taggedDocs: number
  /** 有别名文档数 */
  aliasedDocs: number
  /** 有备注文档数 */
  memoedDocs: number
  /** 被其他文档引用的文档数 */
  incomingRefDocs: number
  /** 孤文档数（无入链无出链） */
  orphanDocs: number
  /** 各平台已发布文档数（key 为 platform.id，如 csdn/zhihu） */
  platformCounts: Record<string, number>
  /** 10~100KB 文档数 */
  largeDocs: number
  /** >100KB 文档数 */
  xlargeDocs: number
  /** 字数分布 */
  wordCountDistribution: WordCountBin[]
  /** 自定义书签 Top-N（排除系统书签：待发布/已发布/不使用/无） */
  customBookmarkTop: BookmarkBin[]
  /** 命中去重扣分条件的文档数（去重后） */
  distinctIssueCount: number
}

/** 字数分档 */
export interface WordCountBin {
  label: string
  count: number
}

/** 书签分档（复用，也用于自定义书签） */
export interface BookmarkBin {
  value: string
  count: number
}

/** 书签详情项 */
export interface BookmarkDetail {
  value: string
  count: number
}

/** 平台元数据项 */
export interface PlatformMeta {
  id: string
  matchers: string[]
  name: string
  url: string
  /** 隐藏该平台（不在过滤栏显示，分析仍纳入统计） */
  hidden?: boolean
}

// ============================================================
// 发布页相关类型
// ============================================================

/** 发布平台主题定义 */
export interface PublishTheme {
  /** 主题唯一标识 */
  id: string
  /** 显示名称 */
  name: string
  /** 预览包裹容器内联样式 */
  container: Record<string, string>
  /** 按标签的样式覆盖（标签 → CSS属性 → 值） */
  elements: Record<string, Record<string, string>>
  /** 默认代码高亮主题（highlight.js 主题名） */
  codeTheme: CodeTheme
}

/** 代码高亮主题 */
export type CodeTheme = "github" | "monokai" | "atom-one-dark" | "atom-one-light" | "vs"

/** 导出格式 */
export type ExportFormat = "html" | "markdown" | "htmlFile"

/** 发布面板入口参数 */
export interface PublishPanelParams {
  /** 文档 ID（从文档列表打开时传入） */
  docId?: string
  /** 目标平台ID（从 AttrsPanel 的"前往发布"传入） */
  targetPlatformId?: string
  /** 初始 Markdown 内容（粘贴时传入） */
  initialMd?: string
}

// ============================================================
// 工具函数（纯函数，无副作用）
// ============================================================

/** 获取统计类别的中文标签 */
export function getCategoryLabel(category: string): string {
  switch (category) {
    case "0B": return "0B 空文档"
    case "small": return "< 1KB"
    case "medium": return "1~10KB"
    case "duplicate": return "重名文档"
    case "7days": return "7天内更新"
    case "30days": return "7~30天更新"
    case "1to2month": return "1~2月更新"
    case "2to3month": return "2~3月更新"
    case "halfYear": return "半年以上未更新"
    case "customTime": return "自定义时间"
    case "deep": return "深层文档(≥5层)"
    case "hasRef": return "含引用"
    case "hasImage": return "含图片"
    case "hasBookmark": return "有书签"
    case "noBookmark": return "无书签"
    case "pendingPublish": return "待发布"
    case "published": return "已发布"
    case "unused": return "不使用"
    case "noneBookmark": return "书签「无」"
    case "fullPublish": return "完整发布"
    case "partialPublish": return "部分发布"
    case "noPublish": return "未发布"
    case "hasTag": return "有标签"
    case "noTag": return "无标签"
    case "hasAlias": return "有别名"
    case "hasMemo": return "有备注"
    case "incomingRef": return "被引用"
    case "orphanDoc": return "孤文档"
    case "large": return "10~100KB"
    case "xlarge": return ">100KB"
    default: return category
  }
}

