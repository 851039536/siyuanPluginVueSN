/**
 * 超级面板功能模块
 */
import { Plugin } from "siyuan"
import { SuperPanelManager } from "./types"

/**
 * 注册超级面板功能
 */
export function registerSuperPanel(plugin: Plugin) {
  const manager = new SuperPanelManager(plugin)
  manager.init()
  return manager
}

