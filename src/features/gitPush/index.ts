// gitPush 功能注册入口与图标注入
import type { Plugin } from "siyuan"
import { GitPushManager } from "./types"

export function registerGitPush(plugin: Plugin) {
  plugin.addIcons(
    `<symbol id="iconGitPush" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2"/><path d="M12 7v5"/><path d="m9 8-3 3 3 3"/><path d="m15 8 3 3-3 3"/><path d="M7 16a5 5 0 0 0 10 0"/></symbol>`,
  )

  const manager = new GitPushManager(plugin)
  manager.init()
  ;(plugin as any).__gitPush = manager
  return manager
}
