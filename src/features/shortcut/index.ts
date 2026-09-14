/**
 * 快捷键模块
 * 功能：在右侧边栏以紧凑卡片展示与管理快捷键
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
 * 异步初始化快捷键数据：
 * 迁移历史遗留数据 → 注入「预置 + 自定义」→ 绑定保存回调（只写自定义段）
 */
async function initShortcutData(plugin: Plugin) {
  try {
    const manager = getShortcutManager()
    const storage = new ShortcutStorage(plugin)
    const presetIds = new Set(PRESET_SHORTCUTS.map((item) => item.id))

    // 旧版「预置 + 自定义」混存键 → 自定义段（幂等，失败保留旧键待下次重试）
    const custom = await storage.migrateLegacy(presetIds)

    manager.loadFrom({ presets: PRESET_SHORTCUTS, custom })
    manager.setSaveCallback((list) => storage.saveCustom(list))
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
  })
}

/**
 * 导出公共接口供用户自定义添加快捷键
 */
export async function addCustomShortcut(shortcut: ShortcutInfo) {
  const manager = getShortcutManager()
  return manager.addOrUpdateCustom(shortcut)
}

/**
 * 批量添加自定义快捷键
 */
export async function addCustomShortcuts(shortcuts: ShortcutInfo[]) {
  const manager = getShortcutManager()
  const merged = [...manager.getCustomShortcuts()]
  for (const shortcut of shortcuts) {
    const index = merged.findIndex((item) => item.id === shortcut.id)
    if (index === -1) {
      merged.push(shortcut)
    } else {
      merged[index] = shortcut
    }
  }
  return manager.replaceCustom(merged)
}

/**
 * 导出管理器与类型
 */
export {
  getShortcutManager,
  ShortcutManager,
}

export type {
  ShortcutCategory,
  ShortcutExportPayload,
  ShortcutFormData,
  ShortcutGroup,
  ShortcutImportResult,
  ShortcutInfo,
  ShortcutMergeResult,
  ShortcutQuery,
} from "./types"

export {
  CATEGORY_LABEL_I18N_KEYS,
  EXPORT_PAYLOAD_TYPE,
  EXPORT_PAYLOAD_VERSION,
  TOOL_CATEGORIES,
} from "./types"

export {
  filterShortcuts,
  groupShortcuts,
  listGroups,
  sanitizeShortcutArray,
  searchShortcuts,
  splitKeySequences,
} from "./utils"

export {
  buildExportFileName,
  buildExportPayload,
  mergeImport,
  parseImportPayload,
  serializeExport,
} from "./dataTransfer"
