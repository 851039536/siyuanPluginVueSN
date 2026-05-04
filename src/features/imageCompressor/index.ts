/**
 * 图片压缩功能模块
 */
import { Plugin } from "siyuan"
import { ImageCompressorManager } from "./types"

/**
 * 注册图片压缩功能
 */
export function registerImageCompressor(plugin: Plugin) {
  const manager = new ImageCompressorManager(plugin)
  manager.init();
  (plugin as any).__imageCompressor = manager
  return manager
}

export { ImageCompressorManager } from "./types"
export type {
  CompressOptions,
  CompressProgress,
  CompressResult,
  ImageComparison,
  ImageInfo,
  ScanProgress,
} from "./types"
