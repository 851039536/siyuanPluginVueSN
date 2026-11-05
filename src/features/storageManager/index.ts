/**
 * 数据管理功能模块
 *
 * 独立 Dock 面板：统一展示插件持久化资产、按模块导出/导入、全量备份/逻辑还原、单槽清空。
 * 实例自挂载到 `plugin.__storageManager`，onunload 经 DESTROYABLE_KEYS 统一销毁。
 */
import type { Plugin } from "siyuan"
import type { DockAppHandle } from "@/utils/vueAppHelper"
import { createVueDockApp } from "@/utils/vueAppHelper"
import { StorageManager } from "./types"
import { getStorageManagerI18n } from "./types/i18n"
import StorageManagerPanel from "./index.vue"

const DOCK_TYPE = "storage-manager-dock"
const DOCK_ICON = "iconStorageManager"

class StorageManagerFeature {
  readonly manager: StorageManager
  private dock: DockAppHandle

  constructor(plugin: Plugin) {
    this.manager = new StorageManager(plugin)
    this.dock = createVueDockApp(plugin, StorageManagerPanel, {
      icon: DOCK_ICON,
      title: getStorageManagerI18n(plugin).title || "数据管理",
      type: DOCK_TYPE,
      width: 440,
      i18n: getStorageManagerI18n(plugin),
      extraProps: { manager: this.manager },
    })
  }

  destroy(): void {
    this.dock.unmount()
    this.manager.destroy()
  }
}

/** 注册数据管理（Dock 侧边栏面板） */
export function registerStorageManager(plugin: Plugin): void {
  plugin.addIcons(
    `<symbol id="${DOCK_ICON}" viewBox="0 0 24 24">`
    + `<path fill="currentColor" d="M12,3C7.58,3 4,4.79 4,7C4,9.21 7.58,11 12,11C16.42,11 20,9.21 20,7C20,4.79 16.42,3 12,3M4,9V12C4,14.21 7.58,16 12,16C16.42,16 20,14.21 20,12V9C20,11.21 16.42,13 12,13C7.58,13 4,11.21 4,9M4,14V17C4,19.21 7.58,21 12,21C16.42,21 20,19.21 20,17V14C20,16.21 16.42,18 12,18C7.58,18 4,16.21 4,14Z"/>`
    + `</symbol>`,
  )

  // 重复注册防护：先销毁旧实例，避免 Dock Vue app 叠加
  const existing = (plugin as any).__storageManager as { destroy?: () => void } | undefined
  existing?.destroy?.()

  const instance = new StorageManagerFeature(plugin)
  ;(plugin as any).__storageManager = instance
}
