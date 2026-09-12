// Sidebar / SidebarMain 两件套共享的类型契约（Sidebar.vue 的私有模块，禁止 feature 直接导入）
// 注入键与 inject 辅助函数在 ./context（运行时模块），本文件保持零运行时依赖

/** 侧边栏贴合边（官方仅左右两侧；上下不在本组件的语义内） */
export type SidebarSide = "left" | "right"

/**
 * 视觉变体（对齐官方语义）：
 * - `sidebar`（默认）：常规侧边栏，与主内容区同处一个平面（中间 1px 描边分隔）
 * - `floating`：悬浮面板，四向圆角 + 描边，四周留白（像浮在内容上的卡片）
 * - `inset`：内嵌面板，贴容器边缘但整体内缩，四周圆角
 */
export type SidebarVariant = "sidebar" | "floating" | "inset"

/**
 * 折叠行为（对齐官方语义）：
 * - `offcanvas`：折叠 = 完全移出视野（配 `overlay` 时叠在内容之上）
 * - `icon`（默认）：折叠 = 收成图标条（`iconWidth`），图标居中、文字隐藏
 * - `none`：不可折叠（始终展开；`open` 恒真）
 */
export type SidebarCollapsible = "offcanvas" | "icon" | "none"

/** 尺寸档位（与全库控件阶梯一致） */
export type SidebarSize = "xsmall" | "small" | "medium" | "large"

/**
 * Sidebar 通过 provide 暴露给 SidebarMain 的上下文。
 * 字段用 getter 暴露（沿用 Tabs / Splitter 约定）：消费方读取即建立响应式依赖，且无需解包 ref。
 */
export interface SidebarContext {
  /** 面板实际是否处于展开态（已综合 collapsible === "none" 等约束后的最终值） */
  readonly open: boolean
  /** 视觉变体（SidebarMain 据此决定是否为自己留出内边距） */
  readonly variant: SidebarVariant
  /** 折叠行为 */
  readonly collapsible: SidebarCollapsible
  /** 是否浮层模式（SidebarMain 无需让位） */
  readonly overlay: boolean
  /** 贴合边（决定 SidebarMain 的哪一侧让位、以及让多少） */
  readonly side: SidebarSide
  /**
   * 侧边栏当前占用的横向宽度（CSS 长度字符串）。
   * `overlay` 为真时返回 `0px` —— 浮层不占文档流，主内容区不该让位。
   */
  readonly occupiedWidth: string
  /** 切换开合（供 SidebarMain 或外部按钮调用） */
  toggle: () => void
}

/** 折叠态图标条宽度默认值（对齐官方 `iconWidth` 默认 3rem） */
export const DEFAULT_ICON_WIDTH = "3rem"

/** 展开态宽度默认值（对齐官方 `width` 默认 16rem） */
export const DEFAULT_WIDTH = "16rem"

/** 悬停展开延迟默认值（对齐官方 `hoverOpenDelay` 默认 50） */
export const DEFAULT_HOVER_OPEN_DELAY = 50

/** 悬停收起延迟默认值（对齐官方 `hoverCloseDelay` 默认 100） */
export const DEFAULT_HOVER_CLOSE_DELAY = 100
