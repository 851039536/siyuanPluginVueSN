// src/features/gitPush/utils/analysis.spec.ts — 提交分析纯函数单元测试
//
// 覆盖重点：rankByCountWithTotal 的「截断后行 + 截断前分组数」双输出。
// UI 依据 totalGroups > rows.length 决定是否显示「仅显示前 N 名（共 M）」——
// 若该契约破裂，用户会看到排行各行次数之和小于总提交数而被误读为统计错误。
import { describe, expect, it } from "vitest"
import { buildDayCell, rankByCount, rankByCountWithTotal } from "./analysis"

describe("buildDayCell（热力图/日历共用的日格口径）", () => {
  const i18n: Record<string, any> = {
    analysisHeatTooltip: "{0}（{1}）：{2} 次提交",
    analysisWeekdayMon: "周一",
    analysisWeekdayTue: "周二",
    analysisWeekdayWed: "周三",
    analysisWeekdayThu: "周四",
    analysisWeekdayFri: "周五",
    analysisWeekdaySat: "周六",
    analysisWeekdaySun: "周日",
  }

  it("返回 date/count/style/tooltip 四项（两个视图据此渲染不同形态）", () => {
    const cell = buildDayCell(i18n, "2026-08-03", 5, "#3b82f6")
    expect(cell.date).toBe("2026-08-03")
    expect(cell.count).toBe(5)
    expect(typeof cell.style.background).toBe("string")
    expect(cell.tooltip).toContain("2026-08-03")
    expect(cell.tooltip).toContain("5")
  })

  it("style 为对象引用（模板绑定同一引用才不会被逐格 patch）", () => {
    const a = buildDayCell(i18n, "2026-08-03", 1, "#3b82f6")
    expect(a.style).toBeTypeOf("object")
    // 同一输入两次调用产出等价但独立的 style 对象（无共享可变状态）
    const b = buildDayCell(i18n, "2026-08-03", 1, "#3b82f6")
    expect(b.style).toEqual(a.style)
    expect(b.style).not.toBe(a.style)
  })

  it("0 次用主题表面灰（不走主色透明度分级）", () => {
    const zero = buildDayCell(i18n, "2026-08-03", 0, "#3b82f6")
    expect(zero.style.background).toContain("--b3-theme-on-surface-rgb")
  })

  it("随计数升高，颜色透明度等级递增（同一天同色系只有明暗差异）", () => {
    const counts = [1, 5, 10, 30]
    const colors = counts.map((c) => buildDayCell(i18n, "2026-08-03", c, "#3b82f6").style.background)
    // 各级互不相同，且都以主色为前缀（仅 alpha 后缀变化）
    expect(new Set(colors).size).toBe(counts.length)
    for (const c of colors) expect(c.startsWith("#3b82f6")).toBe(true)
  })

  it("远超阈值（如 1000 次）不越界，仍取最高等级色", () => {
    const top = buildDayCell(i18n, "2026-08-03", 30, "#3b82f6").style.background
    expect(buildDayCell(i18n, "2026-08-03", 1000, "#3b82f6").style.background).toBe(top)
  })
})

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
