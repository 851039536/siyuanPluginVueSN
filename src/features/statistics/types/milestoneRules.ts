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

export const STORAGE_KEY_MILESTONE_RULES = "milestone-rules"
