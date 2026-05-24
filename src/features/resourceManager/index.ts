import type { Plugin } from "siyuan"
import { createVueDockApp } from "@/utils/vueAppHelper"
import ResourceManagerPanel from "./index.vue"

export type { ResourceManagerI18n } from "./types"

export function registerResourceManager(plugin: Plugin) {
  createVueDockApp(plugin, ResourceManagerPanel, {
    icon: "iconFolder",
    title: (plugin.i18n as any).resourceManager?.panelTitle || "资源管理",
    type: "resource-manager-dock",
    width: 380,
    i18n: (plugin.i18n as any).resourceManager || {},
  })
}
