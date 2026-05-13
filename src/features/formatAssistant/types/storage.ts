import type { Plugin } from "siyuan"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"

/**
 * 排版助手输出目标类型
 */
export type FormatTarget = "wechat"

/**
 * 微信公众号主题
 */
export type WechatTheme = "default" | "green" | "orange" | "purple" | "blue"

/**
 * 排版助手设置接口
 */
export interface FormatAssistantSettings {
  /** 输出目标 */
  target: FormatTarget
  /** 微信公众号主题 */
  wechatTheme: WechatTheme
  /** 字体大小(px) */
  fontSize: number
  /** 行高倍数 */
  lineHeight: number
  /** 代码块是否高亮 */
  codeHighlight: boolean
}

/**
 * 默认排版助手设置
 */
export const DEFAULT_FORMAT_ASSISTANT_SETTINGS: FormatAssistantSettings = {
  target: "wechat",
  wechatTheme: "default",
  fontSize: 15,
  lineHeight: 1.75,
  codeHighlight: true,
}

/**
 * 排版助手存储管理类
 */
export class FormatAssistantStorage {
  readonly settings: TypedStorage<FormatAssistantSettings>

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin)
    this.settings = new TypedStorage(storage, "format-assistant-settings", DEFAULT_FORMAT_ASSISTANT_SETTINGS)
  }
}
