// 资源管理功能注册入口：创建资源管理 Dock 面板
import type { Plugin } from "siyuan"
import type { ResourceManagerI18n } from "./types"
import { createVueDockApp } from "@/utils/vueAppHelper"
import ResourceManagerPanel from "./index.vue"

export type { ResourceManagerI18n } from "./types"

export function registerResourceManager(plugin: Plugin) {
  const i18n = (plugin.i18n as unknown as { resourceManager?: ResourceManagerI18n }).resourceManager
  createVueDockApp(plugin, ResourceManagerPanel, {
    icon: "iconFolder",
    title: i18n?.panelTitle ?? "",
    type: "resource-manager-dock",
    width: 380,
    i18n: i18n ?? {},
  })
}
