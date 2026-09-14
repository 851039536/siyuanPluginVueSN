/**
 * 快捷键模块 - 纯工具函数
 * 不依赖 Vue 响应式与实例状态，供 Manager / composables / 视图共用
 */
import type {
  ShortcutCategory,
  ShortcutConflictMap,
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
 * 按键组合归一化：去空白、转小写、段内与序列间均排序
 * 例：`Ctrl + K, Alt+Z` 与 `k+ctrl, z+alt` 归一化后相同
 */
export function normalizeShortcutKeys(keys: string): string {
  return keys
    .split(",")
    .map((sequence) =>
      sequence
        .split("+")
        .map((part) => part.trim().toLowerCase())
        .filter((part) => part !== "")
        .sort()
        .join("+"),
    )
    .filter((sequence) => sequence !== "")
    .sort()
    .join(",")
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
 * 构建冲突表：归一化后相同的按键组合互为冲突，值中不含自身名称
 */
export function buildConflictMap(list: ShortcutInfo[]): ShortcutConflictMap {
  const grouped = new Map<string, ShortcutInfo[]>()

  for (const item of list) {
    const normalized = normalizeShortcutKeys(item.keys)
    if (!normalized) continue
    const bucket = grouped.get(normalized)
    if (bucket) {
      bucket.push(item)
    } else {
      grouped.set(normalized, [item])
    }
  }

  const conflicts: ShortcutConflictMap = new Map()
  for (const bucket of grouped.values()) {
    if (bucket.length < 2) continue
    for (const item of bucket) {
      conflicts.set(
        item.id,
        bucket.filter((other) => other.id !== item.id).map((other) => other.name),
      )
    }
  }
  return conflicts
}

/**
 * 按键组合是否互相冲突（含跨分类判定）
 */
export function isConflicting(list: ShortcutInfo[]): boolean {
  const seen = new Set<string>()
  for (const item of list) {
    const normalized = normalizeShortcutKeys(item.keys)
    if (!normalized) continue
    if (seen.has(normalized)) return true
    seen.add(normalized)
  }
  return false
}

/**
 * 过滤管道：关键词 → 分类 → 快捷筛选（最近 / 冲突）
 */
export function filterShortcuts(list: ShortcutInfo[], query: ShortcutQuery): ShortcutInfo[] {
  let result = query.keyword
    ? searchShortcuts(list, query.keyword)
    : list

  if (query.category !== "all") {
    result = result.filter((item) => item.category === query.category)
  }

  if (query.filter === "recent") {
    result = result.filter((item) => query.recentIds.has(item.id))
  } else if (query.filter === "conflict") {
    result = result.filter((item) => query.conflictIds.has(item.id))
  }

  return result
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
 * 剪枝 id 列表：去除不在有效集合中的项（保序去重）
 */
export function pruneIds(
  ids: string[],
  validIds: ReadonlySet<string>,
): { ids: string[]; changed: boolean } {
  const next: string[] = []
  for (const id of ids) {
    if (validIds.has(id) && !next.includes(id)) next.push(id)
  }
  return { ids: next, changed: next.length !== ids.length }
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
