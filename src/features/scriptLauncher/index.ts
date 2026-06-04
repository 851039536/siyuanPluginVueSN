/**
 * 脚本启动器功能模块
 */
import { Plugin } from "siyuan"
import { ScriptLauncher } from "./types"

export function registerScriptLauncher(plugin: Plugin) {
  const launcher = new ScriptLauncher(plugin)
  launcher.init()
  ;(plugin as any).__scriptLauncher = launcher
  return launcher
}
