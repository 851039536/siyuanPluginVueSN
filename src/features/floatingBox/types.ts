/**
 * 工具定义接口
 */
export interface FloatingTool {
  id: string
  label: string
  title: string
  icon: string
  bgColor: string
  action: () => void
}

/**
 * 技能接口
 */
export interface Skill {
  id: string
  title: string
  description: string
  content: string
}
