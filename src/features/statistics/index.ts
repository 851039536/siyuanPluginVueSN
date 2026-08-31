/**
 * 数据统计功能模块
 */
import { Plugin } from "siyuan"
import { Statistics } from "./core"

/**
 * 注册数据统计功能（实例自挂载到 plugin.__statistics，onunload 经 DESTROYABLE_KEYS 统一销毁）
 */
export function registerStatistics(plugin: Plugin) {
  const instance = new Statistics(plugin)
  ;(plugin as any).__statistics = instance
  instance.init()
}
