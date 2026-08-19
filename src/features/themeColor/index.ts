/**
 * 全局主题色功能模块
 *
 * 通过覆盖思源笔记 CSS 变量实现全局主题色切换。
 * 采用多主题方案架构，扩展新主题只需在 THEMES 中注册。
 */
import type { ThemeColorScheme } from "./types"

export type {
  HexColor,
  ThemeColorScheme,
} from "./types"

/** 将 #RRGGBB 格式转为 "R, G, B" 格式的 RGB 字符串 */
function hexToRgb(hex: string): string {
  const rgb = parseHexColor(hex)
  return `${rgb.r}, ${rgb.g}, ${rgb.b}`
}

/** 解析并校验 #RRGGBB 颜色，非法输入直接抛错，避免产出 NaN CSS */
function parseHexColor(hex: string): { r: number, g: number, b: number } {
  const match = /^#([\da-f]{6})$/i.exec(hex)
  if (!match) {
    throw new Error(`[themeColor] 无效的主色值: ${hex}`)
  }
  const value = match[1]
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  }
}

/** 将主色与白色按比例混合，用于生成 light / lightest 衍生色 */
function mixWithWhite(hex: string, ratio: number): string {
  const {
    r,
    g,
    b,
  } = parseHexColor(hex)
  const mix = (channel: number): number => Math.round(channel + (255 - channel) * ratio)
  const toHex = (value: number): string => value.toString(16).padStart(2, "0")
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`
}

/** 根据主色亮度决定 on-primary 文字色（浅色主色用深色文字，深色主色用白色文字） */
function getOnPrimaryColor(hex: string): string {
  const {
    r,
    g,
    b,
  } = parseHexColor(hex)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? "#000000" : "#ffffff"
}

/**
 * 主题方案注册表
 * 新增主题只需在此对象中添加条目，键名即为方案 ID
 */
export const THEMES = {
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
    primary: "#8b5cf6",
  },
} as const satisfies Record<string, ThemeColorScheme>

/** 主题方案 ID 联合类型，由 THEMES 自动推导 */
export type ThemeColorSchemeId = keyof typeof THEMES

/** 判断字符串是否为合法的主题方案 ID */
export function isThemeColorSchemeId(value: string): value is ThemeColorSchemeId {
  return Object.prototype.hasOwnProperty.call(THEMES, value)
}

/**
 * 默认主题方案 ID
 */
export const DEFAULT_THEME_SCHEME: ThemeColorSchemeId = "orange"

/** 解析方案 ID：非法/未知 ID 回退默认主题，并输出警告便于排查 */
export function resolveThemeScheme(schemeId?: ThemeColorSchemeId | string): ThemeColorScheme {
  if (schemeId) {
    if (Object.prototype.hasOwnProperty.call(THEMES, schemeId)) {
      return THEMES[schemeId as ThemeColorSchemeId]
    }
    console.warn(`[themeColor] 未知主题方案: "${schemeId}"，已回退到默认主题`)
  }
  return THEMES[DEFAULT_THEME_SCHEME]
}

function applyTheme(scheme: ThemeColorScheme): void {
  const style = document.documentElement.style
  const primary = scheme.primary
  const rgb = hexToRgb(primary)

  style.setProperty("--b3-theme-primary", primary)
  style.setProperty("--b3-theme-primary-rgb", rgb)
  style.setProperty("--b3-theme-primary-light", mixWithWhite(primary, 0.15))
  style.setProperty("--b3-theme-primary-lightest", mixWithWhite(primary, 0.3))
  style.setProperty("--b3-theme-on-primary", getOnPrimaryColor(primary))
}

function clearTheme(): void {
  const style = document.documentElement.style
  style.removeProperty("--b3-theme-primary")
  style.removeProperty("--b3-theme-primary-rgb")
  style.removeProperty("--b3-theme-primary-light")
  style.removeProperty("--b3-theme-primary-lightest")
  style.removeProperty("--b3-theme-on-primary")
}

export interface ThemeColorInstance {
  destroy: () => void
}

export function registerThemeColor(schemeId?: ThemeColorSchemeId | string): ThemeColorInstance {
  const scheme = resolveThemeScheme(schemeId)
  applyTheme(scheme)

  return {
    destroy: () => {
      clearTheme()
    },
  }
}
