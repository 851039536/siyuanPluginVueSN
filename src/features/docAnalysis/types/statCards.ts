/**
 * 文档分析功能 - StatsOverview 卡片元数据表
 *
 * 从 types/index.ts 拆出：index.ts 保持为纯类型定义，本文件收纳由类型驱动的展示元数据。
 */
import type { StatCardDef, StatSectionDef } from "./index"
import { untaggedDocsCount } from "./constants"

/** 统计分区定义（概览 Tab 的卡片分组） */
export const STAT_SECTIONS: StatSectionDef[] = [
  {
    key: "size", title: "大小分布", icon: "mdi:harddisk",
    cards: [
      { id: "0B", shortLabel: "0B空", statKey: "zeroByteDocs", colorClass: "zero" },
      { id: "small", shortLabel: "<1KB", statKey: "smallDocs", colorClass: "small" },
      { id: "medium", shortLabel: "1~10KB", statKey: "mediumDocs", colorClass: "medium" },
      { id: "large", shortLabel: "10~100KB", statKey: "largeDocs", colorClass: "large" },
      { id: "xlarge", shortLabel: ">100KB", statKey: "xlargeDocs", colorClass: "xlarge" },
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
    ],
  },
  {
    key: "bookmark", title: "书签", icon: "mdi:bookmark-outline",
    extraRows: "bookmarkDistribution",
    cards: [
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

/** 质量 Tab 卡片元数据（与概览分区卡片同构，驱动 v-for 渲染） */
export const QUALITY_CARDS: StatCardDef[] = [
  { id: "deep", shortLabel: "深层≥5", statKey: "deepDocs", colorClass: "depth-color" },
  { id: "hasImage", shortLabel: "图片", statKey: "imageDocs", colorClass: "img-color", suffixStatKey: "totalImages" },
  { id: "hasTag", shortLabel: "有标签", statKey: "taggedDocs", colorClass: "time-green" },
  // 无标签走 totalDocs - taggedDocs（与健康度扣分项同一口径）
  { id: "noTag", shortLabel: "无标签", colorClass: "time-red", resolveValue: (s) => untaggedDocsCount(s) },
  { id: "hasAlias", shortLabel: "有别名", statKey: "aliasedDocs", colorClass: "time-cyan" },
  { id: "hasMemo", shortLabel: "有备注", statKey: "memoedDocs", colorClass: "time-purple" },
  { id: "hasRef", shortLabel: "含引用", statKey: "refDocs", colorClass: "ref-color", suffixStatKey: "totalRefs" },
  { id: "incomingRef", shortLabel: "被引用", statKey: "incomingRefDocs", colorClass: "time-cyan" },
  { id: "orphanDoc", shortLabel: "孤文档", statKey: "orphanDocs", colorClass: "zero" },
  { id: "duplicate", shortLabel: "重名", colorClass: "dup",
    resolveValue: (_s, ctx) => ctx.effectiveDupDocs,
    suffixValue: (_s, ctx) => `${ctx.effectiveDupGroupCount}组` },
]
