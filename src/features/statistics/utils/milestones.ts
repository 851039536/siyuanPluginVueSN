import type { MilestoneTypeKey } from "../types/milestoneRules"

/**
 * 使用公式计算某类型第 n 个里程碑的目标值（硬编码默认值）。
 * 当用户未自定义规则时作为兜底。
 */
export function milestoneTargetOf(type: string, n: number): number {
  const g = Math.floor((n - 1) / 3)
  const r = (n - 1) % 3
  switch (type) {
    case "notes": return 10 + g * 30 + r * 10
    case "notebooks": return n * 5
    case "words": return (g * 2 + r + 1) * 10000
    case "blocks": return 50 + (n - 1) * 100
    case "code": return 10 + (n - 1) * 30
    case "tags": return 10 + (n - 1) * 30
    case "backlinks": return 10 + g * 50 + r * 20
    case "assets": return 10 + g * 20 + r * 10
    case "images": return 10 + (n - 1) * 30
    case "streak": return Math.round(3 * 1.5 ** (n - 1))
    case "activeDays": return Math.round(10 * 1.5 ** (n - 1))
    default: return n * 10
  }
}

/**
 * 带自定义规则的目标值查询。
 * 当某类型存在自定义规则时，完全使用自定义值（不混合公式）；
 * 超出数组长度返回 Infinity 表示没有更多里程碑。
 */
export function milestoneTargetOfWithRules(
  type: string,
  n: number,
  customRules?: Record<string, number[]>,
): number {
  if (customRules?.[type] && customRules[type].length > 0) {
    if (n <= customRules[type].length) {
      return customRules[type][n - 1]
    }
    return Infinity
  }
  return milestoneTargetOf(type, n)
}

/**
 * 二分查找某类型当前值已达到的里程碑数量。
 * milestoneTargetOfWithRules 返回值随 n 单调递增，满足二分查找前置条件。
 * @returns 0 ~ maxMilestones 之间的里程碑达成数
 */
export function countMilestonesReached(
  type: string,
  value: number,
  customRules?: Record<string, number[]>,
  maxMilestones = 200,
): number {
  if (value <= 0) return 0
  // 第一个里程碑都无法达成
  if (milestoneTargetOfWithRules(type, 1, customRules) > value) return 0
  // 最后一个里程碑也能达成
  if (milestoneTargetOfWithRules(type, maxMilestones, customRules) <= value) {
    return maxMilestones
  }
  let lo = 1
  let hi = maxMilestones
  while (lo < hi) {
    // 取上中位数，确保 lo 始终向前推进
    const mid = Math.ceil((lo + hi) / 2)
    if (milestoneTargetOfWithRules(type, mid, customRules) <= value) {
      lo = mid
    } else {
      hi = mid - 1
    }
  }
  return lo
}

/**
 * 生成所有类型的默认里程碑目标值（每种类型前 10 级），供编辑器初始化和重置使用。
 */
export function generateDefaultRules(levels = 10): Record<string, number[]> {
  const types: MilestoneTypeKey[] = [
    "notes",
    "words",
    "blocks",
    "tags",
    "backlinks",
    "assets",
    "images",
    "notebooks",
    "code",
    "streak",
    "activeDays",
  ]
  const rules: Record<string, number[]> = {}
  for (const type of types) {
    rules[type] = Array.from({ length: levels }, (_, i) => milestoneTargetOf(type, i + 1))
  }
  return rules
}
