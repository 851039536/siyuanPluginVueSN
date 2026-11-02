// 视图内分区切换条的类型定义（SectionTabs 组件与各消费方共用）
import type { IconKey } from "@/components/kit/icons"

/** 单个分区项：id 为分区联合类型，label 为已渲染文案，hint 为悬停说明 */
export interface SectionTabItem<T extends string = string> {
  id: T
  label: string
  icon: IconKey
  hint?: string
}
