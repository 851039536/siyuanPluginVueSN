/**
 * 密码箱工具 — 悬浮框快捷入口，点击派发 openPasswordVault 事件
 */
import type { Plugin } from "siyuan"
import type { FloatingTool } from "../types"
import { createEventDispatchTool } from "./utils"

export function createPasswordVaultTool(plugin: Plugin): FloatingTool {
  return createEventDispatchTool(plugin, {
    id: "passwordVault",
    i18nKey: "passwordVault",
    defaultLabel: "密码箱",
    defaultTitle: "打开密码箱",
    icon: "mdi:lock-outline",
    bgColor: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    eventName: "openPasswordVault",
  })
}
