// 磁盘浏览器功能注册入口 — createVueDockApp 创建右侧边栏 Dock 面板
import type { Plugin } from "siyuan"
import type { DiskBrowserI18n } from "./types"
import { createVueDockApp } from "@/utils/vueAppHelper"
import DiskBrowserPanel from "./index.vue"

import { DiskBrowserStorage } from "./types/storage"

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

  const i18n = plugin.i18n.diskBrowser as DiskBrowserI18n

  createVueDockApp(plugin, DiskBrowserPanel, {
    icon: "iconFiles",
    title: i18n?.panelTitle || "本地磁盘",
    type: "disk-browser-dock",
    width: 380,
    i18n,
    extraProps: { storage },
  })
}
