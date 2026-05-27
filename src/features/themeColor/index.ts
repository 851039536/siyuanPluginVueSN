/**
 * 全局主题色功能模块
 *
 * 通过覆盖思源笔记 CSS 变量实现全局主题色切换。
 * 采用多主题方案架构，扩展新主题只需在 THEMES 中注册。
 */
import type { Plugin } from "siyuan"

export interface ThemeColorScheme {
  id: string
  name: string
  primary: string
  primaryRgb: string
}

/**
 * 主题方案注册表
 * 新增主题只需在此对象中添加条目
 */
export const THEMES: Record<string, ThemeColorScheme> = {
  orange: {
    id: "orange",
    name: "暖橙色",
    primary: "#d97757",
    primaryRgb: "217, 119, 87",
  },
  github: {
    id: "github",
    name: "GitHub 蓝",
    primary: "#0969da",
    primaryRgb: "9, 105, 218",
  },
  sakura: {
    id: "sakura",
    name: "樱花动漫",
    primary: "#ff91a4",
    primaryRgb: "255, 145, 164",
  },
  mono: {
    id: "mono",
    name: "灰白动漫",
    primary: "#8e99a4",
    primaryRgb: "142, 153, 164",
  },
}

/**
 * 默认主题方案 ID
 */
export const DEFAULT_THEME_SCHEME = "orange"

function applyTheme(scheme: ThemeColorScheme) {
  document.documentElement.style.setProperty("--b3-theme-primary", scheme.primary)
  document.documentElement.style.setProperty("--b3-theme-primary-rgb", scheme.primaryRgb)
}

function removeTheme() {
  document.documentElement.style.removeProperty("--b3-theme-primary")
  document.documentElement.style.removeProperty("--b3-theme-primary-rgb")
}

export function registerThemeColor(_plugin: Plugin, schemeId?: string) {
  const scheme = THEMES[schemeId || DEFAULT_THEME_SCHEME] || THEMES[DEFAULT_THEME_SCHEME]
  applyTheme(scheme)

  return {
    destroy: () => {
      removeTheme()
    },
  }
}
