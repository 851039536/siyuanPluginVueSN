import { Plugin } from "siyuan"
import {
  createApp,
  h,
} from "vue"
import ResourceManagerPanel from "./index.vue"

export type { ResourceManagerI18n } from "./types"

export function registerResourceManager(plugin: Plugin) {
  plugin.addDock({
    config: {
      position: "RightTop",
      size: {
        width: 380,
        height: 0,
      },
      icon: "iconFolder",
      title: (plugin.i18n as any).resourceManager?.panelTitle || "资源管理",
      show: false,
    },
    data: {},
    type: "resource-manager-dock",
    init(dock: any) {
      const container = document.createElement("div")
      container.style.height = "100%"
      container.style.overflow = "hidden"

      const app = createApp({
        setup() {
          return () =>
            h(ResourceManagerPanel, {
              i18n: (plugin.i18n as any).resourceManager || {},
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
