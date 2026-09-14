/**
 * 快捷键模块 - 纯工具函数
 * 不依赖 Vue 响应式与实例状态，供 Manager / composables / 视图共用
 */
import type {
  ShortcutCategory,
  ShortcutDisplay,
  ShortcutDisplayKind,
  ShortcutFormData,
  ShortcutGroup,
  ShortcutInfo,
  ShortcutQuery,
} from "./types"
import { CATEGORY_LABEL_I18N_KEYS } from "./types"

/** 合法的分类标识集合（由 i18n 键映射派生，新增分类自动生效） */
const VALID_CATEGORIES = new Set<string>(Object.keys(CATEGORY_LABEL_I18N_KEYS))

/**
 * 按关键词筛选快捷键（匹配名称 / 描述 / 主内容 / 快捷键，忽略大小写）
 * 空关键词返回空数组（「不过滤」语义由调用方决定）
 */
export function searchShortcuts(
  shortcuts: ShortcutInfo[],
  keyword: string,
): ShortcutInfo[] {
  const lowerKeyword = keyword.toLowerCase()
  if (!lowerKeyword) return []
  return shortcuts.filter(
    (s) =>
      s.name.toLowerCase().includes(lowerKeyword)
      || s.description.toLowerCase().includes(lowerKeyword)
      // keys 可选（命令行类条目没有键位）
      || (s.keys?.toLowerCase().includes(lowerKeyword) ?? false)
      // 主内容可能是命令 / 路径 / 文本，按命令搜索同样要能命中
      || (s.copyContent?.toLowerCase().includes(lowerKeyword) ?? false),
  )
}

/** 读取非空字符串字段，非法则返回 undefined */
function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined
}

/**
 * 清洗快捷键数组：过滤非法条目、修正分类、按 id 去重
 * @param data 未知来源数据（存储 / 导入文件）
 * @param forceCustom 强制归类为「自定义」（迁移与导入场景）
 */
export function sanitizeShortcutArray(data: unknown, forceCustom = false): ShortcutInfo[] {
  if (!Array.isArray(data)) return []

  const result: ShortcutInfo[] = []
  const seen = new Set<string>()

  for (const raw of data) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue
    const item = raw as Record<string, unknown>

    const id = readString(item.id)
    const name = readString(item.name)
    const copyContent = readString(item.copyContent)
    // keys 缺失时回退取 copyContent：外部导入的文件只填了「内容」也不应被丢弃
    const keys = readString(item.keys) ?? copyContent
    if (!id || !name || !keys || seen.has(id)) continue

    const rawCategory = readString(item.category)
    const category = forceCustom || !rawCategory || !VALID_CATEGORIES.has(rawCategory)
      ? "custom"
      : rawCategory as ShortcutCategory

    const platform = readString(item.platform)
    const shortcut: ShortcutInfo = {
      id,
      name,
      description: typeof item.description === "string" ? item.description : "",
      keys,
      category,
    }
    const group = readString(item.group)
    if (group) shortcut.group = group
    if (platform === "win" || platform === "mac" || platform === "linux") shortcut.platform = platform
    if (copyContent) shortcut.copyContent = copyContent

    seen.add(id)
    result.push(shortcut)
  }

  return result
}

/**
 * 拆分按键组合为「序列」数组（保留原始大小写，供徽章渲染）
 * 例：`Ctrl+K, Alt+Z` → `["Ctrl+K", "Alt+Z"]`
 */
export function splitKeySequences(keys: string): string[] {
  return keys
    .split(",")
    .map((sequence) => sequence.trim())
    .filter((sequence) => sequence !== "")
}

/** 修饰键 token（小写比对） */
const KEY_MODIFIER_TOKENS = new Set([
  "ctrl", "control", "alt", "option", "shift", "cmd", "command", "meta", "super", "win", "windows",
])

/** 命名键 token（小写比对） */
const KEY_NAMED_TOKENS = new Set([
  "enter", "return", "esc", "escape", "tab", "space", "spacebar", "backspace", "delete", "del",
  "insert", "ins", "home", "end", "pageup", "pagedown", "up", "down", "left", "right",
  "capslock", "numlock", "scrolllock", "printscreen", "pause", "break", "plus", "minus",
])

/** 可作为单键的符号（单字符） */
const KEY_SYMBOL_CHARS = "\\/[]-=`'.;,?~!@#$%^&*()_+{}|:\"<>"

/** 一条内容最多允许的序列数（`Ctrl+K, Ctrl+C` 为 2 条序列） */
const MAX_KEY_SEQUENCES = 3

/**
 * 判断单个 token 是否是合法按键：
 * 修饰键 / 命名键 / `F1`–`F12` / 单字母 / 单数字 / 单字符符号
 */
function isKeyToken(token: string): boolean {
  const lower = token.toLowerCase()
  if (!lower) return false
  if (KEY_MODIFIER_TOKENS.has(lower) || KEY_NAMED_TOKENS.has(lower)) return true
  if (/^f([1-9]|1[0-2])$/.test(lower)) return true
  if (/^[a-z0-9]$/.test(lower)) return true
  return token.length === 1 && KEY_SYMBOL_CHARS.includes(token)
}

/**
 * 判断内容形态是否为「按键组合」：
 * 按 `,` 拆多序列 → 每段按 `+` 拆 token → **全部 token 命中白名单**才算按键组合。
 * 判定从严（含空格 / 路径 / 参数一律判为非按键）——把命令误渲染成徽章会误导用户，
 * 而把按键渲染成代码芯片只是观感退化。
 */
export function isKeyCombo(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  const sequences = trimmed.split(",")
  if (sequences.length > MAX_KEY_SEQUENCES) return false
  return sequences.every((sequence) =>
    sequence.split("+").every((token) => isKeyToken(token.trim())),
  )
}

/**
 * 解析条目的显示形态：主内容取「要复制的内容」（`copyContent` 优先，回退 `keys`）。
 * 视图渲染与复制逻辑共用本函数，避免出现「显示一套、复制另一套」。
 */
export function resolveShortcutDisplay(item: ShortcutInfo): ShortcutDisplay {
  const rawCopy = (item.copyContent || "").trim()
  const rawKeys = (item.keys || "").trim()
  const content = rawCopy || rawKeys
  const kind: ShortcutDisplayKind = isKeyCombo(content) ? "keys" : "code"

  // 次显快捷键：仅在「有独立 copyContent、与主内容不同、且本身是按键组合」时给出
  const hasDistinctCopy = rawCopy !== "" && rawCopy !== rawKeys
  const hotkey = hasDistinctCopy && isKeyCombo(rawKeys) ? rawKeys : undefined

  return hotkey ? { content, kind, hotkey } : { content, kind }
}

/**
 * 过滤管道：关键词 → 分类
 */
export function filterShortcuts(list: ShortcutInfo[], query: ShortcutQuery): ShortcutInfo[] {
  const result = query.keyword
    ? searchShortcuts(list, query.keyword)
    : list

  if (query.category === "all") {
    return result
  }
  return result.filter((item) => item.category === query.category)
}

/**
 * 按 `group` 聚合（缺失时归入 fallbackGroup），保持原顺序
 */
export function groupShortcuts(list: ShortcutInfo[], fallbackGroup: string): ShortcutGroup[] {
  const grouped = new Map<string, ShortcutInfo[]>()
  for (const item of list) {
    const group = item.group || fallbackGroup
    const bucket = grouped.get(group)
    if (bucket) {
      bucket.push(item)
    } else {
      grouped.set(group, [item])
    }
  }
  return Array.from(grouped.entries()).map(([name, shortcuts]) => ({ name, shortcuts }))
}

/**
 * 列出现有分组名（去重、忽略空值、按名称升序）——供「分组」下拉作为选项来源
 */
export function listGroups(shortcuts: readonly ShortcutInfo[]): string[] {
  const groups = new Set<string>()
  for (const item of shortcuts) {
    if (item.group) groups.add(item.group)
  }
  return Array.from(groups).sort()
}

/**
 * 统计各分类条目数（供分类下拉标注数量）
 */
export function countByCategory(list: ShortcutInfo[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const item of list) {
    counts.set(item.category, (counts.get(item.category) || 0) + 1)
  }
  return counts
}

/**
 * 由表单数据构建自定义快捷键（id 为空时生成新 id）
 * - 内容 → `copyContent`（与快捷键不同时才写入，避免冗余字段）
 * - 快捷键留空 → 写入内容副本，保证 `keys` 非空（清洗与导入校验的基线）
 */
export function buildCustomShortcut(
  form: ShortcutFormData,
  fallbackGroup: string,
): ShortcutInfo {
  const content = form.content.trim() || form.keys.trim()
  const keys = form.keys.trim() || content
  const shortcut: ShortcutInfo = {
    id: form.id || `custom_${Date.now()}`,
    name: form.name.trim(),
    description: form.description.trim(),
    keys,
    category: "custom",
    group: form.group.trim() || fallbackGroup,
  }
  if (content && content !== keys) {
    shortcut.copyContent = content
  }
  return shortcut
}
