import type { Plugin } from "siyuan"
import type { ToolbarAction } from "../types"
import { pushMsg } from "@/api"
import { emitCustomEvent } from "@/utils/eventBus"

/**
 * 防抖函数
 * @param fn 要执行的函数
 * @param delay 延迟时间（毫秒）
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      fn(...args)
      timeoutId = null
    }, delay)
  }
}

/**
 * 通知消息选项
 */
interface MessageOptions {
  timeout?: number
  type?: "info" | "error" | "success"
}

/**
 * 显示通知消息
 * @param message 消息内容
 * @param options 消息选项
 */
export function showMessage(
  message: string,
  options: MessageOptions = {},
): void {
  const {
    timeout = 3000,
    type = "info",
  } = options

  pushMsg(message, timeout, type).catch((error) => {
    console.error("Failed to show message:", error)
  })
}

/**
 * 显示插件国际化消息
 * @param plugin 插件实例
 * @param key 国际化键
 * @param defaultMessage 默认消息
 * @param timeout 显示时长
 */
export function showI18nMessage(
  plugin: Plugin,
  key: string,
  defaultMessage: string,
  timeout?: number,
): void {
  // 安全地访问嵌套属性
  const i18n = plugin.i18n as Record<string, unknown> | undefined
  const floatingToolbar = i18n?.floatingToolbar as
    | Record<string, string>
    | undefined
  const message = floatingToolbar?.[key] || defaultMessage

  showMessage(message, { timeout })
}

/**
 * 派发自定义事件打开对话框
 * @param eventName 事件名称
 * @param content 对话框内容
 */
export function dispatchDialogEvent(eventName: string, content: string): void {
  emitCustomEvent(eventName, { content }, { useMicrotask: true })
}

/**
 * 获取当前选中的块ID
 * 使用多种策略确保准确获取
 */
export function getSelectedBlockId(): string | null {
  // 策略1: 获取多选块
  const selectedBlock = document.querySelector(
    ".protyle-wysiwyg--select[data-node-id]",
  )
  if (selectedBlock) {
    return selectedBlock.getAttribute("data-node-id")
  }

  // 策略2: 获取聚焦块
  const focusedBlock = document.querySelector(
    ".protyle-wysiwyg [data-node-id].protyle-wysiwyg--focus",
  )
  if (focusedBlock) {
    return focusedBlock.getAttribute("data-node-id")
  }

  // 策略3: 通过选择范围精确查找
  const selection = window.getSelection()
  if (!selection?.rangeCount) {
    return null
  }

  const range = selection.getRangeAt(0)
  let node: Node | null = range.startContainer

  while (node) {
    if (node instanceof Element) {
      const nodeId = node.getAttribute("data-node-id")
      const dataType = node.getAttribute("data-type")

      if (nodeId && dataType) {
        return nodeId
      }
    }
    node = node.parentNode
  }

  return null
}

/**
 * 检测是否为英文文本（超过50%英文字符）
 * @param text 待检测文本
 * @returns 是否为英文文本
 */
export function isEnglishText(text: string): boolean {
  if (!text || typeof text !== "string") {
    return false
  }

  const trimmedText = text.trim()
  if (!trimmedText) {
    return false
  }

  const englishChars = trimmedText.match(/[a-z]/gi)
  const totalChars = trimmedText.replace(/\s/g, "").length

  return englishChars !== null && englishChars.length > totalChars * 0.5
}

/**
 * 安全地获取插件国际化文本
 * @param plugin 插件实例
 * @param path 国际化路径，如 'floatingToolbar.copy'
 * @param defaultValue 默认值
 * @returns 国际化文本
 */
export function getI18nText(
  plugin: Plugin | undefined,
  path: string,
  defaultValue: string,
): string {
  if (!plugin?.i18n) {
    return defaultValue
  }

  const keys = path.split(".")
  let value: unknown = plugin.i18n

  for (const key of keys) {
    if (value && typeof value === "object" && key in value) {
      value = (value as Record<string, unknown>)[key]
    } else {
      return defaultValue
    }
  }

  return typeof value === "string" ? value : defaultValue
}

/**
 * 对话框 Action 配置
 */
export interface DialogActionConfig {
  /** 功能唯一标识符 */
  id: string
  /** 国际化键名 */
  i18nKey: string
  /** 默认名称 */
  defaultMessage: string
  /** SVG 图标 */
  icon: string
  /** 要派发的事件名称 */
  eventName: string
}

/**
 * 创建对话框类型 Action 的工厂函数
 * 统一创建打开对话框类型的工具栏功能
 * @param plugin 插件实例
 * @param config 对话框配置
 * @returns ToolbarAction
 */
export function createDialogAction(
  plugin: Plugin,
  config: DialogActionConfig,
): ToolbarAction {
  const {
    id,
    i18nKey,
    defaultMessage,
    icon,
    eventName,
  } = config

  return {
    id,
    name:
      (plugin.i18n as Record<string, any>)?.floatingToolbar?.[i18nKey]
      || defaultMessage,
    icon,
    handler: async (selectedText: string) => {
      if (!selectedText) {
        showI18nMessage(plugin, "noTextSelected", "未选中文本")
        return
      }
      dispatchDialogEvent(eventName, selectedText)
    },
  }
}
