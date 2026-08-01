// ============================================================
// 封面风格共享：类型定义 + 标签样式助手（无依赖，供各风格文件引用）
// ============================================================

/** 封面尺寸预设 */
export interface CoverSizePreset {
  label: string
  width: number
  height: number
}

/** 封面风格预设（注册表派生的精简投影） */
export interface CoverStylePreset {
  id: string
  label: string
  description: string
}

/** 风格颜色主题 */
export interface StyleColors {
  bg: string
  titleColor: string
  subtitleColor: string
  accent: string
  accentAlt: string
}

/** 封面风格定义（单一数据源：colors + decorHtml + buildDecorCss 三位一体） */
export interface StyleDefinition {
  id: string
  label: string
  description: string
  colors: StyleColors
  decorHtml: string
  /** 构建完整装饰 CSS（含标签样式），由注册表引擎传入 this.colors */
  buildDecorCss: (c: StyleColors) => string
}

/** 生成 .tag 基础样式（各风格共享的 tag 颜色循环） */
export function tagCommonStyles(mode: string): string {
  if (mode === "minimal" || mode === "chinese") {
    return [
      `.tag { background:transparent !important; border-radius:4px !important; letter-spacing:1px; }`,
      `.tag:nth-child(5n+1) { color:#e74c3c !important; border:1.5px solid #e74c3c50; }`,
      `.tag:nth-child(5n+2) { color:#27ae60 !important; border-color:#27ae6050; }`,
      `.tag:nth-child(5n+3) { color:#2980b9 !important; border-color:#2980b950; }`,
      `.tag:nth-child(5n+4) { color:#e67e22 !important; border-color:#e67e2250; }`,
      `.tag:nth-child(5n+5) { color:#8e44ad !important; border-color:#8e44ad50; }`,
    ].join("\n    ")
  }
  if (mode === "tech") {
    return [
      `.tag { border-radius:3px !important; letter-spacing:1px; text-transform:uppercase; }`,
      `.tag:nth-child(5n+1) { color:#e74c3c !important; border:1px solid #e74c3c50; box-shadow:0 0 12px #e74c3c30, inset 0 0 6px #e74c3c10; background:#e74c3c15 !important; }`,
      `.tag:nth-child(5n+2) { color:#27ae60 !important; border-color:#27ae6050; box-shadow:0 0 12px #27ae6030, inset 0 0 6px #27ae6010; background:#27ae6015 !important; }`,
      `.tag:nth-child(5n+3) { color:#2980b9 !important; border-color:#2980b950; box-shadow:0 0 12px #2980b930, inset 0 0 6px #2980b910; background:#2980b915 !important; }`,
      `.tag:nth-child(5n+4) { color:#e67e22 !important; border-color:#e67e2250; box-shadow:0 0 12px #e67e2230, inset 0 0 6px #e67e2210; background:#e67e2215 !important; }`,
      `.tag:nth-child(5n+5) { color:#8e44ad !important; border-color:#8e44ad50; box-shadow:0 0 12px #8e44ad30, inset 0 0 6px #8e44ad10; background:#8e44ad15 !important; }`,
    ].join("\n    ")
  }
  if (mode === "drawio") {
    return `.tag { border-radius:3px !important; }`
  }
  // magazine
  return `.tag { border-radius:2px !important; font-style:italic; background:transparent !important; padding:4px 14px !important; letter-spacing:0.5px; }`
}

/** 生成需要颜色上下文的 .tag 差异样式（drawio/magazine 需 c.titleColor） */
export function tagColoredStyles(mode: string, c: StyleColors): string {
  if (mode === "drawio") {
    return [
      `.tag:nth-child(5n+1) { color:${c.titleColor} !important; background:#e74c3c08 !important; border:1px solid #e74c3c25; border-left:3px solid #e74c3c; }`,
      `.tag:nth-child(5n+2) { border-left-color:#27ae60; background:#27ae6008 !important; border-color:#27ae6025; }`,
      `.tag:nth-child(5n+3) { border-left-color:#2980b9; background:#2980b908 !important; border-color:#2980b925; }`,
      `.tag:nth-child(5n+4) { border-left-color:#e67e22; background:#e67e2208 !important; border-color:#e67e2225; }`,
      `.tag:nth-child(5n+5) { border-left-color:#8e44ad; background:#8e44ad08 !important; border-color:#8e44ad25; }`,
    ].join("\n    ")
  }
  if (mode === "magazine") {
    return [
      `.tag:nth-child(5n+1) { color:${c.titleColor} !important; border-bottom:2px solid #e74c3c; }`,
      `.tag:nth-child(5n+2) { border-bottom-color:#27ae60; }`,
      `.tag:nth-child(5n+3) { border-bottom-color:#2980b9; border-bottom-width:3px; }`,
      `.tag:nth-child(5n+4) { border-bottom-color:#e67e22; }`,
      `.tag:nth-child(5n+5) { border-bottom-color:#8e44ad; border-bottom-style:dotted; }`,
    ].join("\n    ")
  }
  return ""
}
