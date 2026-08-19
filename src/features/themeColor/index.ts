/**
 * 全局主题色功能模块
 *
 * 通过覆盖思源笔记 CSS 变量实现全局主题色切换。
 * 采用多主题方案架构，扩展新主题只需在 THEMES 中注册。
 */
import type {
  HexColor,
  ThemeColorScheme,
} from "./types"

export type {
  HexColor,
  ThemeColorScheme,
} from "./types"

/** 主题色覆盖的 CSS 变量清单 */
const THEME_CSS_VARIABLES = [
  "--b3-theme-primary",
  "--b3-theme-primary-rgb",
  "--b3-theme-primary-light",
  "--b3-theme-primary-lightest",
  "--b3-theme-on-primary",
] as const

type ThemeCssVariable = typeof THEME_CSS_VARIABLES[number]

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

/** 将主色转为 rgba() 半透明色，用于生成 light / lightest 浅背景 */
function rgbaWithAlpha(hex: string, alpha: number): string {
  const {
    r,
    g,
    b,
  } = parseHexColor(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
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

/** 判断当前是否为思源暗色模式 */
function isDarkMode(): boolean {
  const html = document.documentElement
  return html.getAttribute("data-theme-mode") === "dark"
    || html.classList.contains("theme-dark")
    || html.classList.contains("b3-theme-dark")
}

/**
 * 主题方案注册表
 * 新增主题只需在此对象中添加条目，键名即为方案 ID
 */
export const THEMES = {
  orange: {
    name: "暖橙色",
    primary: "#d97757",
    darkPrimary: "#c96442",
  },
  github: {
    name: "GitHub 蓝",
    primary: "#0969da",
    darkPrimary: "#58a6ff",
  },
  sakura: {
    name: "樱花动漫",
    primary: "#ff91a4",
    darkPrimary: "#ff6f91",
  },
  codex: {
    name: "Codex",
    primary: "#8b5cf6",
    darkPrimary: "#a78bfa",
  },
} as const satisfies Record<string, ThemeColorScheme>

/** 内置主题方案 ID（THEMES 中的键） */
export type BuiltInThemeColorSchemeId = keyof typeof THEMES

/** 主题方案 ID 联合类型：内置主题 + 用户自定义 */
export type ThemeColorSchemeId = BuiltInThemeColorSchemeId | "custom"

/** 判断字符串是否为合法的主题方案 ID */
export function isThemeColorSchemeId(value: string): value is ThemeColorSchemeId {
  return value === "custom" || Object.prototype.hasOwnProperty.call(THEMES, value)
}

/**
 * 默认主题方案 ID
 */
export const DEFAULT_THEME_SCHEME: BuiltInThemeColorSchemeId = "orange"

/** 解析方案 ID：非法/未知 ID 回退默认主题，并输出警告便于排查 */
export function resolveThemeScheme(schemeId?: ThemeColorSchemeId | string, customColor?: string): ThemeColorScheme {
  if (schemeId === "custom") {
    const primary = customColor && /^#[\da-f]{6}$/i.test(customColor)
      ? customColor.toLowerCase() as HexColor
      : THEMES[DEFAULT_THEME_SCHEME].primary
    return {
      name: "自定义",
      primary,
    }
  }
  if (schemeId) {
    if (Object.prototype.hasOwnProperty.call(THEMES, schemeId)) {
      return THEMES[schemeId as BuiltInThemeColorSchemeId]
    }
    console.warn(`[themeColor] 未知主题方案: "${schemeId}"，已回退到默认主题`)
  }
  return THEMES[DEFAULT_THEME_SCHEME]
}

/** 根据当前模式选择主色 */
function resolvePrimaryColor(scheme: ThemeColorScheme): string {
  return isDarkMode() ? (scheme.darkPrimary || scheme.primary) : scheme.primary
}

/** 保存当前 CSS 变量的原始值，destroy 时恢复 */
function getPreviousThemeValues(): Record<ThemeCssVariable, string> {
  const style = document.documentElement.style
  return {
    "--b3-theme-primary": style.getPropertyValue("--b3-theme-primary"),
    "--b3-theme-primary-rgb": style.getPropertyValue("--b3-theme-primary-rgb"),
    "--b3-theme-primary-light": style.getPropertyValue("--b3-theme-primary-light"),
    "--b3-theme-primary-lightest": style.getPropertyValue("--b3-theme-primary-lightest"),
    "--b3-theme-on-primary": style.getPropertyValue("--b3-theme-on-primary"),
  }
}

/** 恢复 CSS 变量原始值；原本不存在则移除 */
function restoreThemeValues(previous: Record<ThemeCssVariable, string>): void {
  const style = document.documentElement.style
  for (const key of THEME_CSS_VARIABLES) {
    const value = previous[key]
    if (value) {
      style.setProperty(key, value)
    } else {
      style.removeProperty(key)
    }
  }
}

function applyTheme(scheme: ThemeColorScheme): void {
  const style = document.documentElement.style
  const primary = resolvePrimaryColor(scheme)
  const rgb = hexToRgb(primary)

  style.setProperty("--b3-theme-primary", primary)
  style.setProperty("--b3-theme-primary-rgb", rgb)
  style.setProperty("--b3-theme-primary-light", rgbaWithAlpha(primary, 0.12))
  style.setProperty("--b3-theme-primary-lightest", rgbaWithAlpha(primary, 0.06))
  style.setProperty("--b3-theme-on-primary", getOnPrimaryColor(primary))
}

export interface ThemeColorInstance {
  destroy: () => void
}

export function registerThemeColor(schemeId?: ThemeColorSchemeId | string, customColor?: string): ThemeColorInstance {
  const scheme = resolveThemeScheme(schemeId, customColor)
  const previous = getPreviousThemeValues()
  applyTheme(scheme)

  // 监听思源亮/暗模式切换，自动重应用当前主题色
  const observer = new MutationObserver(() => {
    applyTheme(scheme)
  })
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme-mode", "class"],
  })

  return {
    destroy: () => {
      observer.disconnect()
      restoreThemeValues(previous)
    },
  }
}
