import type { Plugin } from "siyuan"
import type { FloatingTool } from "../types"
import { emitCustomEvent } from "@/utils/eventBus"

export function createPromptsTool(plugin: Plugin): FloatingTool {
  const prompts = (plugin.i18n as any)?.prompts || {}
  return {
    id: "prompts",
    label: prompts.label || "Prompts",
    title: prompts.title || "提示词库",
    icon: "mdi:star",
    bgColor: "#667eea",
    action: () => {
      emitCustomEvent("openPrompts")
    },
  }
}
