/**
 * 悬浮框通用工具工厂函数 — 事件派发类工具的创建模板
 * 适用于仅需派发 CustomEvent、无子菜单的简单工具，消除四个工厂文件间的重复代码
 */
import type { Plugin } from "siyuan"
import type { FloatingTool } from "../types"
import { emitCustomEvent } from "@/utils/eventBus"

export interface EventDispatchToolConfig {
  /** 工具唯一标识 */
  id: string
  /** i18n 键前缀（不含 label/title 后缀），从 plugin.i18n.floatingBox 读取 */
  i18nKey: string
  /** i18n 缺失时的默认标签 */
  defaultLabel: string
  /** i18n 缺失时的默认提示标题 */
  defaultTitle: string
  /** Iconify 图标名 */
  icon: string
  /** 图标背景色（CSS 值） */
  bgColor: string
  /** 点击时派发的 CustomEvent 名称 */
  eventName: string
}

/**
 * 创建仅派发事件的工具项
 * 读取 plugin.i18n.floatingBox 作为翻译源，缺失时使用配置的默认值回退
 */
export function createEventDispatchTool(
  plugin: Plugin,
  config: EventDispatchToolConfig,
): FloatingTool {
  const i18n = (plugin.i18n as any)?.floatingBox || {}
  return {
    id: config.id,
    label: i18n[config.i18nKey] || config.defaultLabel,
    title: i18n[`${config.i18nKey}Title`] || config.defaultTitle,
    icon: config.icon,
    bgColor: config.bgColor,
    action: () => {
      emitCustomEvent(config.eventName)
    },
  }
}
