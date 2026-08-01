// ============================================================
// 图片生成相关类型 + 共享常量（纯类型/配置表，不含 register 逻辑）
// 含：封面生成类型、代码图片类型、封面偏好设置类型、图片生成 i18n 键接口
// 风格注册表见 types/coverStyles.ts（本文件 re-export）
// ============================================================

export type CoverGenerationStatus = "idle" | "generating" | "done" | "error"

export interface CoverGenerationConfig {
  title: string
  category: string
  keywords: string
  width: number
  height: number
  styleId: string
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

// ============================================================
// 封面偏好设置类型（持久化结构见 types/storage.ts 的 CoverSettings）
// ============================================================

/** 水印位置 */
export type WatermarkPosition = "bottomLeft" | "bottomRight" | "topLeft" | "topRight" | "center"

/** Logo 角标位置 */
export type LogoPosition = "topLeft" | "topRight" | "bottomLeft" | "bottomRight"

/** 导出图片格式 */
export type ExportFormat = "png" | "jpeg" | "webp"

/** 主题色全局覆盖层 */
export interface CoverColorOverrides {
  enabled: boolean
  bg: string
  titleColor: string
  accent: string
}

/** 水印设置 */
export interface CoverWatermarkSettings {
  enabled: boolean
  text: string
  position: WatermarkPosition
  opacity: number
}

/** Logo 角标设置 */
export interface CoverLogoSettings {
  enabled: boolean
  /** 工作区 assets 路径（storage/petal/<plugin>/cover/...），空 = 未设置 */
  path: string
  position: LogoPosition
  size: number
  opacity: number
}

// ============================================================
// 图片生成 i18n 键接口（对应 src/i18n/*/imageCreation.json 的 imageCreation 命名空间）
// ============================================================

export interface ImageCreationI18n {
  title: string
  coverTitle: string
  codeImageTitle: string
  coverTab: string
  codeImageTab: string
  coverTitleLabel: string
  coverTitlePlaceholder: string
  categoryLabel: string
  categoryHint: string
  categoryPlaceholder: string
  contentSummaryLabel: string
  contentSummaryHint: string
  contentSummaryPlaceholder: string
  aiExtract: string
  aiExtracting: string
  aiAutoCover: string
  aiAutoRunning: string
  aiAutoParseFailed: string
  keywordsLabel: string
  keywordsHint: string
  keywordsPlaceholder: string
  sizeLabel: string
  widthPlaceholder: string
  heightPlaceholder: string
  styleLabel: string
  generateCover: string
  refreshCover: string
  shuffleStyle: string
  previewTitle: string
  copyImage: string
  downloadImage: string
  fullscreenPreview: string
  previewEmpty: string
  previewEmptyHint: string
  errorTitleRequired: string
  errorGenerateFailed: string
  msgKeywordsExtracted: string
  msgAiFailed: string
  msgNothingToCopy: string
  msgCoverCopied: string
  msgCopiedFallback: string
  msgCopyFailed: string
  msgNothingToDownload: string
  msgCoverDownloaded: string
  msgDownloadFailed: string
  decorationSettings: string
  colorGroup: string
  colorEnable: string
  colorBg: string
  colorTitle: string
  colorAccent: string
  colorReset: string
  watermarkGroup: string
  positionLabel: string
  positionBottomLeft: string
  positionBottomRight: string
  positionTopLeft: string
  positionTopRight: string
  positionCenter: string
  opacityLabel: string
  logoGroup: string
  logoEnable: string
  logoUpload: string
  logoRemove: string
  logoSize: string
  logoEmptyHint: string
  formatPng: string
  formatJpeg: string
  formatWebp: string
  jpegQualityLabel: string
  msgLogoTypeInvalid: string
  msgLogoUploadFailed: string
  msgLogoRemoved: string
  logoLoadFailed: string
  contentTypeLabel: string
  modeCode: string
  modeText: string
  codeContentLabel: string
  textContentLabel: string
  codePlaceholder: string
  textPlaceholder: string
  codeInputHint: string
  languageLabel: string
  codeStyleLabel: string
  themeLabel: string
  fontSizeLabel: string
  decorationsLabel: string
  showWatermark: string
  watermarkTextPlaceholder: string
  showAuthor: string
  authorPlaceholder: string
  showTimestamp: string
  advancedStyles: string
  borderWidth: string
  borderRadius: string
  paddingSize: string
  backgroundOpacity: string
  shadowIntensity: string
  preview: string
  textEmptyHint: string
  msgCopied: string
  msgDownloaded: string
  styleCartoon: string
  styleWave: string
  styleGlass: string
  styleNeon: string
  style3d: string
  textStyleQuote: string
  textStylePoetry: string
  textStyleNote: string
  textStylePoster: string
  textStyleCard: string
  textStyleNewspaper: string
  textStyleGradient: string
  themeLight: string
  themeDark: string
}

// ============================================================
// 风格注册表 re-export（定义见 types/coverStyles.ts）
// ============================================================

export type {
  CoverSizePreset,
  CoverStylePreset,
  StyleColors,
  StyleDefinition,
} from "./coverStyles"
export {
  COVER_FONT_FAMILY,
  COVER_SIZE_PRESETS,
  COVER_STYLE_PRESETS,
  COVER_STYLE_REGISTRY,
} from "./coverStyles"
