/**
 * 提权助手 - 功能入口
 */
import type { Plugin } from "siyuan"
import { ElevationAssistant } from "./types"

export function registerElevationAssistant(plugin: Plugin): void {
  const assistant = new ElevationAssistant(plugin)
  assistant.init()
  ;(plugin as any).__elevationAssistant = assistant
}
