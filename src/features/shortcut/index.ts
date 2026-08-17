/**
 * 快捷键模块
 * 功能：在右侧边栏显示思源笔记和插件的快捷键信息
 * 侧边栏图标：iconKeymap（快捷键图标）
 */
import { Plugin } from "siyuan"
import { createVueDockApp } from "@/utils/vueAppHelper"
import { PRESET_SHORTCUTS } from "./data/presets"
import ShortcutPanel from "./index.vue"
import {
  getShortcutManager,
  ShortcutManager,
} from "./manager"
import { ShortcutStorage } from "./types/storage"
import type { ShortcutInfo } from "./types"

/**
 * 注册快捷键模块（同步注册 Dock，异步初始化数据，不产生未处理 Promise）
 */
export function registerShortcut(plugin: Plugin) {
  // 同步注册 Dock，确保侧边栏图标在 onload 阶段就出现
  addShortcutDock(plugin)
  // 异步初始化快捷键数据
  void initShortcutData(plugin)
}

/**
 * 异步初始化快捷键数据：seed 预置数据 + 绑定保存回调
 */
async function initShortcutData(plugin: Plugin) {
  try {
    const manager = getShortcutManager()
    const storage = new ShortcutStorage(plugin)

    // 首次运行：seed 预置数据到持久化存储；后续运行：从存储恢复
    const allShortcuts = await storage.seedIfEmpty(PRESET_SHORTCUTS)
    manager.loadFromArray(allShortcuts)

    // 设置保存回调（任何快捷键变更 → 自动同步到持久化存储）
    manager.setSaveCallback(async (shortcuts: ShortcutInfo[]) => {
      await storage.saveAll(shortcuts)
    })
  } catch (error) {
    console.error("初始化快捷键数据失败:", error)
  }
}

/**
 * 添加快捷键 Dock 到右侧边栏
 */
function addShortcutDock(plugin: Plugin) {
  createVueDockApp(plugin, ShortcutPanel, {
    position: "RightTop",
    width: 480,
    icon: "iconKeymap",
    title: plugin.i18n.shortcuts,
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
 * 导出管理器与类型
 */
export {
  getShortcutManager,
  ShortcutManager,
}

export type {
  ShortcutFormData,
  ShortcutGroup,
  ShortcutInfo,
} from "./types"

export {
  CATEGORY_LABEL_I18N_KEYS,
  TOOL_CATEGORIES,
} from "./types"
