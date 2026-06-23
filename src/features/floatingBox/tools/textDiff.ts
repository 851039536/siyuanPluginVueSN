import type { FloatingTool } from "../types"
import { emitCustomEvent } from "@/utils/eventBus"

export function createTextDiffTool(plugin?: any): FloatingTool {
  return {
    id: "textDiff",
    label: plugin?.i18n?.floatingBox?.textDiff || "文本对比",
    title: plugin?.i18n?.floatingBox?.textDiffTitle || "打开文本对比工具",
    icon: '<path fill="currentColor" d="M3 3h8v2H3V3zm0 4h8v2H3V7zm0 4h8v2H3v-2zm10-6h4v2h-4v-2zm0 4h4v2h-4v-2zm0-8h4v2h-4V3zm0 8h4v2h-4v-2z"/>',
    bgColor: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    action: () => {
      emitCustomEvent("openTextDiff")
    },
  }
}
