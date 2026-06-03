/**
 * 排版助手功能模块
 * 将 Markdown 文档转换为微信公众号等平台的富文本格式
 */
import type { Plugin } from "siyuan"
import { FormatAssistantManager } from "./types"

/**
 * 注册排版助手功能
 */
export function registerFormatAssistant(plugin: Plugin): FormatAssistantManager {
  const manager = new FormatAssistantManager(plugin);
  (plugin as any).__formatAssistant = manager
  return manager
}

