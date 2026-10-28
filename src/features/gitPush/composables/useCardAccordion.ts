// gitPush 卡片布局上下文（Provide/Inject：手风琴模式下「一次只展开一张」的共享状态）
import type { ComputedRef, InjectionKey, Ref } from "vue"
import { computed, inject, provide, ref } from "vue"
import type { CardLayout } from "../types/meta"

/** 卡片布局上下文（ListView 提供，ProjectCard/CardSummary 消费） */
export interface CardAccordionContext {
  /** 当前布局（响应式 getter，避免在 provide 层持有非响应快照） */
  layout: () => CardLayout
  /** 当前展开的项目 id（空串 = 全部收起） */
  expandedId: Ref<string>
  /** 展开指定项目（自动收起其他） */
  expand: (projectId: string) => void
  /** 切换指定项目的展开态 */
  toggle: (projectId: string) => void
}

const CARD_ACCORDION_KEY: InjectionKey<CardAccordionContext> = Symbol("gitPushCardAccordion")

/** 列表容器提供手风琴上下文（每个列表视图实例各自一份，不跨窗口共享） */
export function provideCardAccordion(layout: () => CardLayout): CardAccordionContext {
  const expandedId = ref("")

  function expand(projectId: string) {
    expandedId.value = projectId
  }

  function toggle(projectId: string) {
    expandedId.value = expandedId.value === projectId ? "" : projectId
  }

  const ctx: CardAccordionContext = { layout, expandedId, expand, toggle }
  provide(CARD_ACCORDION_KEY, ctx)
  return ctx
}

/**
 * 卡片读取布局与自身展开态。
 * 未注入上下文时退化为「始终展开」，保证独立使用 ProjectCard 也不会被隐藏。
 */
export function useCardAccordion(projectId: () => string): {
  isAccordion: ComputedRef<boolean>
  isExpanded: ComputedRef<boolean>
  expand: () => void
  toggle: () => void
} {
  const ctx = inject<CardAccordionContext | null>(CARD_ACCORDION_KEY, null)
  const isAccordion = computed(() => ctx?.layout() === "accordion")
  const isExpanded = computed(() => !isAccordion.value || ctx?.expandedId.value === projectId())
  return {
    isAccordion,
    isExpanded,
    expand: () => ctx?.expand(projectId()),
    toggle: () => ctx?.toggle(projectId()),
  }
}
