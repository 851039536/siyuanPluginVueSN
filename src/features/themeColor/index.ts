/**
 * 全局主题色功能模块
 *
 * 通过覆盖思源笔记 CSS 变量实现全局主题色切换。
 * 采用多主题方案架构，扩展新主题只需在 THEMES 中注册。
 */
import type { Plugin } from "siyuan"

export interface ThemeColorScheme {
  /** 主题显示名称 */
  name: string
  /** 主色 hex 值，如 "#d97757"，RGB 由 hexToRgb() 自动推导 */
  primary: string
}

/** 将 #RRGGBB 格式转为 "R, G, B" 格式的 RGB 字符串 */
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}

/**
 * 主题方案注册表
 * 新增主题只需在此对象中添加条目，键名即为方案 ID
 */
export const THEMES: Record<string, ThemeColorScheme> = {
  orange: {
    name: "暖橙色",
    primary: "#d97757",
  },
  github: {
    name: "GitHub 蓝",
    primary: "#0969da",
  },
  sakura: {
    name: "樱花动漫",
    primary: "#ff91a4",
  },
  codex: {
    name: "Codex",
    primary: "#8B5CF6",
  },
}

/**
 * 默认主题方案 ID
 */
export const DEFAULT_THEME_SCHEME = "orange"

function applyTheme(scheme: ThemeColorScheme) {
  document.documentElement.style.setProperty("--b3-theme-primary", scheme.primary)
  document.documentElement.style.setProperty("--b3-theme-primary-rgb", hexToRgb(scheme.primary))
}

function clearTheme() {
  document.documentElement.style.removeProperty("--b3-theme-primary")
  document.documentElement.style.removeProperty("--b3-theme-primary-rgb")
}

export function registerThemeColor(_plugin: Plugin, schemeId?: string) {
  const scheme = THEMES[schemeId || DEFAULT_THEME_SCHEME] || THEMES[DEFAULT_THEME_SCHEME]
  applyTheme(scheme)

  return {
    destroy: () => {
      clearTheme()
    },
  }
}
