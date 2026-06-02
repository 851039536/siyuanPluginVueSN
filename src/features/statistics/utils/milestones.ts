/**
 * 里程碑目标值计算公式
 * @param type 里程碑类型
 * @param n 第 n 个里程碑（n 从 1 开始）
 */
export function milestoneTargetOf(type: string, n: number): number {
  const g = Math.floor((n - 1) / 3)
  const r = (n - 1) % 3
  switch (type) {
    case "notes": return 10 + g * 30 + r * 10
    case "notebooks": return n * 5
    case "words": return (g * 2 + r + 1) * 10000
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
