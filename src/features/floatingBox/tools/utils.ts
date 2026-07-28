/**
 * 悬浮框通用工具工厂函数 — 事件派发类工具的创建模板
 * 适用于仅需派发 CustomEvent、无子菜单的简单工具，消除各工厂文件间的重复代码
 */
import type { Plugin } from "siyuan"
import type { FloatingTool } from "../types"
import { emitCustomEvent } from "@/utils/eventBus"

/** 读取 floatingBox 模块的 i18n 分片（UI 文案唯一数据源，无硬编码兜底） */
export function getFloatingBoxI18n(plugin: Plugin): Record<string, string> {
  return (plugin.i18n as unknown as Record<string, Record<string, string>>).floatingBox ?? {}
}

export interface EventDispatchToolConfig {
  /** 工具唯一标识，同时作为 i18n 键前缀（label 取 id，title 取 `${id}Title`） */
  id: string
  /** Iconify 图标名 */
  icon: string
  /** 图标背景色（CSS 值） */
  bgColor: string
  /** 点击时派发的 CustomEvent 名称 */
  eventName: string
}

/**
 * 创建仅派发事件的工具项，文案直读 plugin.i18n.floatingBox
 */
export function createEventDispatchTool(
  plugin: Plugin,
  config: EventDispatchToolConfig,
): FloatingTool {
  const i18n = getFloatingBoxI18n(plugin)
  return {
    id: config.id,
    label: i18n[config.id],
    title: i18n[`${config.id}Title`],
    icon: config.icon,
    bgColor: config.bgColor,
    action: () => {
      emitCustomEvent(config.eventName)
    },
  }
}
