import type { FloatingTool } from "../types"
import { emitCustomEvent } from "@/utils/eventBus"

export function createPasswordVaultTool(plugin?: any): FloatingTool {
  return {
    id: "passwordVault",
    label: plugin?.i18n?.floatingBox?.passwordVault || "密码箱",
    title: plugin?.i18n?.floatingBox?.passwordVaultTitle || "打开密码箱",
    icon: "mdi:lock-outline",
    bgColor: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    action: () => {
      emitCustomEvent("openPasswordVault")
    },
  }
}
