/**
 * 快捷键工具（工具合集 `tools/shortcut`）
 * 功能：在工具合集面板中以紧凑卡片展示与管理快捷键（预置 + 自定义）
 * 注册：`../registry.ts`；数据初始化：`./bootstrap.ts`（幂等，无需在这里注册任何东西）
 */
import type { ShortcutInfo } from "./types"
import {
  getShortcutManager,
  ShortcutManager,
} from "./manager"

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
 * 导出管理器与数据类型
 */
export { ensureShortcutData } from "./bootstrap"
export {
  getShortcutManager,
  ShortcutManager,
}

export type {
  ShortcutCategory,
  ShortcutDisplay,
  ShortcutDisplayKind,
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
  isKeyCombo,
  listGroups,
  resolveShortcutDisplay,
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
