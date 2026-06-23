import type { FloatingTool } from "../types"
import { emitCustomEvent } from "@/utils/eventBus"

export function createTextDiffTool(plugin?: any): FloatingTool {
  return {
    id: "textDiff",
    label: plugin?.i18n?.floatingBox?.textDiff || "文本对比",
    title: plugin?.i18n?.floatingBox?.textDiffTitle || "打开文本对比工具",
    icon: "mdi:file-compare-outline",
    bgColor: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    action: () => {
      emitCustomEvent("openTextDiff")
    },
  }
}
