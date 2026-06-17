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

/** 提示词内容块 */
export interface PromptContent {
  id: string
  label: string
  text: string
}

export interface Prompt {
  id: string
  title: string
  description: string
  /** 动态内容块列表（新格式） */
  contents: PromptContent[]
  category: string
  /** @deprecated 旧格式字段，仅用于迁移检测 */
  content?: string
  /** @deprecated 旧格式字段，仅用于迁移检测 */
  content2?: string
  /** @deprecated 旧格式字段，仅用于迁移检测 */
  content3?: string
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
