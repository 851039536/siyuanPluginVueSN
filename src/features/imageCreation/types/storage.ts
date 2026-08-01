// ============================================================
// 封面偏好设置持久化存储（TypedStorage 槽位）
// 仅持久化偏好设置；标题/分类/关键字等文档内容不持久化
// ============================================================

import type { Plugin } from "siyuan"
import type {
  CoverColorOverrides,
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

/** 图片生成功能持久化存储 */
export class ImageCreationStorage {
  /** 封面偏好设置 */
  readonly cover: TypedStorage<CoverSettings>

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin)
    this.cover = new TypedStorage(storage, "image-creation-cover-settings", DEFAULT_COVER_SETTINGS)
  }
}
