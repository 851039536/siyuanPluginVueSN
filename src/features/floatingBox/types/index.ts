/**
 * 悬浮框功能类型定义
 */

export interface FloatingToolChild {
  id: string
  label: string
  title: string
  action: (plugin?: any) => void
}

export interface FloatingTool {
  id: string
  label: string
  title: string
  icon: string
  bgColor: string
  action: (plugin?: any) => void
  /** 子菜单项，hover 时展开 */
  children?: FloatingToolChild[]
}

export interface Prompt {
  id: string
  title: string
  description: string
  content: string
  content2?: string
  content3?: string
  category: string
}

export interface PromptCategory {
  id: string
  name: string
  color: string
}

export interface FloatingBoxOptions {
  position?: "left" | "right"
  offset?: number
}
