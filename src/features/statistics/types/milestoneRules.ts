import type { IconKey } from "@/config/icons"

/** 自定义里程碑规则持久化结构 */
export interface MilestoneRulesData {
  _version: 1
  /** 各类型的里程碑目标值数组，key=类型名，value=从小到大排列的目标值列表 */
  rules: Record<string, number[]>
}

/** 10 种里程碑类型 */
export const MILESTONE_TYPES = [
  {
    key: "notes",
    label: "笔记数",
    icon: "edit" as IconKey,
  },
  {
    key: "words",
    label: "总字数",
    icon: "edit" as IconKey,
  },
  {
    key: "blocks",
    label: "内容块数",
    icon: "format" as IconKey,
  },
  {
    key: "tags",
    label: "标签数",
    icon: "list" as IconKey,
  },
  {
    key: "backlinks",
    label: "双链数",
    icon: "forward" as IconKey,
  },
  {
    key: "assets",
    label: "附件数",
    icon: "folder" as IconKey,
  },
  {
    key: "images",
    label: "图片数",
    icon: "image" as IconKey,
  },
  {
    key: "notebooks",
    label: "笔记本数",
    icon: "folder" as IconKey,
  },
  {
    key: "code",
    label: "代码块数",
    icon: "code" as IconKey,
  },
  {
    key: "streak",
    label: "连续写作天数",
    icon: "star" as IconKey,
  },
  {
    key: "activeDays",
    label: "活跃天数",
    icon: "list" as IconKey,
  },
] as const

export type MilestoneTypeKey = typeof MILESTONE_TYPES[number]["key"]

/** 各类型的显示格式化函数（供里程碑 chip 标签使用） */
export const MILESTONE_LABEL_FNS: Record<string, (v: number) => string> = {
  notes: (v) => v >= 10000 ? `${v / 10000}万篇` : `${v}篇`,
  words: (v) => v >= 10000 ? `${v / 10000}万字` : `${v}字`,
  blocks: (v) => v >= 1000 ? `${v / 1000}k块` : `${v}个内容块`,
  tags: (v) => `${v}个标签`,
  backlinks: (v) => `${v}条双链`,
  assets: (v) => `${v}个附件`,
  images: (v) => `${v}张图片`,
  notebooks: (v) => `${v}个笔记本`,
  code: (v) => `${v}个代码块`,
  streak: (v) => v >= 365 ? `${Math.floor(v / 365)}年` : `连续${v}天`,
  activeDays: (v) => v >= 365 ? `活跃${Math.floor(v / 365)}年` : `活跃${v}天`,
}

export const STORAGE_KEY_MILESTONE_RULES = "milestone-rules"
export const STORAGE_KEY_CUSTOM_ACHIEVEMENTS = "milestone-custom-achievements"
export const STORAGE_KEY_LEVEL_CONFIG = "milestone-level-config"

/** 等级系统配置 */
export interface LevelConfig {
  /** 各稀有度里程碑对应的成就点 */
  tierPoints: Record<string, number>
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
  tier: "common" | "rare" | "epic" | "legendary"
  /** 关联的统计类型 */
  type: string
  /** 达标阈值 */
  threshold: number
}

/** 统计类型描述（供自定义成就编辑器使用） */
export const STAT_TYPE_DESCRIPTIONS: Record<string, string> = {
  notes: "笔记总数达到指定值",
  words: "总字数达到指定值",
  blocks: "内容块数达到指定值",
  tags: "标签数达到指定值",
  backlinks: "双链数达到指定值",
  assets: "附件数达到指定值",
  images: "图片数达到指定值",
  notebooks: "笔记本数达到指定值",
  code: "代码块数达到指定值",
  streak: "连续写作天数达到指定值",
  activeDays: "活跃天数达到指定值",
}
