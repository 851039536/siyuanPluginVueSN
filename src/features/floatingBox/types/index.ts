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

export interface FloatingBoxOptions {
  position?: "left" | "right"
  offset?: number
}
