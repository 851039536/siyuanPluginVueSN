/**
 * 文档分析功能 - 常量与元数据表
 *
 * 从 types/index.ts 拆出：index.ts 保持为纯类型定义，本文件收纳默认值、
 * 元数据表与由类型派生的运行时常量。
 */
import type {
  DeductionOptionDef,
  DepthStats,
  DocStats,
  FilterOptions,
  HealthSettings,
  PlatformMeta,
  PublishPromoteConfig,
  SortField,
  ViewSettings,
} from "./index"
import { PUBLISH_PLATFORMS } from "@/config/publishPlatforms"

/** 排序字段下拉选项（value 与 SortField 联合类型编译期绑定，避免模板 option 硬编码脱节） */
export const SORT_FIELD_OPTIONS: { value: SortField, label: string }[] = [
  { value: "wordCount", label: "按字数" },
  { value: "title", label: "按标题" },
  { value: "notebook", label: "按笔记本" },
  { value: "updated", label: "按更新时间" },
  { value: "depth", label: "按深度" },
  { value: "refCount", label: "按引用数" },
  { value: "imageCount", label: "按图片数" },
  { value: "bookmark", label: "按书签" },
]

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
}

/** 默认视图偏好设置 */
export const DEFAULT_VIEW_SETTINGS: ViewSettings = {
  hideZero: false,
}

/**
 * 默认平台元数据（用户未自定义时使用）
 * 由跨功能共享真源 @/config/publishPlatforms 派生，避免与 docNavigation 各写一份。
 */
export const DEFAULT_PLATFORM_META: PlatformMeta[] = PUBLISH_PLATFORMS.map((p) => ({
  id: p.id,
  matchers: [...p.matchers],
  name: p.name,
  url: p.url,
  fullCheck: true,
}))

/** 默认文档统计零值 */
export const DEFAULT_DOC_STATS: DocStats = {
  totalDocs: 0,
  zeroByteDocs: 0,
  smallDocs: 0,
  mediumDocs: 0,
  largeDocs: 0,
  xlargeDocs: 0,
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
  bookmarkDistribution: [],
}

/** 生成全新的默认统计对象（嵌套字段深拷贝，避免与 DEFAULT_DOC_STATS 常量共享引用被意外污染） */
export function makeDefaultDocStats(): DocStats {
  return { ...DEFAULT_DOC_STATS, platformCounts: {}, wordCountDistribution: [], bookmarkDistribution: [] }
}

/** 默认发布推广文案配置 */
export const DEFAULT_PUBLISH_PROMOTE: PublishPromoteConfig = {
  enabled: true,
  text: "公众号搜「oykperson」，一起学习，共同成长！",
}

/** 统计类别中文标签 */
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
  "deep": "深层文档(≥5层)",
  "hasRef": "含引用",
  "hasImage": "含图片",
  "hasBookmark": "有书签",
  "noBookmark": "无书签",
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

/** 字数分布最高档标签（健康度扣分项引用此常量，避免字符串耦合） */
export const WC_TOP_BIN_LABEL = ">2万字"

/** 无标签文档数（totalDocs - taggedDocs，质量卡片与健康度扣分项共用同一口径） */
export function untaggedDocsCount(stats: DocStats): number {
  return Math.max(0, stats.totalDocs - stats.taggedDocs)
}

/** 默认健康度设置：全部扣分项启用（新增项默认开启，用户可在健康度面板取消） */
export const DEFAULT_HEALTH_SETTINGS: HealthSettings = {
  enabledDeductions: [
    "zeroByte", "duplicate", "noBookmark", "partialPublish",
    "deepGt7", "wcGt20000", "orphan", "noTag", "noPublish",
  ],
  zeroByteExcludeBookmarks: [],
}

/** 可选扣分项注册表（按当前功能已有统计指标生成） */
export const DEDUCTION_OPTIONS: DeductionOptionDef[] = [
  { key: "zeroByte", label: "0B空", resolve: (stats) => stats.zeroByteDocs },
  {
    key: "duplicate",
    label: "重名超出",
    resolve: (_stats, ctx) => Math.max(0, ctx.effectiveDupDocs - ctx.effectiveDupGroupCount),
  },
  {
    key: "noBookmark",
    label: "无书签(排除0B)",
    resolve: (stats) => Math.max(0, stats.noBookmarkDocs - stats.zeroByteDocs),
  },
  { key: "partialPublish", label: "部分发布", resolve: (stats) => stats.partialPublishDocs },
  {
    key: "deepGt7",
    label: "深度>7",
    resolve: (_stats, _ctx, depthStats: DepthStats) =>
      depthStats.depthDistribution
        .filter((d) => d.depth > 7)
        .reduce((sum, d) => sum + d.count, 0),
  },
  {
    key: "wcGt20000",
    label: "字数>2万",
    resolve: (stats) =>
      stats.wordCountDistribution
        .filter((d) => d.label === WC_TOP_BIN_LABEL)
        .reduce((sum, d) => sum + d.count, 0),
  },
  { key: "orphan", label: "孤文档", resolve: (stats) => stats.orphanDocs },
  {
    key: "noTag",
    label: "无标签",
    resolve: (stats) => untaggedDocsCount(stats),
  },
  { key: "noPublish", label: "未发布", resolve: (stats) => stats.noPublishDocs },
]
