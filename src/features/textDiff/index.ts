/**
 * 文本对比功能模块
 */
import { Plugin } from "siyuan"
import { TextDiffManager } from "./types"

/**
 * 注册文本对比功能
 */
export function registerTextDiff(plugin: Plugin): TextDiffManager {
  const manager = new TextDiffManager(plugin);
  (plugin as any).__textDiff = manager
  return manager
}

export * from "./types"
