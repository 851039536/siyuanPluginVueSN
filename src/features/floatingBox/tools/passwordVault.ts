import type { Plugin } from "siyuan"
import type { FloatingTool } from "../types"
import { emitCustomEvent } from "@/utils/eventBus"

export function createPasswordVaultTool(plugin: Plugin): FloatingTool {
  const i18n = (plugin.i18n as any)?.floatingBox || {}
  return {
    id: "passwordVault",
    label: i18n.passwordVault || "密码箱",
    title: i18n.passwordVaultTitle || "打开密码箱",
    icon: "mdi:lock-outline",
    bgColor: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    action: () => {
      emitCustomEvent("openPasswordVault")
    },
  }
}
