import type { FloatingTool } from "../types"
import { emitCustomEvent } from "@/utils/eventBus"

export function createSuperPanelTool(plugin?: any): FloatingTool {
  return {
    id: "superPanel",
    label: plugin?.i18n?.floatingBox?.superPanel || "超级面板",
    title: plugin?.i18n?.floatingBox?.superPanelTitle || "打开超级面板",
    icon: "mdi:view-dashboard",
    bgColor: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
    action: () => {
      emitCustomEvent("toggleSuperPanel")
    },
  }
}
