// Sidebar 两件套共享的注入键与 inject 辅助函数（Sidebar.vue 的私有模块，禁止 feature 直接导入）
// 沿用 tabs/context.ts 先例
import type {
  InjectionKey,
} from "vue"
import {
  inject,
} from "vue"
import type { SidebarContext } from "./types"

/** 注入键：Sidebar 提供，SidebarMain 消费 */
export const SIDEBAR_CONTEXT_KEY: InjectionKey<SidebarContext> = Symbol("siSidebar")

/**
 * 取 Sidebar 上下文。
 * ⚠️ 与 Tabs 五件套不同，这里**允许脱离 `<Sidebar>` 使用**（返回 null）：
 * `SidebarMain` 也可以作为「不与侧边栏联动」的普通主内容容器独立出现
 * （例如侧边栏用别的方式实现时，只想复用主内容区的让位与内边距样式）。
 * 强抛错会让这种合理用法被迫套一个空 Sidebar。
 */
export function useSidebarContext(): SidebarContext | null {
  return inject(SIDEBAR_CONTEXT_KEY, null)
}
