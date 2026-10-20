/**
 * 文档分析功能 - 类型定义
 *
 * 常量 / 默认值 / 元数据表拆分至 ./constants 与 ./statCards，
 * 本文件保持为纯类型定义；末尾统一再导出，既有 `types/index` 导入路径保持不变。
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
  /** 书签值分布（动态 GROUP BY 全量统计，不含空值） */
  bookmarkDistribution: BookmarkDetail[]
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
  /** 是否参与完整发布判定（false 时该平台不纳入完整发布/部分发布/未发布统计；默认 true） */
  fullCheck?: boolean
}

/** docAnalysis 分片 i18n（扁平键值对，供各组件 Props 统一引用） */
export type DocI18n = Record<string, string>

/** 发布推广文案配置 */
export interface PublishPromoteConfig {
  /** 是否在复制内容末尾追加推广文案 */
  enabled: boolean
  /** 推广文案内容（支持 Markdown/HTML 语法，多行文本） */
  text: string
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
}

/** 笔记本简要信息 */
export interface NotebookInfo {
  id: string
  name: string
}

/** 视图偏好设置 */
export interface ViewSettings {
  /** 统计表格是否隐藏零值行 */
  hideZero: boolean
}

// ============================================================
// StatsOverview 元数据驱动渲染（类型）
// ============================================================

/** 统计卡片颜色类名 */
export type CardColorClass =
  | "zero" | "small" | "medium" | "large" | "xlarge" | "dup"
  | "time-green" | "time-yellow" | "time-red" | "time-cyan" | "time-orange" | "time-purple"
  | "depth-color" | "ref-color" | "img-color"
  | "bookmark-color" | "no-bookmark-color"
  | "full-publish-color" | "partial-publish-color" | "no-publish-color"

/** 统计卡片计算上下文（供 resolveValue/suffixValue 动态取值，如重名卡片需要过滤后结果） */
export interface CardValueContext {
  /** 排除后重名文档总数 */
  effectiveDupDocs: number
  /** 排除后重名组数 */
  effectiveDupGroupCount: number
}

/** 单个统计卡片定义 */
export interface StatCardDef {
  id: string
  shortLabel: string
  statKey?: keyof DocStats
  colorClass: CardColorClass
  /** 卡片后缀（如重名卡片显示 "(N组)"）：对应 DocStats 字段 */
  suffixStatKey?: keyof DocStats
  /** 函数计算值（如无标签 = totalDocs - taggedDocs），优先级高于 statKey */
  resolveValue?: (stats: DocStats, ctx: CardValueContext) => number
  /** 函数计算后缀（优先级高于 suffixStatKey），返回字符串或数字 */
  suffixValue?: (stats: DocStats, ctx: CardValueContext) => string | number
}

/** 统计分区动态追加行来源（书签值分布/平台分布，点击下钻事件与来源一一对应） */
export type ExtraRowKind = "bookmarkDistribution" | "platformDistribution"

/** 统计分区定义 */
export interface StatSectionDef {
  key: string
  title: string
  icon: string
  cards: StatCardDef[]
  /** 分区动态追加行来源（默认无；声明后表格在汇总卡片行后追加该分布行，点击 emit 对应下钻事件） */
  extraRows?: ExtraRowKind
  /** 默认折叠 */
  collapsed?: boolean
}

/** 统计表格行（表格化布局的渲染单元，由卡片元数据或分布数组映射而来） */
export interface StatTableRow {
  /** 行唯一标识（下钻用，如卡片 id 或分布项 label） */
  id: string
  /** 显示标签（名称列） */
  label: string
  /** 数量 */
  count: number
  /** 占比字符串（如 "25%"） */
  pct: string
  /** 数量列语义色类名（对应 CardColorClass） */
  colorClass?: string
  /** 是否可点击下钻 */
  clickable?: boolean
}

// ============================================================
// 健康度扣分项（可配置，类型）
// ============================================================

/** 健康度扣分项 key（可配置项标识） */
export type DeductionKey =
  | "zeroByte"
  | "duplicate"
  | "noBookmark"
  | "partialPublish"
  | "deepGt7"
  | "wcGt20000"
  | "orphan"
  | "noTag"
  | "noPublish"

/** 健康度扣分项定义（元数据驱动，resolve 与旧硬编码公式逐项一致） */
export interface DeductionOptionDef {
  key: DeductionKey
  /** 显示名称 */
  label: string
  /** 计算当前扣分数量（depthStats 仅供深度项使用） */
  resolve: (stats: DocStats, ctx: CardValueContext, depthStats: DepthStats) => number
}

/** 健康度设置（持久化结构） */
export interface HealthSettings {
  /** 参与扣分计算的扣分项 key 列表 */
  enabledDeductions: DeductionKey[]
  /** 0B 排除书签值：带这些书签的文档整体排除出统计口径（不计入总文档数与 0B 数） */
  zeroByteExcludeBookmarks: string[]
}

// ============================================================
// 常量与元数据表（拆分至独立模块，统一再导出以保持既有导入路径）
// ============================================================

export * from "./constants"
export * from "./statCards"
