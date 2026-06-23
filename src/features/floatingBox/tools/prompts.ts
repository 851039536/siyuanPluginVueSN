import type { Plugin } from "siyuan"
import type { FloatingTool } from "../types"
import { emitCustomEvent } from "@/utils/eventBus"

export function createPromptsTool(plugin: Plugin): FloatingTool {
  const skills = (plugin.i18n as any)?.skills || {}
  return {
    id: "skills",
    label: skills.label || "Prompts",
    title: skills.title || "提示词库",
    icon: "mdi:star",
    bgColor: "#667eea",
    action: () => {
      emitCustomEvent("openPrompts")
    },
  }
}
