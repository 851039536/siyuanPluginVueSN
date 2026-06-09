/** 自定义里程碑规则持久化结构 */
export interface MilestoneRulesData {
  _version: 1
  /** 各类型的里程碑目标值数组，key=类型名，value=从小到大排列的目标值列表 */
  rules: Record<string, number[]>
}

/** 10 种里程碑类型 */
export const MILESTONE_TYPES = [
  { key: "notes",     label: "笔记数",   icon: "📝" },
  { key: "words",     label: "总字数",   icon: "✍️" },
  { key: "blocks",    label: "内容块数", icon: "🧱" },
  { key: "tags",      label: "标签数",   icon: "🏷️" },
  { key: "backlinks", label: "双链数",   icon: "🔗" },
  { key: "assets",    label: "附件数",   icon: "📁" },
  { key: "images",    label: "图片数",   icon: "🖼️" },
  { key: "notebooks", label: "笔记本数", icon: "📓" },
  { key: "code",      label: "代码块数", icon: "💻" },
  { key: "streak",    label: "连续写作天数", icon: "🔥" },
  { key: "activeDays",label: "活跃天数", icon: "📅" },
] as const

export type MilestoneTypeKey = typeof MILESTONE_TYPES[number]["key"]

/** 各类型的显示格式化函数（供里程碑 chip 标签使用） */
export const MILESTONE_LABEL_FNS: Record<string, (v: number) => string> = {
  notes:      (v) => v >= 10000 ? `${v / 10000}万篇` : `${v}篇`,
  words:      (v) => v >= 10000 ? `${v / 10000}万字` : `${v}字`,
  blocks:     (v) => v >= 1000 ? `${v / 1000}k块` : `${v}个内容块`,
  tags:       (v) => `${v}个标签`,
  backlinks:  (v) => `${v}条双链`,
  assets:     (v) => `${v}个附件`,
  images:     (v) => `${v}张图片`,
  notebooks:  (v) => `${v}个笔记本`,
  code:       (v) => `${v}个代码块`,
  streak:     (v) => v >= 365 ? `${Math.floor(v / 365)}年` : `连续${v}天`,
  activeDays: (v) => v >= 365 ? `活跃${Math.floor(v / 365)}年` : `活跃${v}天`,
}

export const STORAGE_KEY_MILESTONE_RULES = "milestone-rules"
