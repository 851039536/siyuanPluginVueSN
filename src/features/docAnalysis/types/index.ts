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
  /** 发布状态 (idle/published) */
  publishStatus?: string
  /** 已发布平台数量 */
  publishedPlatformCount?: number
}

/** 更新时间分析统计 */
export interface UpdateTimeStats {
  /** 7天内更新的文档数 */
  in7Days: number
  /** 7~30天更新的文档数 */
  in30Days: number
  /** 30天~2个月更新的文档数 */
  in1To2Months: number
  /** 2~3个月更新的文档数 */
  in2To3Months: number
  /** 3个月~半年更新的文档数 */
  inHalfYear: number
  /** 半年以上未更新的文档数 */
  overHalfYear: number
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

/** 引用分析统计 */
export interface RefStats {
  /** 被引用最多的文档 */
  topRefDocs: { docId: string, title: string, refCount: number }[]
  /** 包含引用的文档总数 */
  refDocCount: number
  /** 引用块总数 */
  totalRefCount: number
}

/** 图片/资源分析统计 */
export interface ImageStats {
  /** 包含图片最多的文档 */
  topImageDocs: { docId: string, title: string, imageCount: number }[]
  /** 包含图片的文档总数 */
  imageDocCount: number
  /** 图片/资源块总数 */
  totalImageCount: number
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
  /** 最大文档深度 */
  maxDepth: number
  /** 平均文档深度 */
  avgDepth: number
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
}

