/**
 * 快捷键模块 - 类型定义
 */

/**
 * 快捷键分类
 */
export type ShortcutCategory =
  | "siyuan"
  | "plugin"
  | "claude"
  | "openspec"
  | "custom"
  | "npm"
  | "nvm"
  | "cmd"
  | "vscode"
  | "visual-studio"

/**
 * 快捷键信息
 */
export interface ShortcutInfo {
  /** 快捷键ID (唯一标识符) */
  id: string
  /** 快捷键名称 */
  name: string
  /** 快捷键描述 */
  description: string
  /** 快捷键组合 (例如: 'Ctrl+K', 'Cmd+Shift+P') */
  keys: string
  /** 快捷键分类 */
  category: ShortcutCategory
  /** 功能分组 (用于组织UI显示) */
  group?: string
  /** 平台限制 (如果不指定则适用所有平台) */
  platform?: "win" | "mac" | "linux"
  /** 复制内容 (复制时优先使用此字段) */
  copyContent?: string
}

/**
 * 快捷键分组 (用于UI显示)
 */
export interface ShortcutGroup {
  name: string
  shortcuts: ShortcutInfo[]
}

/**
 * 视图模式类型
 */
export type ViewMode = "grid" | "list" | "three-col"

/**
 * 对话框类型
 */
export type DialogType = "add" | "edit" | null

/**
 * 快捷筛选选项
 */
export interface QuickFilter {
  key: string
  label: string
}

/**
 * 表单数据类型
 */
export interface ShortcutFormData {
  id: string
  name: string
  description: string
  keys: string
  group: string
}

/**
 * 分类标签映射类型
 */
export type CategoryLabels = Record<string, string>

/**
 * 工具类分类（需要显示工具徽章的分类）
 */
export const TOOL_CATEGORIES: readonly ShortcutCategory[] = ["npm", "nvm", "cmd", "vscode", "visual-studio"]

/**
 * 分类 i18n 键映射（key: 分类标识 → value: i18n 键名）
 */
export const CATEGORY_LABEL_I18N_KEYS: Record<ShortcutCategory | "all", string> = {
  all: "allShortcuts",
  siyuan: "siyuanShortcuts",
  plugin: "pluginShortcuts",
  claude: "claudeShortcuts",
  openspec: "openspecShortcuts",
  custom: "customShortcuts",
  npm: "npmShortcuts",
  nvm: "nvmShortcuts",
  cmd: "cmdShortcuts",
  vscode: "vscodeShortcuts",
  "visual-studio": "visualStudioShortcuts",
}
