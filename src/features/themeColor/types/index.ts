/**
 * 主题色功能模块类型定义
 */

/** 主色 hex 值，如 "#d97757" */
export type HexColor = `#${string}`

/** 主题方案接口 */
export interface ThemeColorScheme {
  /** 主题显示名称（默认名称，UI 层可优先使用 i18n） */
  name: string
  /** 主色 hex 值，RGB 由 hexToRgb() 自动推导 */
  primary: HexColor
  /** 暗色模式主色（可选，缺省时复用 primary） */
  darkPrimary?: HexColor
}
