// 里程碑卡片静态数据：等级称号、阈值成就、特殊成就、分类定义（不依赖 Vue 响应式与 i18n）

import type { IconKey } from "@/config/icons"

/** 里程碑/成就稀有度 */
export type Tier = "common" | "rare" | "epic" | "legendary"

/** 单个里程碑定义 */
export interface MilestoneDef {
  id: string
  icon: string
  label: string
  target: number
  type: string
  tier: Tier
}

/** 里程碑附带达成状态（供分类视图使用） */
export interface MilestoneState extends MilestoneDef {
  achieved: boolean
  progress: number
  current: number
  isNext: boolean
}

/** 里程碑分类定义（名称由组件侧注入 i18n） */
export interface CategoryDef {
  id: string
  icon: string
  name: string
  types: string[]
}

/** 里程碑分类基础定义（含 i18n 键 + 回退文本，名称在组件侧组装） */
export interface CategoryI18nDef {
  id: string
  icon: string
  types: string[]
  i18nKey: string
}

/** 分类视图（每分类独立展开状态） */
export interface CategoryView {
  id: string
  icon: string
  name: string
  expanded: boolean
  achievedCount: number
  totalCount: number
  allItems: MilestoneState[]
  previewItems: MilestoneState[]
  hiddenCount: number
}

/** 成就定义 */
export interface AchievementDef {
  id: string
  icon: string
  title: string
  description: string
  tier: Tier
  check: () => boolean
  _custom?: boolean
}

/** 阈值型成就单项（文案为派生 i18n 键，见 utils/achievements 的 achI18nKey） */
export interface ThresholdItem { v: number, icon: string, tier: Tier }
/** 阈值型成就分组 */
export interface ThresholdGroup { prefix: string, type: string, items: ThresholdItem[] }

/** 每个大阶级的等级数 */
export const TIER_SIZE = 20

/** 20 个基础称号（在阶级内循环使用；title 为 i18n 键） */
export const BASE_TITLES: { icon: string, title: string }[] = [
  { icon: "edit", title: "baseTitle1" },
  { icon: "edit", title: "baseTitle2" },
  { icon: "file", title: "baseTitle3" },
  { icon: "edit", title: "baseTitle4" },
  { icon: "file", title: "baseTitle5" },
  { icon: "list", title: "baseTitle6" },
  { icon: "folder", title: "baseTitle7" },
  { icon: "format", title: "baseTitle8" },
  { icon: "forward", title: "baseTitle9" },
  { icon: "list", title: "baseTitle10" },
  { icon: "lightbulb", title: "baseTitle11" },
  { icon: "format", title: "baseTitle12" },
  { icon: "search", title: "baseTitle13" },
  { icon: "lightbulb", title: "baseTitle14" },
  { icon: "star", title: "baseTitle15" },
  { icon: "star", title: "baseTitle16" },
  { icon: "file", title: "baseTitle17" },
  { icon: "star", title: "baseTitle18" },
  { icon: "star", title: "baseTitle19" },
  { icon: "star", title: "baseTitle20" },
]

/** 30 个阶级前缀（随等级递增；值为 i18n 键，中文键自带「·」分隔、英文键自带尾随空格） */
export const TIER_PREFIXES = Array.from({ length: 30 }, (_, i) => `tierPrefix${i + 1}`)

/** 阈值型成就配置（数据驱动；文案由 type+阈值派生 i18n 键） */
export const THRESHOLD_ACHIEVEMENTS: ThresholdGroup[] = [
  {
    prefix: "ach",
    type: "notes",
    items: [
      { v: 1, icon: "star", tier: "common" },
      { v: 30, icon: "star", tier: "common" },
      { v: 100, icon: "star", tier: "rare" },
      { v: 300, icon: "star", tier: "rare" },
      { v: 500, icon: "star", tier: "epic" },
      { v: 1000, icon: "star", tier: "epic" },
      { v: 3000, icon: "star", tier: "legendary" },
    ],
  },
  {
    prefix: "ach",
    type: "blocks",
    items: [
      { v: 100, icon: "format", tier: "common" },
      { v: 500, icon: "format", tier: "common" },
      { v: 2000, icon: "format", tier: "rare" },
      { v: 5000, icon: "format", tier: "rare" },
      { v: 10000, icon: "format", tier: "epic" },
      { v: 30000, icon: "format", tier: "legendary" },
    ],
  },
  {
    prefix: "ach",
    type: "words",
    items: [
      { v: 10000, icon: "edit", tier: "common" },
      { v: 50000, icon: "edit", tier: "common" },
      { v: 100000, icon: "list", tier: "rare" },
      { v: 300000, icon: "list", tier: "rare" },
      { v: 1000000, icon: "star", tier: "epic" },
      { v: 3000000, icon: "star", tier: "epic" },
      { v: 10000000, icon: "star", tier: "legendary" },
    ],
  },
  {
    prefix: "ach",
    type: "notebooks",
    items: [
      { v: 1, icon: "file", tier: "common" },
      { v: 5, icon: "file", tier: "common" },
      { v: 10, icon: "list", tier: "rare" },
      { v: 20, icon: "star", tier: "epic" },
    ],
  },
  {
    prefix: "ach",
    type: "streak",
    items: [
      { v: 3, icon: "star", tier: "common" },
      { v: 7, icon: "star", tier: "common" },
      { v: 14, icon: "star", tier: "rare" },
      { v: 30, icon: "star", tier: "rare" },
      { v: 60, icon: "star", tier: "epic" },
      { v: 100, icon: "star", tier: "epic" },
      { v: 200, icon: "star", tier: "legendary" },
      { v: 365, icon: "star", tier: "legendary" },
    ],
  },
  {
    prefix: "ach",
    type: "activeDays",
    items: [
      { v: 30, icon: "list", tier: "common" },
      { v: 100, icon: "list", tier: "rare" },
      { v: 365, icon: "list", tier: "epic" },
    ],
  },
  {
    prefix: "ach",
    type: "tags",
    items: [
      { v: 1, icon: "list", tier: "common" },
      { v: 10, icon: "list", tier: "common" },
      { v: 50, icon: "star", tier: "rare" },
    ],
  },
  {
    prefix: "ach",
    type: "backlinks",
    items: [
      { v: 1, icon: "forward", tier: "common" },
      { v: 100, icon: "forward", tier: "common" },
      { v: 500, icon: "forward", tier: "rare" },
      { v: 1000, icon: "forward", tier: "epic" },
    ],
  },
  {
    prefix: "ach",
    type: "assets",
    items: [
      { v: 1, icon: "folder", tier: "common" },
      { v: 30, icon: "folder", tier: "common" },
      { v: 100, icon: "folder", tier: "rare" },
    ],
  },
  {
    prefix: "ach",
    type: "images",
    items: [
      { v: 50, icon: "image", tier: "common" },
      { v: 200, icon: "image", tier: "rare" },
      { v: 1000, icon: "image", tier: "epic" },
    ],
  },
  {
    prefix: "ach",
    type: "code",
    items: [
      { v: 1, icon: "code", tier: "common" },
      { v: 10, icon: "code", tier: "common" },
      { v: 50, icon: "code", tier: "rare" },
      { v: 200, icon: "code", tier: "epic" },
    ],
  },
]

/** 特殊（meta）成就（title/description 为 i18n 键；check 由组件侧注入） */
export const META_ACHIEVEMENTS: Omit<AchievementDef, "check">[] = [
  { id: "ach-all-common", icon: "star", title: "achAllCommonTitle", description: "achAllCommonDesc", tier: "epic" },
  { id: "ach-half-all", icon: "star", title: "achHalfAllTitle", description: "achHalfAllDesc", tier: "epic" },
  { id: "ach-all-rare", icon: "star", title: "achAllRareTitle", description: "achAllRareDesc", tier: "legendary" },
  { id: "ach-level-10", icon: "star", title: "achLevel10Title", description: "achLevel10Desc", tier: "legendary" },
]

/** 成就墙分类 Tab 定义（名称由组件侧按 i18nKey 渲染） */
export interface AchCategory { id: string, icon: string, i18nKey: string, types?: string[] }
export const ACH_CATEGORIES: AchCategory[] = [
  { id: "all", icon: "star", i18nKey: "catAll" },
  { id: "writing", icon: "edit", i18nKey: "catWriting", types: ["notes", "words", "notebooks"] },
  { id: "knowledge", icon: "lightbulb", i18nKey: "catKnowledge", types: ["tags", "backlinks"] },
  { id: "rich", icon: "folder", i18nKey: "catRich", types: ["blocks", "assets", "images", "code"] },
  { id: "persistence", icon: "star", i18nKey: "catPersistence", types: ["streak", "activeDays"] },
  { id: "meta", icon: "star", i18nKey: "catMeta", types: ["meta", "custom"] },
]

/** 里程碑分类基础定义：从 ACH_CATEGORIES 派生（排除 all/meta），名称由组件侧注入 i18n */
export const CATEGORY_DEFS: CategoryI18nDef[] = ACH_CATEGORIES
  .filter((c) => c.id !== "all" && c.id !== "meta" && c.types)
  .map((c) => ({
    id: c.id,
    icon: c.icon,
    i18nKey: c.i18nKey,
    types: c.types as string[],
  }))

/** 里程碑类型元数据（图标 + 标签格式化函数，格式化需 i18n） */
export type TypeMeta = Record<string, { icon: IconKey, labelFn: (v: number, i18n: Record<string, any>) => string }>
