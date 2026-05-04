import { Plugin } from "siyuan"
import {
  createApp,
  h,
} from "vue"
import DiskBrowserPanel from "./index.vue"
import { DiskBrowserStorage } from "./types/storage"

export { useDiskBrowser } from "./composables/useDiskBrowser"
export type {
  CacheData,
  CacheStatus,
  DiskBrowserI18n,
  DiskBrowserSettings,
  DiskInfo,
  FolderInfo,
} from "./types"
export { DiskBrowserStorage } from "./types/storage"

export function registerDiskBrowser(plugin: Plugin) {
  const storage = new DiskBrowserStorage(plugin)
  storage.init()

  plugin.addDock({
    config: {
      position: "RightTop",
      size: {
        width: 380,
        height: 0,
      },
      icon: "iconFiles",
      title: (plugin.i18n as any).diskBrowser?.panelTitle || "本地磁盘",
      show: false,
    },
    data: {},
    type: "disk-browser-dock",
    init(dock: any) {
      const container = document.createElement("div")
      container.style.height = "100%"
      container.style.overflow = "hidden"

      const app = createApp({
        setup() {
          return () =>
            h(DiskBrowserPanel, {
              i18n: plugin.i18n.diskBrowser,
              plugin,
            })
        },
      })

      app.mount(container)
      dock.element?.appendChild(container)

      dock.__app = app
      dock.__container = container
    },
  })
}
