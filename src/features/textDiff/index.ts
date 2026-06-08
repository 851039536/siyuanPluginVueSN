/**
 * 文本对比功能模块
 */
import { Plugin } from "siyuan"
import { TextDiffManager } from "./types"

let manager: TextDiffManager | undefined

/**
 * 获取 TextDiffManager 实例（供其他功能模块跨功能调用）
 */
export function getTextDiffManager(): TextDiffManager | undefined {
  return manager
}

/**
 * 注册文本对比功能
 */
export function registerTextDiff(plugin: Plugin): TextDiffManager {
  manager = new TextDiffManager(plugin)
  return manager
}

