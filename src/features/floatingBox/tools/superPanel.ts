import type { Plugin } from "siyuan"
import type { FloatingTool } from "../types"
import { emitCustomEvent } from "@/utils/eventBus"

export function createSuperPanelTool(plugin: Plugin): FloatingTool {
  const i18n = (plugin.i18n as any)?.floatingBox || {}
  return {
    id: "superPanel",
    label: i18n.superPanel || "超级面板",
    title: i18n.superPanelTitle || "打开超级面板",
    icon: "mdi:view-dashboard",
    bgColor: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
    action: () => {
      emitCustomEvent("toggleSuperPanel")
    },
  }
}
