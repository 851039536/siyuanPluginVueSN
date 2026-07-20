/**
 * 文档分析功能 - 共享纯工具函数
 */
import type { DuplicateNameGroup } from "./types/index"

/** 按排除名称列表过滤重名组（不区分大小写） */
export function filterDuplicateGroups(
  groups: DuplicateNameGroup[],
  excludeNames: string[],
): DuplicateNameGroup[] {
  const excludes = excludeNames.map((s) => s.trim().toLowerCase()).filter(Boolean)
  if (!excludes.length) return groups
  return groups.filter((g) => !excludes.some((e) => g.title.toLowerCase().includes(e)))
}
