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
  customBookmarkTop: BookmarkDetail[]
}

/** 字数分档 */
export interface WordCountBin {
  label: string
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


// ============================================================
// 常量
// ============================================================

/** 笔记本简要信息 */
export interface NotebookInfo {
  id: string
  name: string
}

/** 默认过滤选项 */
export const DEFAULT_FILTER_OPTIONS: FilterOptions = {
  titleKeyword: "",
  contentKeyword: "",
  notebookId: "",
  sortField: "wordCount",
  sortOrder: "asc",
  wordCountMin: 0,
  wordCountMax: 30000,
  bookmarkName: "",
  updatedAfter: "",
  updatedBefore: "",
}

/** 默认平台元数据（用户未自定义时使用） */
export const DEFAULT_PLATFORM_META: PlatformMeta[] = [
  { id: "csdn",         matchers: ["csdn"],                    name: "CSDN",    url: "https://mp.csdn.net/mp_blog/creation/editor" },
  { id: "zhihu",        matchers: ["zhihu"],                   name: "知乎",    url: "https://zhuanlan.zhihu.com/write" },
  { id: "juejin",       matchers: ["juejin"],                  name: "掘金",    url: "https://juejin.cn/editor/drafts/new" },
  { id: "cnblogs",      matchers: ["cnblogs", "blog"],         name: "博客园",  url: "https://i.cnblogs.com/posts/edit" },
  { id: "bili",         matchers: ["bili", "bibi"],            name: "B站",     url: "https://www.bilibili.com/" },
  { id: "gzh",          matchers: ["gzh"],                     name: "公众号",  url: "" },
  { id: "jianshu",      matchers: ["jianshu"],                 name: "简书",    url: "https://www.jianshu.com/writer" },
  { id: "cto51",        matchers: ["cto51"],                   name: "51CTO",   url: "https://blog.51cto.com/writer" },
  { id: "segmentfault", matchers: ["segmentfault", "sifou"],   name: "思否",    url: "https://segmentfault.com/write" },
  { id: "oschina",      matchers: ["oschina"],                 name: "开源中国", url: "https://oschina.net/writer" },
  { id: "infoq",        matchers: ["infoq"],                   name: "InfoQ",   url: "https://www.infoq.com/" },
]

/** 默认文档统计零值 */
export const DEFAULT_DOC_STATS: DocStats = {
  totalDocs: 0,
  zeroByteDocs: 0,
  smallDocs: 0,
  mediumDocs: 0,
  largeDocs: 0,
  xlargeDocs: 0,
  duplicateNameGroups: 0,
  duplicateNameDocs: 0,
  updatedIn7Days: 0,
  updatedIn30Days: 0,
  updatedIn1To2Months: 0,
  updatedIn2To3Months: 0,
  updatedOverHalfYear: 0,
  deepDocs: 0,
  refDocs: 0,
  totalRefs: 0,
  imageDocs: 0,
  totalImages: 0,
  bookmarkedDocs: 0,
  noBookmarkDocs: 0,
  pendingPublishDocs: 0,
  publishedDocs: 0,
  unusedDocs: 0,
  noneBookmarkDocs: 0,
  fullPublishDocs: 0,
  partialPublishDocs: 0,
  noPublishDocs: 0,
  taggedDocs: 0,
  aliasedDocs: 0,
  memoedDocs: 0,
  incomingRefDocs: 0,
  orphanDocs: 0,
  platformCounts: {},
  wordCountDistribution: [],
  customBookmarkTop: [],
}

// ============================================================
// 类别标签
// ============================================================

const CATEGORY_LABELS: Record<string, string> = {
  "0B": "0B 空文档",
  "small": "< 1KB",
  "medium": "1~10KB",
  "large": "10~100KB",
  "xlarge": ">100KB",
  "duplicate": "重名文档",
  "7days": "7天内更新",
  "30days": "7~30天更新",
  "1to2month": "1~2月更新",
  "2to3month": "2~3月更新",
  "halfYear": "半年以上未更新",
  "customTime": "自定义时间",
  "deep": "深层文档(≥5层)",
  "hasRef": "含引用",
  "hasImage": "含图片",
  "hasBookmark": "有书签",
  "noBookmark": "无书签",
  "pendingPublish": "待发布",
  "published": "已发布",
  "unused": "不使用",
  "noneBookmark": "书签「无」",
  "fullPublish": "完整发布",
  "partialPublish": "部分发布",
  "noPublish": "未发布",
  "hasTag": "有标签",
  "noTag": "无标签",
  "hasAlias": "有别名",
  "hasMemo": "有备注",
  "incomingRef": "被引用",
  "orphanDoc": "孤文档",
}

/** 获取统计类别的中文标签 */
export function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] || category
}

// ============================================================
// StatsOverview 元数据驱动渲染
// ============================================================

/** 统计卡片颜色类名 */
export type CardColorClass =
  | "zero" | "small" | "medium" | "large" | "xlarge" | "dup"
  | "time-green" | "time-yellow" | "time-red" | "time-cyan" | "time-orange" | "time-purple"
  | "depth-color" | "ref-color" | "img-color"
  | "bookmark-color" | "no-bookmark-color" | "none-bookmark-color"
  | "pending-color" | "published-color" | "unused-color"
  | "full-publish-color" | "partial-publish-color" | "no-publish-color"

/** 单个统计卡片定义 */
export interface StatCardDef {
  id: string
  shortLabel: string
  statKey: keyof DocStats
  colorClass: CardColorClass
  /** 卡片后缀（如重名卡片显示 "(N组)"）：对应 DocStats 字段 */
  suffixStatKey?: keyof DocStats
  /** 函数计算值（如无标签 = totalDocs - taggedDocs），优先级高于 statKey */
  resolveValue?: (stats: DocStats) => number
  /** 图标名（仅图标卡片，如自定义时间） */
  iconValue?: string
}

/** 统计分区定义 */
export interface StatSectionDef {
  key: string
  title: string
  icon: string
  cards: StatCardDef[]
  /** 默认折叠 */
  collapsed?: boolean
}

export const STAT_SECTIONS: StatSectionDef[] = [
  {
    key: "size", title: "大小分布", icon: "mdi:harddisk",
    cards: [
      { id: "0B", shortLabel: "0B空", statKey: "zeroByteDocs", colorClass: "zero" },
      { id: "small", shortLabel: "<1KB", statKey: "smallDocs", colorClass: "small" },
      { id: "medium", shortLabel: "1~10KB", statKey: "mediumDocs", colorClass: "medium" },
      { id: "large", shortLabel: "10~100KB", statKey: "largeDocs", colorClass: "large" },
      { id: "xlarge", shortLabel: ">100KB", statKey: "xlargeDocs", colorClass: "xlarge" },
      { id: "duplicate", shortLabel: "重名", statKey: "duplicateNameDocs", colorClass: "dup", suffixStatKey: "duplicateNameGroups" },
    ],
  },
  {
    key: "time", title: "更新时间", icon: "mdi:clock-outline",
    cards: [
      { id: "7days", shortLabel: "7天内", statKey: "updatedIn7Days", colorClass: "time-green" },
      { id: "30days", shortLabel: "7~30天", statKey: "updatedIn30Days", colorClass: "time-yellow" },
      { id: "1to2month", shortLabel: "1~2月", statKey: "updatedIn1To2Months", colorClass: "time-cyan" },
      { id: "2to3month", shortLabel: "2~3月", statKey: "updatedIn2To3Months", colorClass: "time-orange" },
      { id: "halfYear", shortLabel: "半年+", statKey: "updatedOverHalfYear", colorClass: "time-red" },
      { id: "customTime", shortLabel: "自定义", statKey: "updatedIn7Days", colorClass: "time-purple", iconValue: "mdi:calendar-range" },
    ],
  },
  {
    key: "bookmark", title: "书签", icon: "mdi:bookmark-outline",
    cards: [
      { id: "pendingPublish", shortLabel: "待发布", statKey: "pendingPublishDocs", colorClass: "pending-color" },
      { id: "published", shortLabel: "已发布", statKey: "publishedDocs", colorClass: "published-color" },
      { id: "unused", shortLabel: "不使用", statKey: "unusedDocs", colorClass: "unused-color" },
      { id: "noneBookmark", shortLabel: "无", statKey: "noneBookmarkDocs", colorClass: "none-bookmark-color" },
      { id: "hasBookmark", shortLabel: "有书签", statKey: "bookmarkedDocs", colorClass: "bookmark-color" },
      { id: "noBookmark", shortLabel: "无书签", statKey: "noBookmarkDocs", colorClass: "no-bookmark-color" },
    ],
  },
  {
    key: "publish", title: "发布状态", icon: "mdi:cloud-check-outline",
    cards: [
      { id: "fullPublish", shortLabel: "完整发布", statKey: "fullPublishDocs", colorClass: "full-publish-color" },
      { id: "partialPublish", shortLabel: "部分发布", statKey: "partialPublishDocs", colorClass: "partial-publish-color" },
      { id: "noPublish", shortLabel: "未发布", statKey: "noPublishDocs", colorClass: "no-publish-color" },
    ],
  },
]

