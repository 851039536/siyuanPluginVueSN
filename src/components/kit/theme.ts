/**
 * kit/theme.ts —— 组件库默认主题注入（自包含迁移的组成部分）
 *
 * 背景：组件样式的颜色全部写作 `var(--b3-theme-*, fallback)`，在思源内由宿主提供这套
 * 变量；组件库被复制到普通 Vue 3 项目后没有宿主变量，只能恒定走亮色 fallback。
 * 本模块在「宿主未提供主题变量」时注入一套开箱即用的明暗主题；宿主已提供时完全不注入。
 *
 * 三层保险（任一命中即不会污染宿主主题）：
 * 1. 检测：宿主已定义 --b3-theme-primary、或根元素带 b3-theme-* 类 → 直接跳过（思源内为 no-op）；
 * 2. 层叠层：注入内容包在 @layer 内 —— CSS 规定未分层样式恒优先于任何分层样式，
 *    即使注入也无法覆盖宿主已定义的同名变量；
 * 3. 插入位置：style 节点 prepend 到 document.head 首位，宿主后加载的样式天然胜出。
 *
 * 由 38 个公开组件以副作用导入（import "./kit/theme"）触发，模块级幂等。
 * SSR 安全：document 不存在时直接跳过。
 */

/** 注入节点 id（重复调用时复用同一节点，更新内容而非叠加） */
const STYLE_ID = "siyuan-kit-default-theme"

/** 层叠层名（@layer 内的声明永远输给宿主的未分层声明） */
const LAYER_NAME = "siyuan-kit-theme"

/** 明色默认值（键不含 -- 前缀）。两个 *-rgb 变量必须是逗号分隔：被 rgba(var(--x), a) 消费 */
const LIGHT_VARS: Record<string, string> = {
  "b3-theme-primary": "#3b82f6",
  "b3-theme-primary-rgb": "59, 130, 246",
  "b3-theme-on-primary": "#ffffff",
  "b3-theme-background": "#ffffff",
  "b3-theme-background-rgb": "255, 255, 255",
  "b3-theme-surface": "#f7f7f5",
  "b3-theme-surface-light": "#efefec",
  "b3-theme-surface-lighter": "#e8e8e4",
  "b3-theme-hover": "rgba(0, 0, 0, 0.06)",
  "b3-theme-on-background": "#1a1a1a",
  "b3-theme-on-surface": "#1a1a1a",
  "b3-theme-secondary": "#8a8a8a",
  "b3-border-color": "#e0deda",
  "b3-theme-border": "#e0deda",
  "b3-theme-outline": "#d9d7d3",
  "b3-theme-error": "#ef4444",
  "b3-theme-success": "#10b981",
  "b3-theme-warning": "#f59e0b",
  "b3-theme-info": "#3b82f6",
  // 兼容位：原宿主从未定义该变量，组件内有 4 处误用（Tag/Badge），此处与其余错误色对齐
  "b3-theme-destructive": "#ef4444",
}

/** 暗色默认值（与 LIGHT_VARS 一一对应） */
const DARK_VARS: Record<string, string> = {
  "b3-theme-primary": "#60a5fa",
  "b3-theme-primary-rgb": "96, 165, 250",
  "b3-theme-on-primary": "#0b1220",
  "b3-theme-background": "#1c1c1e",
  "b3-theme-background-rgb": "28, 28, 30",
  "b3-theme-surface": "#2c2c2e",
  "b3-theme-surface-light": "#232325",
  "b3-theme-surface-lighter": "#3a3a3c",
  "b3-theme-hover": "rgba(255, 255, 255, 0.08)",
  "b3-theme-on-background": "#ededed",
  "b3-theme-on-surface": "#ededed",
  "b3-theme-secondary": "#9a9a9a",
  "b3-border-color": "#3a3a3c",
  "b3-theme-border": "#3a3a3c",
  "b3-theme-outline": "#48484a",
  "b3-theme-error": "#f87171",
  "b3-theme-success": "#34d399",
  "b3-theme-warning": "#fbbf24",
  "b3-theme-info": "#60a5fa",
  "b3-theme-destructive": "#f87171",
}

/** 默认暗色触发条件：系统暗色偏好 + 两种常见的手动暗色挂载点 */
const DEFAULT_DARK_SELECTORS = [
  "@media (prefers-color-scheme: dark)",
  '[data-theme="dark"]',
  ".dark",
]

export interface ThemeOptions {
  /** 覆盖/追加变量（键不含 -- 前缀，带 -- 亦可），同时作用于明暗两套 */
  overrides?: Record<string, string>
  /** 追加暗色触发选择器（在默认三条之外） */
  extraDarkSelectors?: string[]
}

let applied = false

/** 宿主是否已提供思源主题变量 */
function hostProvidesTheme(): boolean {
  try {
    const root = document.documentElement
    if (root.className.includes("b3-theme-")) return true
    return getComputedStyle(root)
      .getPropertyValue("--b3-theme-primary")
      .trim().length > 0
  }
  catch {
    return false
  }
}

function varsToCss(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([key, value]) => `  --${key}: ${value};`)
    .join("\n")
}

function buildCss(light: Record<string, string>, dark: Record<string, string>, darkSelectors: string[]): string {
  const blocks = darkSelectors.map((selector) => {
    // @media 包一层 @media 块；普通选择器直接作选择器
    return selector.startsWith("@media")
      ? `${selector} {\n:root {\n${varsToCss(dark)}\n}\n}`
      : `${selector} {\n${varsToCss(dark)}\n}`
  })
  return [
    `@layer ${LAYER_NAME} {`,
    `:root {\n${varsToCss(light)}\n}`,
    ...blocks,
    "}",
  ].join("\n")
}

/** 注入后兜底复核：若宿主样式晚于本模块就绪（如异步加载），load 后检测到宿主主题则撤掉注入 */
function scheduleHostRecheck(node: HTMLStyleElement): void {
  const recheck = () => {
    if (hostProvidesTheme())
      node.remove()
  }
  if (document.readyState === "complete")
    window.setTimeout(recheck, 0)
  else
    window.addEventListener("load", recheck, { once: true })
}

/**
 * 应用默认主题（模块加载时已自动调用一次；重复调用幂等）。
 * 传 options 可强制更新（供目标项目注入品牌色等场景）。
 */
export function applyDefaultTheme(options?: ThemeOptions): void {
  if (typeof document === "undefined")
    return

  // 无参调用 = 组件包自动初始化：宿主已有主题则绝不出手
  if (options === undefined) {
    if (applied || hostProvidesTheme()) {
      applied = true
      return
    }
  }

  const overrides = options?.overrides ?? {}
  const light = { ...LIGHT_VARS, ...overrides }
  const dark = { ...DARK_VARS, ...overrides }
  const darkSelectors = [...DEFAULT_DARK_SELECTORS, ...(options?.extraDarkSelectors ?? [])]

  let node = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!node) {
    node = document.createElement("style")
    node.id = STYLE_ID
    document.head.prepend(node)
    scheduleHostRecheck(node)
  }
  node.textContent = buildCss(light, dark, darkSelectors)
  applied = true
}

// 副作用：被组件 import 时自动应用一次
applyDefaultTheme()
