/**
 * 工具定义接口
 */
export interface FloatingTool {
  id: string
  label: string
  title: string
  icon: string
  bgColor: string
  action: (plugin?: any) => void
}

/**
 * 技能接口
 */
export interface Skill {
  id: string
  title: string
  description: string
  content: string
  content2?: string
  content3?: string
  category: string
}

/**
 * 技能分类接口
 */
export interface SkillCategory {
  id: string
  name: string
  color: string // Make color required for consistency
}
