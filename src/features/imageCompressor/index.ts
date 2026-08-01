// imageCompressor 功能注册入口（纯弹出型，UI 由 App.vue 渲染，无需侧边栏 Dock）
import type { Plugin } from "siyuan"
import { emitCustomEvent } from "@/utils/eventBus"

export function registerImageCompressor(plugin: Plugin) {
  // 全局快捷键：打开图片压缩器（App.vue 监听 openImageCompressor 事件显示 ImageViewer）
  plugin.addCommand({
    langKey: "openImageCompressor",
    hotkey: "⌃⌥C",
    callback: () => {
      emitCustomEvent("openImageCompressor")
    },
  })
}

export type {
  CompressOptions,
  CompressProgress,
  CompressResult,
  ImageCompressorI18n,
  ImageInfo,
  ScanProgress,
} from "./types"
