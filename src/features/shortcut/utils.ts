/**
 * 快捷键模块 - 纯工具函数
 * 不依赖 Vue 响应式与实例状态，供 Manager / composables / 视图共用
 */
import type {
  ShortcutCategory,
  ShortcutFormData,
  ShortcutGroup,
  ShortcutInfo,
  ShortcutQuery,
} from "./types"
import { CATEGORY_LABEL_I18N_KEYS } from "./types"

/** 合法的分类标识集合（由 i18n 键映射派生，新增分类自动生效） */
const VALID_CATEGORIES = new Set<string>(Object.keys(CATEGORY_LABEL_I18N_KEYS))

/**
 * 按关键词筛选快捷键（匹配名称 / 描述 / 按键组合，忽略大小写）
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
      || s.keys.toLowerCase().includes(lowerKeyword),
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
    const keys = readString(item.keys)
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
    const copyContent = readString(item.copyContent)
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
 */
export function buildCustomShortcut(
  form: ShortcutFormData,
  fallbackGroup: string,
): ShortcutInfo {
  return {
    id: form.id || `custom_${Date.now()}`,
    name: form.name.trim(),
    description: form.description.trim(),
    keys: form.keys.trim(),
    category: "custom",
    group: form.group.trim() || fallbackGroup,
  }
}
