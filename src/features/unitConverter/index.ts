/**
 * 单位转换器功能模块
 */
import type PluginSample from "@/index"
import { UnitConverterManager } from "./types"

/**
 * 注册单位转换功能
 */
export function registerUnitConverter(plugin: PluginSample) {
  // 注册自定义 Dock 图标（双向箭头 + 标尺）
  plugin.addIcons(`<symbol id="iconUnitConverter" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 16V4m0 0L3 8m4-4 4 4"/><path d="M17 8v12m0 0 4-4m-4 4-4-4"/><path d="M3 20h18"/></symbol>`)

  const manager = new UnitConverterManager(plugin)
  manager.init()
  return manager
}

