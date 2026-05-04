import { Plugin } from "siyuan"
import {
  createApp,
  h,
  ref,
} from "vue"
import { emitCustomEvent } from "@/utils/eventBus"
import ImageCompressorPanel from "../index.vue"

export interface ImageInfo {
  path: string
  name: string
  size: number
  width?: number
  height?: number
  type: string
  lastModified: number
  url?: string
}

export interface CompressOptions {
  maxSizeMB?: number
  maxWidthOrHeight?: number
  quality?: number
  useWebWorker?: boolean
  fileType?: string
}

export interface CompressResult {
  success: boolean
  originalFile: ImageInfo
  compressedBlob?: Blob
  compressedSize?: number
  error?: string
  compressionRatio?: number
  timeTaken?: number
}

export interface ImageComparison {
  original: ImageInfo
  compressed: {
    size: number
    blob: Blob
  }
  compressionRatio: number
  sizeSaved: number
  sizeSavedMB: string
}

export interface ScanProgress {
  current: number
  total: number
  currentPath?: string
}

export interface CompressProgress {
  current: number
  total: number
  currentImage?: string
  failed?: number
}

export class ImageCompressorManager {
  private plugin: Plugin

  constructor(plugin: Plugin) {
    this.plugin = plugin
  }

  public init() {
    this.addDock()
    this.addCommand()
  }

  private addDock() {
    const self = this
    const visible = ref(false)

    this.plugin.addDock({
      config: {
        position: "RightTop",
        size: {
          width: 400,
          height: 0,
        },
        icon: "iconImage",
        title: "图片压缩",
        show: false,
      },
      data: {},
      type: "image-compressor-dock",
      init: (dock: any) => {
        const container = document.createElement("div")
        container.style.height = "100%"
        container.style.overflow = "hidden"

        const app = createApp({
          setup() {
            return () =>
              h(ImageCompressorPanel, {
                visible: visible.value,
                i18n: self.plugin.i18n,
                plugin: self.plugin,
                onClose: () => {
                  visible.value = false
                },
              })
          },
        })

        app.mount(container)
        dock.element?.appendChild(container)

        dock.__app = app
        dock.__container = container
        dock.__visible = visible
      },
    })
  }

  private addCommand() {
    this.plugin.addCommand({
      langKey: "openImageCompressor",
      hotkey: "⌃⌥C",
      callback: () => {
        this.openImageCompressor()
      },
    })
  }

  private openImageCompressor() {
    emitCustomEvent("openImageCompressor")
  }

  public destroy() {}
}


