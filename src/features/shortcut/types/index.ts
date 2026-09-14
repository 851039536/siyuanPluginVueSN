/**
 * 快捷键模块 - 类型定义与共享常量
 */

/**
 * 快捷键分类
 */
export type ShortcutCategory =
  | "siyuan"
  | "plugin"
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
 * 视图筛选模式（一组互斥选项）
 */
export type ShortcutFilterMode = "all" | "favorite" | "recent" | "conflict"

/**
 * 过滤查询参数：交给纯函数 `filterShortcuts` 消费，避免筛选逻辑散落在视图中
 */
export interface ShortcutQuery {
  keyword: string
  /** 分类标识，`"all"` 表示不过滤分类 */
  category: string
  filter: ShortcutFilterMode
  favoriteIds: ReadonlySet<string>
  recentIds: ReadonlySet<string>
  conflictIds: ReadonlySet<string>
}

/**
 * 冲突表：冲突项 id → 与之冲突的条目名称列表（不含自身）
 */
export type ShortcutConflictMap = Map<string, string[]>

/**
 * 导入解析结果
 */
export interface ShortcutImportResult {
  /** 是否解析成功（结构非法时为 false） */
  ok: boolean
  /** 解析失败原因（`ok` 为 false 时给出，供视图层映射为 i18n 文案） */
  error?: string
  /** 待合并的有效条目（已剔除与预置 id 冲突的项） */
  items: ShortcutInfo[]
  /** 被忽略的条目数（字段缺失 / 与预置 id 冲突） */
  ignored: number
}

/**
 * 导入合并结果
 */
export interface ShortcutMergeResult {
  next: ShortcutInfo[]
  added: number
  updated: number
}

/**
 * 导出载荷结构
 */
export interface ShortcutExportPayload {
  /** 载荷标识，导入时用于校验文件类型 */
  type: string
  /** 载荷版本，便于后续兼容 */
  version: number
  /** 导出时间（ISO 字符串） */
  exportedAt: string
  /** 仅包含自定义快捷键 */
  shortcuts: ShortcutInfo[]
}

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
  openspec: "openspecShortcuts",
  custom: "customShortcuts",
  npm: "npmShortcuts",
  nvm: "nvmShortcuts",
  cmd: "cmdShortcuts",
  vscode: "vscodeShortcuts",
  "visual-studio": "visualStudioShortcuts",
}

/**
 * 导出载荷标识与版本（导入校验用）
 */
export const EXPORT_PAYLOAD_TYPE = "siyuan-plugin-shortcuts"
export const EXPORT_PAYLOAD_VERSION = 1

/**
 * 最近使用记录上限
 */
export const RECENT_LIMIT = 10
