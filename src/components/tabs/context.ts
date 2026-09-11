// Tabs 五件套共享的注入键与 inject 辅助函数（Tabs.vue 的私有模块，禁止 feature 直接导入）
import type {
  InjectionKey,
} from "vue"
import {
  inject,
} from "vue"
import type {
  TabListContext,
  TabsContext,
} from "./types"

/** 注入键：Tabs 提供，TabList / Tab / TabPanels / TabPanel 消费 */
export const TABS_CONTEXT_KEY: InjectionKey<TabsContext> = Symbol("siTabs")

/** 注入键：TabList 提供，Tab 消费（方向键查找与首末定位） */
export const TAB_LIST_CONTEXT_KEY: InjectionKey<TabListContext> = Symbol("siTabList")

/**
 * 取 Tabs 上下文；脱离 `<Tabs>` 使用时直接抛错（五件套必须成组使用，
 * 静默降级会让标签栏变成一排行内按钮，问题更难定位）。
 */
export function useTabsContext(componentName: string): TabsContext {
  const context = inject(TABS_CONTEXT_KEY, null)
  if (!context) {
    throw new Error(`[${componentName}] 必须在 <Tabs> 内使用：Tabs / TabList / Tab / TabPanels / TabPanel 需成组使用`)
  }
  return context
}

/** 取 TabList 上下文；Tab 必须位于 `<TabList>` 内（键盘导航依赖容器） */
export function useTabListContext(componentName: string): TabListContext {
  const context = inject(TAB_LIST_CONTEXT_KEY, null)
  if (!context) {
    throw new Error(`[${componentName}] 必须在 <TabList> 内使用`)
  }
  return context
}

/** 标签元素 id（Tab 的 `id` 与 TabPanel 的 `aria-labelledby` 指向它） */
export const tabId = (tabsId: string, value: string | number) => `${tabsId}-tab-${value}`

/** 面板元素 id（Tab 的 `aria-controls` 与 TabPanel 的 `id` 用它） */
export const tabPanelId = (tabsId: string, value: string | number) => `${tabsId}-tabpanel-${value}`
