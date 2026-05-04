/**
 * 视频管理器功能模块
 */
import { Plugin } from "siyuan"
import { VideoManager } from "./types"

/**
 * 注册视频管理器功能
 */
export function registerVideo(plugin: Plugin) {
  const manager = new VideoManager(plugin)
  manager.init();
  (plugin as any).__videoManager = manager
  return manager
}

export * from "./types"
