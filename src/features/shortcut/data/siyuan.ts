/**
 * 快捷键模块 - 预置数据：思源笔记快捷键
 * 内置快捷键数据的唯一数据源，用于首次使用时 seed 到本地持久化存储。
 */
import type { ShortcutInfo } from "../types"

export const SIYUAN_SHORTCUTS: ShortcutInfo[] = [
  // ── 思源笔记 ──
  // 编辑操作
  {
    id: "sy_bold",
    name: "粗体",
    description: "使文本加粗",
    keys: "Ctrl+B",
    category: "siyuan",
    group: "文本格式",
  },
  {
    id: "sy_italic",
    name: "斜体",
    description: "使文本倾斜",
    keys: "Ctrl+I",
    category: "siyuan",
    group: "文本格式",
  },
  {
    id: "sy_underline",
    name: "下划线",
    description: "为文本添加下划线",
    keys: "Ctrl+U",
    category: "siyuan",
    group: "文本格式",
  },
  {
    id: "sy_strikethrough",
    name: "删除线",
    description: "为文本添加删除线",
    keys: "Ctrl+Shift+X",
    category: "siyuan",
    group: "文本格式",
  },

  {
    id: "sy_quote",
    name: "引用块",
    description: "插入引用块",
    keys: "Ctrl+Shift+B",
    category: "siyuan",
    group: "块类型",
  },
  {
    id: "sy_replace",
    name: "替换",
    description: "打开替换面板",
    keys: "Ctrl+H",
    category: "siyuan",
    group: "导航",
  },
  {
    id: "sy_focus",
    name: "聚焦",
    description: "聚焦当前块",
    keys: "Ctrl+L",
    category: "siyuan",
    group: "导航",
  },
  {
    id: "sy_delete_block",
    name: "删除块",
    description: "删除当前块",
    keys: "Ctrl+Shift+D",
    category: "siyuan",
    group: "编辑操作",
  },
  {
    id: "sy_duplicate_block",
    name: "复制块",
    description: "复制当前块",
    keys: "Ctrl+D",
    category: "siyuan",
    group: "编辑操作",
  },
]
