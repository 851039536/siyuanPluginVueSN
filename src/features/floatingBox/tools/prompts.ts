/**
 * 提示词库工具 — 悬浮框快捷入口，点击派发 openPrompts 事件
 */
import type { Plugin } from "siyuan"
import type { FloatingTool } from "../types"
import { emitCustomEvent } from "@/utils/eventBus"

export function createPromptsTool(plugin: Plugin): FloatingTool {
  const i18n = (plugin.i18n as any)?.floatingBox || {}
  return {
    id: "prompts",
    label: i18n.prompts || "Prompts",
    title: i18n.promptsTitle || "提示词库",
    icon: "mdi:star",
    bgColor: "#667eea",
    action: () => {
      emitCustomEvent("openPrompts")
    },
  }
}
