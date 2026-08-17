/**
 * 快捷键模块 - 预置数据：插件自身快捷键
 * 内置快捷键数据的唯一数据源，用于首次使用时 seed 到本地持久化存储。
 */
import type { ShortcutInfo } from "../types"

export const PLUGIN_SHORTCUTS: ShortcutInfo[] = [
  // ── 插件快捷键 ──
  // 目录索引功能
  {
    id: "plugin_insert_index",
    name: "插入索引",
    description: "插入当前文档的子文档索引",
    keys: "Ctrl+Alt+I",
    category: "plugin",
    group: "目录索引",
  },
  {
    id: "plugin_insert_subdocs_ref",
    name: "插入子文档引用",
    description: "插入子文档引用列表",
    keys: "Ctrl+Alt+R",
    category: "plugin",
    group: "目录索引",
  },
  {
    id: "plugin_insert_subdocs_outline",
    name: "插入子文档大纲",
    description: "插入子文档及其大纲",
    keys: "Ctrl+Alt+O",
    category: "plugin",
    group: "目录索引",
  },
]
