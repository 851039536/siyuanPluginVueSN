// ============================================================
// 封面偏好设置持久化存储（TypedStorage 槽位）
// 仅持久化偏好设置；标题/分类/关键字等文档内容不持久化
// ============================================================

import type { Plugin } from "siyuan"
import type {
  CoverColorOverrides,
  CoverGenerationConfig,
  CoverLogoSettings,
  CoverWatermarkSettings,
  ExportFormat,
} from "./index"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"

/** 封面偏好设置 */
export interface CoverSettings {
  /** 上次使用的封面宽度（px） */
  width: number
  /** 上次使用的封面高度（px） */
  height: number
  /** 上次使用的风格 id */
  styleId: string
  /** 主题色全局覆盖层 */
  colors: CoverColorOverrides
  /** 水印设置 */
  watermark: CoverWatermarkSettings
  /** Logo 角标设置 */
  logo: CoverLogoSettings
  /** 导出图片格式 */
  exportFormat: ExportFormat
  /** JPEG 导出质量（0-1） */
  jpegQuality: number
}

/** 封面偏好设置默认值 */
export const DEFAULT_COVER_SETTINGS: CoverSettings = {
  width: 1200,
  height: 630,
  styleId: "minimal",
  colors: {
    enabled: false,
    bg: "#ffffff",
    titleColor: "#1a1a1a",
    accent: "#e74c3c",
  },
  watermark: {
    enabled: false,
    text: "",
    position: "bottomLeft",
    opacity: 35,
  },
  logo: {
    enabled: false,
    path: "",
    position: "bottomRight",
    size: 80,
    opacity: 100,
  },
  exportFormat: "png",
  jpegQuality: 0.9,
}

/** Logo 允许的文件扩展名（上传校验） */
export const LOGO_ALLOWED_EXTENSIONS = ["png", "jpg", "jpeg", "webp"] as const

/** 深拷贝偏好设置（默认值/合并/候选变体使用，避免嵌套对象共享引用） */
export function cloneCoverSettings(s: CoverSettings): CoverSettings {
  return {
    ...s,
    colors: { ...s.colors },
    watermark: { ...s.watermark },
    logo: { ...s.logo },
  }
}

/** 合并保存数据与默认值（新增字段有默认值兜底） */
export function mergeCoverSettings(saved: CoverSettings): CoverSettings {
  return {
    ...cloneCoverSettings(DEFAULT_COVER_SETTINGS),
    ...saved,
    colors: { ...DEFAULT_COVER_SETTINGS.colors, ...saved.colors },
    watermark: { ...DEFAULT_COVER_SETTINGS.watermark, ...saved.watermark },
    logo: { ...DEFAULT_COVER_SETTINGS.logo, ...saved.logo },
  }
}

/** 封面候选（AI 全自动封面的随机组合方案） */
export interface CoverCandidate {
  /** 候选标签（如 "AI 推荐" / "随机组合 1"） */
  label: string
  /** 候选封面 HTML */
  html: string
  /** 应用时写入的生成配置 */
  config: CoverGenerationConfig
  /** 应用时写入的偏好设置变体 */
  settings: CoverSettings
}

/** 图片生成功能持久化存储 */
export class ImageCreationStorage {
  /** 封面偏好设置 */
  readonly cover: TypedStorage<CoverSettings>

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin)
    this.cover = new TypedStorage(storage, "image-creation-cover-settings", DEFAULT_COVER_SETTINGS)
  }
}
