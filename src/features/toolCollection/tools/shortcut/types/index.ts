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
  /**
   * 快捷键组合 (例如: 'Ctrl+K', 'Cmd+Shift+P')
   * 可选：命令行类条目（如 npm / nvm）本身没有原生快捷键，只承载「要复制的内容」(`copyContent`)，
   * 此时留空不写；卡片显示与复制统一走 `resolveShortcutDisplay`（`content = copyContent || keys`）。
   */
  keys?: string
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
 * 内容显示形态：按键组合 → 按键徽章组；命令行 / 路径 / 文本 → 等宽代码芯片
 */
export type ShortcutDisplayKind = "keys" | "code"

/**
 * 条目的显示模型（视图渲染与复制逻辑共用的唯一契约）
 */
export interface ShortcutDisplay {
  /** 主内容：要复制的内容（`copyContent` 优先，回退 `keys`） */
  content: string
  /** 呈现形态（由 `isKeyCombo` 自动判定，无显式字段） */
  kind: ShortcutDisplayKind
  /** 次显快捷键：仅当「有独立 copyContent 且与 keys 不同、且 keys 本身是按键组合」时给出 */
  hotkey?: string
}

/**
 * 表单数据类型（内容必填、快捷键可选）
 */
export interface ShortcutFormData {
  id: string
  name: string
  description: string
  /** 内容：要复制的内容（写入 `copyContent`，与快捷键相同时不冗余写入） */
  content: string
  /** 快捷键：可选；留空时写入内容副本，保证 `keys` 非空 */
  keys: string
  group: string
}

/**
 * 过滤查询参数：交给纯函数 `filterShortcuts` 消费，避免筛选逻辑散落在视图中
 */
export interface ShortcutQuery {
  keyword: string
  /** 分类标识，`"all"` 表示不过滤分类 */
  category: string
}

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
