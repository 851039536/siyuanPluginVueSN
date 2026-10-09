// src/features/gitPush/utils/analysis.spec.ts — 提交分析纯函数单元测试
//
// 覆盖重点：rankByCountWithTotal 的「截断后行 + 截断前分组数」双输出。
// UI 依据 totalGroups > rows.length 决定是否显示「仅显示前 N 名（共 M）」——
// 若该契约破裂，用户会看到排行各行次数之和小于总提交数而被误读为统计错误。
import { describe, expect, it } from "vitest"
import { rankByCount, rankByCountWithTotal } from "./analysis"

describe("rankByCountWithTotal", () => {
  it("未超出上限：totalGroups 等于行数（UI 据此不显示截断提示）", () => {
    const items = ["a", "b", "a"]
    const { rows, totalGroups } = rankByCountWithTotal(items, (x) => x, 20)
    expect(rows).toEqual([
      { key: "a", count: 2 },
      { key: "b", count: 1 },
    ])
    expect(totalGroups).toBe(2)
  })

  it("超出上限：行被截断但 totalGroups 仍报截断前的完整分组数", () => {
    // 25 个不同 key，各 1 次 → limit 20 时应截断为 20 行，但总数仍报 25
    const items = Array.from({ length: 25 }, (_, i) => `p${i}`)
    const { rows, totalGroups } = rankByCountWithTotal(items, (x) => x, 20)
    expect(rows).toHaveLength(20)
    expect(totalGroups).toBe(25)
    // 这是「各行次数之和 < 总提交数」可被解释的依据
    expect(totalGroups).toBeGreaterThan(rows.length)
  })

  it("按次数降序，截断取的是前 limit 名（而非前 limit 个出现项）", () => {
    const items = ["rare", "rare", "mid", "mid", "mid", "top", "top", "top", "top"]
    const { rows, totalGroups } = rankByCountWithTotal(items, (x) => x, 2)
    expect(rows).toEqual([
      { key: "top", count: 4 },
      { key: "mid", count: 3 },
    ])
    expect(totalGroups).toBe(3)
  })

  it("空 key 被忽略且不计入 totalGroups", () => {
    const items = ["a", "", "", "b"]
    const { rows, totalGroups } = rankByCountWithTotal(items, (x) => x, 20)
    expect(totalGroups).toBe(2)
    expect(rows.map((r) => r.key).sort()).toEqual(["a", "b"])
  })

  it("空输入：无行且 totalGroups 为 0", () => {
    const { rows, totalGroups } = rankByCountWithTotal([], (x: string) => x, 20)
    expect(rows).toEqual([])
    expect(totalGroups).toBe(0)
  })

  it("count 相同时 key 顺序稳定（同次数项的先后不影响计数正确性）", () => {
    const items = ["b", "a", "c"]
    const { rows, totalGroups } = rankByCountWithTotal(items, (x) => x, 20)
    expect(totalGroups).toBe(3)
    expect(rows.map((r) => r.count)).toEqual([1, 1, 1])
  })
})

describe("rankByCount（向后兼容）", () => {
  it("与 rankByCountWithTotal 的 rows 完全一致", () => {
    const items = Array.from({ length: 30 }, (_, i) => `p${i % 7}`)
    const plain = rankByCount(items, (x) => x, 5)
    const { rows } = rankByCountWithTotal(items, (x) => x, 5)
    expect(plain).toEqual(rows)
  })

  it("仍按 limit 截断", () => {
    const items = Array.from({ length: 30 }, (_, i) => `p${i}`)
    expect(rankByCount(items, (x) => x, 5)).toHaveLength(5)
  })
})
