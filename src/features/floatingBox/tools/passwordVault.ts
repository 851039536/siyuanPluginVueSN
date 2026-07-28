/**
 * 密码箱工具 — 悬浮框快捷入口，点击派发 openPasswordVault 事件
 */
import type { Plugin } from "siyuan"
import type { FloatingTool } from "../types"
import { createEventDispatchTool } from "./utils"

export function createPasswordVaultTool(plugin: Plugin): FloatingTool {
  return createEventDispatchTool(plugin, {
    id: "passwordVault",
    icon: "mdi:lock-outline",
    eventName: "openPasswordVault",
  })
}
