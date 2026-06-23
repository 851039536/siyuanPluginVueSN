import type { DocStats } from "../types/index"

/** 统计卡片颜色类名（匹配 StatsOverview 样式中的 .card-value.<color>） */
export type CardColorClass =
  | "zero" | "small" | "medium" | "dup"
  | "time-green" | "time-yellow" | "time-red" | "time-cyan" | "time-orange" | "time-purple"
  | "depth-color" | "ref-color" | "img-color"
  | "bookmark-color" | "no-bookmark-color" | "none-bookmark-color"
  | "pending-color" | "published-color" | "unused-color"
  | "full-publish-color" | "partial-publish-color" | "no-publish-color"

/** 统计分组 */
export type StatGroup = "size" | "time" | "bookmark" | "publish" | "structure" | "quality" | "topology"

export interface CategoryDef {
  /** 类别标识符（statFilter 值） */
  id: string
  /** 中文长标签（列表过滤 tag 中显示） */
  label: string
  /** 卡片短标签 */
  shortLabel: string
  /** 对应 DocStats 字段名 */
  statKey: keyof DocStats
  /** 卡片数值颜色类名 */
  colorClass: CardColorClass
  /** 所属统计分组 */
  group: StatGroup
  /** statKey 为空时使用固定值（如自定义时间、无标签用计算值） */
  fixedValue?: false
}

export const CATEGORIES: CategoryDef[] = [
  // 大小分布
  {
    id: "0B",
    label: "0B 空文档",
    shortLabel: "0B空",
    statKey: "zeroByteDocs",
    colorClass: "zero",
    group: "size",
  },
  {
    id: "small",
    label: "< 1KB",
    shortLabel: "<1KB",
    statKey: "smallDocs",
    colorClass: "small",
    group: "size",
  },
  {
    id: "medium",
    label: "1~10KB",
    shortLabel: "1~10KB",
    statKey: "mediumDocs",
    colorClass: "medium",
    group: "size",
  },
  {
    id: "duplicate",
    label: "重名文档",
    shortLabel: "重名",
    statKey: "duplicateNameDocs",
    colorClass: "dup",
    group: "size",
  },
  // 更新时间
  {
    id: "7days",
    label: "7天内更新",
    shortLabel: "7天内",
    statKey: "updatedIn7Days",
    colorClass: "time-green",
    group: "time",
  },
  {
    id: "30days",
    label: "7~30天更新",
    shortLabel: "7~30天",
    statKey: "updatedIn30Days",
    colorClass: "time-yellow",
    group: "time",
  },
  {
    id: "1to2month",
    label: "1~2月更新",
    shortLabel: "1~2月",
    statKey: "updatedIn1To2Months",
    colorClass: "time-cyan",
    group: "time",
  },
  {
    id: "2to3month",
    label: "2~3月更新",
    shortLabel: "2~3月",
    statKey: "updatedIn2To3Months",
    colorClass: "time-orange",
    group: "time",
  },
  {
    id: "halfYear",
    label: "半年以上未更新",
    shortLabel: "半年+",
    statKey: "updatedOverHalfYear",
    colorClass: "time-red",
    group: "time",
  },
  {
    id: "customTime",
    label: "自定义时间",
    shortLabel: "自定义",
    statKey: "updatedIn7Days",
    colorClass: "time-purple",
    group: "time",
    fixedValue: false,
  },
  // 书签
  {
    id: "pendingPublish",
    label: "待发布",
    shortLabel: "待发布",
    statKey: "pendingPublishDocs",
    colorClass: "pending-color",
    group: "bookmark",
  },
  {
    id: "published",
    label: "已发布",
    shortLabel: "已发布",
    statKey: "publishedDocs",
    colorClass: "published-color",
    group: "bookmark",
  },
  {
    id: "unused",
    label: "不使用",
    shortLabel: "不使用",
    statKey: "unusedDocs",
    colorClass: "unused-color",
    group: "bookmark",
  },
  {
    id: "noneBookmark",
    label: "书签「无」",
    shortLabel: "无",
    statKey: "noneBookmarkDocs",
    colorClass: "none-bookmark-color",
    group: "bookmark",
  },
  {
    id: "hasBookmark",
    label: "有书签",
    shortLabel: "有书签",
    statKey: "bookmarkedDocs",
    colorClass: "bookmark-color",
    group: "bookmark",
  },
  {
    id: "noBookmark",
    label: "无书签",
    shortLabel: "无书签",
    statKey: "noBookmarkDocs",
    colorClass: "no-bookmark-color",
    group: "bookmark",
  },
  // 发布状态
  {
    id: "fullPublish",
    label: "完整发布",
    shortLabel: "完整发布",
    statKey: "fullPublishDocs",
    colorClass: "full-publish-color",
    group: "publish",
  },
  {
    id: "partialPublish",
    label: "部分发布",
    shortLabel: "部分发布",
    statKey: "partialPublishDocs",
    colorClass: "partial-publish-color",
    group: "publish",
  },
  {
    id: "noPublish",
    label: "未发布",
    shortLabel: "未发布",
    statKey: "noPublishDocs",
    colorClass: "no-publish-color",
    group: "publish",
  },
  // 结构
  {
    id: "deep",
    label: "深层文档(≥5层)",
    shortLabel: "深层≥5",
    statKey: "deepDocs",
    colorClass: "depth-color",
    group: "structure",
  },
  {
    id: "hasImage",
    label: "含图片",
    shortLabel: "图片",
    statKey: "imageDocs",
    colorClass: "img-color",
    group: "structure",
  },
  // 内容质量
  {
    id: "hasTag",
    label: "有标签",
    shortLabel: "有标签",
    statKey: "taggedDocs",
    colorClass: "time-green",
    group: "quality",
  },
  {
    id: "noTag",
    label: "无标签",
    shortLabel: "无标签",
    statKey: "taggedDocs",
    colorClass: "time-red",
    group: "quality",
    fixedValue: false,
  },
  {
    id: "hasAlias",
    label: "有别名",
    shortLabel: "有别名",
    statKey: "aliasedDocs",
    colorClass: "time-cyan",
    group: "quality",
  },
  {
    id: "hasMemo",
    label: "有备注",
    shortLabel: "有备注",
    statKey: "memoedDocs",
    colorClass: "time-purple",
    group: "quality",
  },
  // 引用拓扑
  {
    id: "hasRef",
    label: "含引用",
    shortLabel: "含引用",
    statKey: "refDocs",
    colorClass: "ref-color",
    group: "topology",
  },
  {
    id: "incomingRef",
    label: "被引用",
    shortLabel: "被引用",
    statKey: "incomingRefDocs",
    colorClass: "time-cyan",
    group: "topology",
  },
  {
    id: "orphanDoc",
    label: "孤文档",
    shortLabel: "孤文档",
    statKey: "orphanDocs",
    colorClass: "zero",
    group: "topology",
  },
]

/** category id → CategoryDef */
export const CATEGORY_MAP = new Map(CATEGORIES.map((c) => [c.id, c]))

/** 获取类别的中文标签 */
export function getCategoryLabel(category: string): string {
  return CATEGORY_MAP.get(category)?.label || category
}

// 分组元数据
export const GROUP_META: { key: StatGroup, title: string, icon: string }[] = [
  {
    key: "size",
    title: "大小分布",
    icon: "mdi:harddisk",
  },
  {
    key: "time",
    title: "更新时间",
    icon: "mdi:clock-outline",
  },
  {
    key: "bookmark",
    title: "书签",
    icon: "mdi:bookmark-outline",
  },
  {
    key: "publish",
    title: "发布状态",
    icon: "mdi:cloud-check-outline",
  },
  {
    key: "structure",
    title: "结构",
    icon: "mdi:sitemap-outline",
  },
  {
    key: "quality",
    title: "内容质量",
    icon: "mdi:star-outline",
  },
  {
    key: "topology",
    title: "引用拓扑",
    icon: "mdi:graph-outline",
  },
]
