/**
 * 脚本启动器功能模块
 */
import { Plugin } from "siyuan"
import { ScriptLauncher } from "./types"

/**
 * 注册脚本启动器功能
 */
export function registerScriptLauncher(plugin: Plugin) {
  const dataDir = (plugin as any).dataDir || ""
  const launcher = new ScriptLauncher(plugin, dataDir)
  launcher.init()

  ;(plugin as any).__scriptLauncher = launcher

  return launcher
}
