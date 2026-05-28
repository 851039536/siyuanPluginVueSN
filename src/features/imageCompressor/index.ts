import type { Plugin } from "siyuan"
import { emitCustomEvent } from "@/utils/eventBus"
import { createVueDockApp } from "@/utils/vueAppHelper"
import ImageCompressorPanel from "./index.vue"

export function registerImageCompressor(plugin: Plugin) {
  createVueDockApp(plugin, ImageCompressorPanel, {
    icon: "iconImage",
    title: (plugin.i18n as any)?.imageCompressor?.title || "图片压缩",
    type: "image-compressor-dock",
    width: 400,
    i18n: (plugin.i18n as any)?.imageCompressor || {},
  })

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
  ImageComparison,
  ImageCompressorI18n,
  ImageInfo,
  ScanProgress,
} from "./types"
