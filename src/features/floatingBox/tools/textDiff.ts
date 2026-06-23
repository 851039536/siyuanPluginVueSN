import type { Plugin } from "siyuan"
import type { FloatingTool } from "../types"
import { emitCustomEvent } from "@/utils/eventBus"

export function createTextDiffTool(plugin: Plugin): FloatingTool {
  const i18n = (plugin.i18n as any)?.floatingBox || {}
  return {
    id: "textDiff",
    label: i18n.textDiff || "文本对比",
    title: i18n.textDiffTitle || "打开文本对比工具",
    icon: "mdi:file-compare-outline",
    bgColor: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    action: () => {
      emitCustomEvent("openTextDiff")
    },
  }
}
