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
  buildDecorCss(c: StyleColors): string
}
