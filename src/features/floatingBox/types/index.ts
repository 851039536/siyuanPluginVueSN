/**
 * 悬浮框功能类型定义
 */

export interface FloatingToolChild {
  id: string
  label: string
  action: () => void
}

export interface FloatingTool {
  id: string
  label: string
  icon: string
  bgColor: string
  action: () => void
  /** 子菜单项，hover 时展开 */
  children?: FloatingToolChild[]
}
