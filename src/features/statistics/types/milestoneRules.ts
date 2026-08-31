// 里程碑类型定义、成就/等级配置接口、存储键常量

import type { IconKey } from "@/config/icons"
import type { StatisticsData } from "./index"
import type { Tier } from "./milestoneData"

/** Milestone 类型 → StatisticsData 字段名映射 */
export const MILESTONE_FIELD_MAP: Record<string, keyof StatisticsData> = {
  notes: "totalNotes",
  words: "totalWords",
  blocks: "totalBlocks",
  tags: "totalTags",
  backlinks: "totalBacklinks",
  assets: "totalAssets",
  images: "totalImages",
  notebooks: "notebookCount",
  code: "codeBlocks",
  streak: "writingStreak",
  activeDays: "activeDays",
}

/** 稀有度 i18n 键（规则编辑弹窗各 Tab 共用，渲染时查 i18n） */
export const TIER_LABELS: Record<Tier, string> = {
  common: "tierCommon",
  rare: "tierRare",
  epic: "tierEpic",
  legendary: "tierLegendary",
}

/** 11 种里程碑类型（labelKey 为 i18n 键，渲染时查 i18n） */
export const MILESTONE_TYPES = [
  {
    key: "notes",
    labelKey: "msTypeNotes",
    icon: "edit" as IconKey,
  },
  {
    key: "words",
    labelKey: "msTypeWords",
    icon: "edit" as IconKey,
  },
  {
    key: "blocks",
    labelKey: "msTypeBlocks",
    icon: "format" as IconKey,
  },
  {
    key: "tags",
    labelKey: "msTypeTags",
    icon: "list" as IconKey,
  },
  {
    key: "backlinks",
    labelKey: "msTypeBacklinks",
    icon: "forward" as IconKey,
  },
  {
    key: "assets",
    labelKey: "msTypeAssets",
    icon: "folder" as IconKey,
  },
  {
    key: "images",
    labelKey: "msTypeImages",
    icon: "image" as IconKey,
  },
  {
    key: "notebooks",
    labelKey: "msTypeNotebooks",
    icon: "folder" as IconKey,
  },
  {
    key: "code",
    labelKey: "msTypeCode",
    icon: "code" as IconKey,
  },
  {
    key: "streak",
    labelKey: "msTypeStreak",
    icon: "star" as IconKey,
  },
  {
    key: "activeDays",
    labelKey: "msTypeActiveDays",
    icon: "list" as IconKey,
  },
] as const

export type MilestoneTypeKey = typeof MILESTONE_TYPES[number]["key"]

/** 各类型的显示格式化函数（供里程碑 chip 标签使用；单位词走 i18n 占位符模板） */
export const MILESTONE_LABEL_FNS: Record<string, (v: number, i18n: Record<string, any>) => string> = {
  notes: (v, i18n) => v >= 10000 ? fillTemplate(i18n.mlNotesWan, v / 10000) : fillTemplate(i18n.mlNotes, v),
  words: (v, i18n) => v >= 10000 ? fillTemplate(i18n.mlWordsWan, v / 10000) : fillTemplate(i18n.mlWords, v),
  blocks: (v, i18n) => v >= 1000 ? fillTemplate(i18n.mlBlocksK, v / 1000) : fillTemplate(i18n.mlBlocks, v),
  tags: (v, i18n) => fillTemplate(i18n.mlTags, v),
  backlinks: (v, i18n) => fillTemplate(i18n.mlBacklinks, v),
  assets: (v, i18n) => fillTemplate(i18n.mlAssets, v),
  images: (v, i18n) => fillTemplate(i18n.mlImages, v),
  notebooks: (v, i18n) => fillTemplate(i18n.mlNotebooks, v),
  code: (v, i18n) => fillTemplate(i18n.mlCode, v),
  streak: (v, i18n) => v >= 365 ? fillTemplate(i18n.mlStreakYear, Math.floor(v / 365)) : fillTemplate(i18n.mlStreak, v),
  activeDays: (v, i18n) => v >= 365 ? fillTemplate(i18n.mlActiveDaysYear, Math.floor(v / 365)) : fillTemplate(i18n.mlActiveDays, v),
}

/** 将 {v} 占位符替换为数值（模板缺失时返回空串，避免键名裸露） */
function fillTemplate(template: string | undefined, v: number): string {
  return String(template ?? "").replace("{v}", String(v))
}

export const STORAGE_KEY_MILESTONE_RULES = "milestone-rules"
export const STORAGE_KEY_CUSTOM_ACHIEVEMENTS = "milestone-custom-achievements"
export const STORAGE_KEY_LEVEL_CONFIG = "milestone-level-config"

/** 等级系统配置 */
export interface LevelConfig {
  /** 各稀有度里程碑对应的成就点 */
  tierPoints: Record<Tier, number>
  /** 等级曲线乘数（越大升级越慢） */
  curveMultiplier: number
}

export const DEFAULT_LEVEL_CONFIG: LevelConfig = {
  tierPoints: {
    common: 3,
    rare: 8,
    epic: 15,
    legendary: 30,
  },
  curveMultiplier: 10,
}

/** 自定义成就定义 */
export interface CustomAchievement {
  id: string
  icon: IconKey
  title: string
  description: string
  tier: Tier
  /** 关联的统计类型 */
  type: string
  /** 达标阈值 */
  threshold: number
}

/** 统计类型描述 i18n 键（供自定义成就编辑器使用，渲染时查 i18n） */
export const STAT_TYPE_DESCRIPTIONS: Record<string, string> = {
  notes: "statTypeDescNotes",
  words: "statTypeDescWords",
  blocks: "statTypeDescBlocks",
  tags: "statTypeDescTags",
  backlinks: "statTypeDescBacklinks",
  assets: "statTypeDescAssets",
  images: "statTypeDescImages",
  notebooks: "statTypeDescNotebooks",
  code: "statTypeDescCode",
  streak: "statTypeDescStreak",
  activeDays: "statTypeDescActiveDays",
}
