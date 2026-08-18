/**
 * 网站导航 — 功能注册入口 + 公开 API
 */
import type { Plugin } from "siyuan"
import { WebsiteNavigation } from "./types"

export { showWebsiteNavigation } from "./types"

/** 注册函数：纯 modal 型功能，实例挂载到 plugin 上供卸载清理 */
export function registerWebsiteNavigation(plugin: Plugin) {
  const instance = new WebsiteNavigation(plugin)
  ;(plugin as any).__websiteNavigation = instance
}
