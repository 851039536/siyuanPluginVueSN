/**
 * 主题色功能模块类型定义
 */

/** 主题方案接口 */
export interface ThemeColorScheme {
  /** 主题显示名称 */
  name: string
  /** 主色 hex 值，如 "#d97757"，RGB 由 hexToRgb() 自动推导 */
  primary: string
}
