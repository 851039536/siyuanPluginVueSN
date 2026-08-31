/**
 * 提示词库类型定义与共享常量
 */

/** 默认分类色（新分类表单初值 / 默认与"全部"分类兜底色，全模块单源） */
export const DEFAULT_CATEGORY_COLOR = "#d97757"

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
  /** 动态内容块列表 */
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
