// ============================================================
// 封面生成相关类型（纯类型定义，不含运行时逻辑）
// ============================================================

export interface CoverSizePreset {
  label: string
  width: number
  height: number
}

export interface CoverStylePreset {
  id: string
  label: string
  description: string
}

export type CoverGenerationStatus = "idle" | "generating" | "done" | "error"

export interface CoverGenerationConfig {
  title: string
  category: string
  keywords: string
  watermark: string
  width: number
  height: number
  styleId: string
}

// ============================================================
// 风格注册表类型
// ============================================================

/** 风格颜色主题 */
export interface StyleColors {
  bg: string
  titleColor: string
  subtitleColor: string
  accent: string
  accentAlt: string
}

/** 封面风格定义（单一数据源，colors + decorHtml + buildDecorCss 三位一体） */
export interface StyleDefinition {
  id: string
  label: string
  description: string
  colors: StyleColors
  decorHtml: string
  /** 构建完整装饰 CSS（含标签样式），由注册表引擎传入 this.colors */
  buildDecorCss: (c: StyleColors) => string
}

// ============================================================
// 代码图片生成类型
// ============================================================

export type ContentType = "code" | "text"

export type CodeStyleId = "github" | "mac" | "cartoon" | "wave" | "glass" | "neon" | "3d"

export type TextStyleId = "quote" | "poetry" | "note" | "poster" | "card" | "newspaper" | "gradient"

export type ThemeType = "light" | "dark"

export type TabType = "cover" | "codeImage"

/** 装饰配置 */
export interface DecorationConfig {
  showDecorations: boolean
  enableWatermark: boolean
  watermarkText: string
  enableAuthor: boolean
  authorName: string
  enableTimestamp: boolean
  borderWidth: number
  borderRadius: number
  paddingSize: number
  backgroundOpacity: number
  shadowIntensity: number
}

/** 代码图片生成器默认值 */
export const CODE_IMAGE_DEFAULTS = Object.freeze({
  fontSize: 14,
  borderWidth: 1,
  borderRadius: 8,
  paddingSize: 16,
  backgroundOpacity: 100,
  shadowIntensity: 50,
  watermarkText: "SiYuan Notes",
  selectedLanguage: "javascript" as const,
  selectedStyle: "github" as const,
  selectedTheme: "light" as const,
  scaleMultiplier: 3,
  messageDuration: 3000,
})
