// Tabs 五件套共享的类型契约（Tabs.vue 的私有模块，禁止 feature 直接导入）
// 注入键与 inject 辅助函数在 ./context（运行时模块），本文件保持零运行时依赖

/** 标签值：与官方一致支持字符串与数字 */
export type TabsValue = string | number

/** 尺寸档位（与全库控件阶梯一致） */
export type TabsSize = "xsmall" | "small" | "medium" | "large"

/**
 * 激活标签的滚动策略（对齐官方语义）：
 * - `"nearest"`（默认）：仅在标签被裁切或过于靠近边缘时滚动（留 10% 缓冲）
 * - `"center"`：始终把激活标签居中
 * - `false`：禁用自动滚动
 * - 函数：完全交给调用方
 */
export type TabsScrollStrategy =
  | "nearest"
  | "center"
  | false
  | ((content: HTMLElement, tab: HTMLElement) => void)

/**
 * Tabs 通过 provide 暴露给四个子组件的上下文。
 * 字段用 getter 暴露（与 Splitter 同约定）：消费方读取即建立响应式依赖，且无需解包 ref。
 */
export interface TabsContext {
  /** 当前激活值（受控与非受控的统一入口） */
  readonly value: TabsValue | undefined
  /** 是否惰性渲染：true 时未激活面板完全不进 DOM（切走再回来状态重置） */
  readonly lazy: boolean
  /** 焦点移入标签时是否立即选中 */
  readonly selectOnFocus: boolean
  /** roving tabindex 基准：激活标签取该值、其余为 -1；面板共用同一值 */
  readonly tabindex: number
  /** 激活标签的滚动策略 */
  readonly scrollStrategy: TabsScrollStrategy
  /** 实例 id 前缀：标签 id = `${id}-tab-${value}`，面板 id = `${id}-tabpanel-${value}` */
  readonly id: string
  /** 幂等切换：值未变化时不派发 `update:value` */
  updateValue: (next: TabsValue) => void
  /** 把指定标签滚入可视区（由 TabList 在激活值变化后调用） */
  scrollToActiveTab: (content: HTMLElement, tab: HTMLElement) => void
}

/** TabList 通过 provide 暴露给 Tab 的上下文（Tab 的方向键查找与首末定位需要容器） */
export interface TabListContext {
  /** `role="tablist"` 的滚动容器；TabList 挂载前为 null */
  readonly content: HTMLElement | null
}
