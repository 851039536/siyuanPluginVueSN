import type { ShortcutInfo } from "./types"
/**
 * 快捷键模块
 * 功能：在右侧边栏显示思源笔记和插件的快捷键信息
 * 侧边栏图标：iconKeymap（快捷键图标）
 */
import { Plugin } from "siyuan"
import { createVueDockApp } from "@/utils/vueAppHelper"
import ShortcutPanel from "./index.vue"
import {
  getShortcutManager,
  ShortcutManager,
} from "./manager"
import { ShortcutStorage } from "./types/storage"
import { PRESET_SHORTCUTS } from "./data/presets"

/**
 * 注册快捷键模块
 */
export async function registerShortcut(plugin: Plugin) {
  // 先同步注册 Dock，确保侧边栏图标在 onload 阶段就出现
  addShortcutDock(plugin)

  // 异步初始化快捷键数据
  const manager = getShortcutManager()
  const storage = new ShortcutStorage(plugin)

  // 首次运行：seed 预置数据到持久化存储；后续运行：从存储恢复
  const allShortcuts = await storage.seedIfEmpty(PRESET_SHORTCUTS)
  manager.loadFromArray(allShortcuts)

  // 设置保存回调（任何快捷键变更 → 自动同步到持久化存储）
  manager.setSaveCallback(async (shortcuts: ShortcutInfo[]) => {
    await storage.saveAll(shortcuts)
  })
}

/**
 * 添加快捷键 Dock 到右侧边栏
 */
function addShortcutDock(plugin: Plugin) {
  createVueDockApp(plugin, ShortcutPanel, {
    position: "RightTop",
    width: 480,
    icon: "iconKeymap",
    title: plugin.i18n.shortcuts || "快捷键",
    type: "shortcut-panel-dock",
    i18n: plugin.i18n,
    extraProps: { plugin },
  })
}

/**
 * 导出公共接口供用户自定义添加快捷键
 */
export async function addCustomShortcut(shortcut: ShortcutInfo) {
  const manager = getShortcutManager()
  await manager.addShortcut(shortcut)
}

/**
 * 批量添加自定义快捷键
 */
export async function addCustomShortcuts(shortcuts: ShortcutInfo[]) {
  const manager = getShortcutManager()
  await manager.addShortcuts(shortcuts)
}

/**
 * 获取快捷键管理器
 */
export {
  getShortcutManager,
  ShortcutManager,
}

/**
 * 导出类型
 */
export type {
  DialogType,
  QuickFilter,
  ShortcutFormData,
  ShortcutGroup,
  ShortcutInfo,
  ViewMode,
} from "./types"
