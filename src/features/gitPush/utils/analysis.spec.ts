// src/features/gitPush/utils/analysis.spec.ts — 提交分析纯函数单元测试
//
// 覆盖重点：rankByCountWithTotal 的「截断后行 + 截断前分组数」双输出。
// UI 依据 totalGroups > rows.length 决定是否显示「仅显示前 N 名（共 M）」——
// 若该契约破裂，用户会看到排行各行次数之和小于总提交数而被误读为统计错误。
import { describe, expect, it } from "vitest"
import {
  buildDayCell,
  buildDayMetricMap,
  computeHeatThresholds,
  HEAT_SCALE_QUANTILES,
  heatLevel,
  isDayKeyInBucket,
  rankByCountWithTotal,
  summarizeCommitRange,
  summarizeHeatRange,
} from "./analysis"

describe("buildDayCell（热力图/日历共用的日格口径）", () => {
  const i18n: Record<string, any> = {
    analysisHeatTooltip: "{0}（{1}）：{2} {3}",
    analysisHeatUnitCommits: "次提交",
    analysisHeatUnitProjects: "个项目",
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

  it("传入自适应阈值时按新档位取色（同一天可因档位不同而降级）", () => {
    // 固定档下 5 次属 level 2（≥3），自适应档 [0,1,2,3,4] 下升到 level 4
    const fixed = buildDayCell(i18n, "2026-08-03", 5, "#3b82f6").style.background
    const auto = buildDayCell(i18n, "2026-08-03", 5, "#3b82f6", { thresholds: [0, 1, 2, 3, 4] }).style.background
    expect(auto).not.toBe(fixed)
  })

  it("tooltip 量词随指标口径替换（{3} 由 unitKey 决定）", () => {
    expect(buildDayCell(i18n, "2026-08-03", 3, "#3b82f6").tooltip).toContain("次提交")
    expect(buildDayCell(i18n, "2026-08-03", 3, "#3b82f6", { unitKey: "analysisHeatUnitProjects" }).tooltip).toContain("个项目")
  })
})

describe("computeHeatThresholds（自适应分档）", () => {
  const FIXED = [0, 1, 3, 6, 12]

  it("返回与固定档同形的 5 项数组（首项 0，供 heatLevel 直接使用）", () => {
    const t = computeHeatThresholds([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(t).toHaveLength(5)
    expect(t[0]).toBe(0)
  })

  it("阈值取非零日的对应分位点（零值日不参与，否则档位被整体压低）", () => {
    // 非零日 1..10 各一天 → P50=5 / P75=8 / P90=9 / P95=10
    expect(computeHeatThresholds([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toEqual([0, 5, 8, 9, 10])
    // 穿插零值日不改变结果（零值日本身恒为 0 级）
    expect(computeHeatThresholds([0, 0, 1, 2, 3, 0, 4, 5, 6, 7, 8, 9, 10, 0])).toEqual([0, 5, 8, 9, 10])
    expect(HEAT_SCALE_QUANTILES).toHaveLength(4)
  })

  it("观测最大值必落在最高档（阈值钳制在最大值以内，不会出现「谁都到不了 4 级」）", () => {
    const t = computeHeatThresholds([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(heatLevel(10, t)).toBe(4)
    expect(heatLevel(0, t)).toBe(0)
  })

  it("单个尖峰不被平均掉：普通日保持浅色，尖峰日仍是最深一档", () => {
    // 1 次 × 5 天 + 100 次 × 1 天 → 阈值 [0,1,2,100,100]
    const t = computeHeatThresholds([1, 1, 1, 1, 1, 100])
    expect(heatLevel(1, t)).toBe(1)
    expect(heatLevel(100, t)).toBe(4)
  })

  it("四档塌成同一级（所有非零日次数相同）时退回固定档，避免整片同色", () => {
    expect(computeHeatThresholds([1, 1, 1, 1])).toEqual(FIXED)
    expect(computeHeatThresholds([7])).toEqual(FIXED)
  })

  it("范围内无提交时退回固定档，且所有格子仍为 0 级", () => {
    expect(computeHeatThresholds([0, 0, 0])).toEqual(FIXED)
    expect(computeHeatThresholds([])).toEqual(FIXED)
    expect(heatLevel(0, computeHeatThresholds([]))).toBe(0)
  })

  it("阈值单调不减（heatLevel 的逆序扫描依赖该性质）", () => {
    for (const counts of [[3, 5, 9, 20], [1, 1, 1, 5], [2, 3, 3, 5, 5, 8, 9, 12, 20]]) {
      const t = computeHeatThresholds(counts)
      for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThanOrEqual(t[i - 1])
    }
  })
})

describe("isDayKeyInBucket（聚合 K 线的「今日」定位）", () => {
  it("桶内首日与末日都命中", () => {
    expect(isDayKeyInBucket("2026-10-01", "2026-10-01", 2)).toBe(true)
    expect(isDayKeyInBucket("2026-10-02", "2026-10-01", 2)).toBe(true)
  })

  it("桶结束后不再命中（旧数据范围不得标为今天）", () => {
    expect(isDayKeyInBucket("2026-10-03", "2026-10-01", 2)).toBe(false)
    expect(isDayKeyInBucket("2026-10-24", "2021-01-01", 2)).toBe(false)
  })

  it("早于桶首日不命中；跨月/跨年按真实日历天数计算", () => {
    expect(isDayKeyInBucket("2026-09-30", "2026-10-01", 2)).toBe(false)
    expect(isDayKeyInBucket("2027-01-01", "2026-12-31", 2)).toBe(true)
    expect(isDayKeyInBucket("2026-03-01", "2026-02-27", 3)).toBe(true)
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

describe("buildDayMetricMap（热力指标切换的聚合口径）", () => {
  /** 构造条目（只关心 date / projectId / author 三个字段） */
  function entry(date: string, projectId: string, author: string) {
    return {
      projectId,
      projectName: projectId,
      hash: `${projectId}-${date}-${author}`,
      message: "feat: x",
      author,
      date,
    }
  }

  const entries = [
    entry("2026-08-03T09:00:00", "p1", "alice"),
    entry("2026-08-03T14:00:00", "p1", "alice"),
    entry("2026-08-03T20:00:00", "p2", "bob"),
    entry("2026-08-04T10:00:00", "p1", "alice"),
  ]

  it("commits：按当日提交条数计（同一人同项目两条也算 2）", () => {
    const map = buildDayMetricMap(entries, "commits")
    expect(map.get("2026-08-03")).toBe(3)
    expect(map.get("2026-08-04")).toBe(1)
  })

  it("projects：按当日去重项目数计", () => {
    const map = buildDayMetricMap(entries, "projects")
    expect(map.get("2026-08-03")).toBe(2)
    expect(map.get("2026-08-04")).toBe(1)
  })

  it("authors：按当日去重作者数计", () => {
    const map = buildDayMetricMap(entries, "authors")
    expect(map.get("2026-08-03")).toBe(2)
    expect(map.get("2026-08-04")).toBe(1)
  })

  it("无效日期被跳过，不产生 NaN 键", () => {
    const map = buildDayMetricMap([entry("not-a-date", "p1", "alice")], "authors")
    expect(map.size).toBe(0)
  })
})

describe("summarizeHeatRange（标题行摘要：连续 / 最长 / 合计）", () => {
  function toMap(pairs: [string, number][]) {
    return new Map(pairs)
  }

  it("连续天数从范围末尾往回数，遇到断档即停", () => {
    const map = toMap([["2026-08-01", 2], ["2026-08-02", 0], ["2026-08-03", 1], ["2026-08-04", 4]])
    const s = summarizeHeatRange(map, "2026-08-01", "2026-08-04")
    expect(s.currentStreak).toBe(2) // 08-03、08-04
    expect(s.longestStreak).toBe(2)
    expect(s.activeDays).toBe(3)
    expect(s.total).toBe(7)
  })

  it("末尾无数据时当前连续为 0，但最长连续仍取历史最长段", () => {
    const map = toMap([["2026-08-01", 1], ["2026-08-02", 1], ["2026-08-03", 1]])
    const s = summarizeHeatRange(map, "2026-08-01", "2026-08-05")
    expect(s.currentStreak).toBe(0)
    expect(s.longestStreak).toBe(3)
  })

  it("中间断档时最长连续取最长的一段", () => {
    const map = toMap([["2026-08-01", 1], ["2026-08-02", 1], ["2026-08-04", 1]])
    const s = summarizeHeatRange(map, "2026-08-01", "2026-08-04")
    expect(s.longestStreak).toBe(2)
    expect(s.currentStreak).toBe(1)
  })

  it("只统计范围内的天（范围外的键不计入合计与连续）", () => {
    const map = toMap([["2026-07-31", 99], ["2026-08-01", 1]])
    const s = summarizeHeatRange(map, "2026-08-01", "2026-08-01")
    expect(s.total).toBe(1)
    expect(s.activeDays).toBe(1)
    expect(s.currentStreak).toBe(1)
  })

  it("空范围（起止同一天且无数据）返回全零", () => {
    const s = summarizeHeatRange(new Map(), "2026-08-01", "2026-08-01")
    expect(s).toEqual({ total: 0, activeDays: 0, currentStreak: 0, longestStreak: 0 })
  })
})

describe("summarizeCommitRange（框选区间的聚合口径）", () => {
  /** 构造条目（只关心 date / projectId / projectName / author 四个字段） */
  function entry(date: string, projectId: string, author: string) {
    return {
      projectId,
      projectName: `${projectId}-name`,
      hash: `${projectId}-${date}-${author}`,
      message: "feat: x",
      author,
      date,
    }
  }

  const entries = [
    entry("2026-08-01T09:00:00", "p1", "alice"),
    entry("2026-08-01T10:00:00", "p2", "bob"),
    entry("2026-08-03T10:00:00", "p1", "alice"),
    entry("2026-08-03T11:00:00", "p1", "alice"),
    entry("2026-08-03T12:00:00", "p1", "carol"),
    entry("2026-08-09T12:00:00", "p2", "bob"), // 区间外
  ]

  it("按本地日期裁剪闭区间，边界两端都算在内", () => {
    const s = summarizeCommitRange(entries, "2026-08-01", "2026-08-03")
    expect(s.total).toBe(5)
  })

  it("daySpan 为闭区间天数（8/01–8/03 共 3 天，含无提交的 8/02）", () => {
    expect(summarizeCommitRange(entries, "2026-08-01", "2026-08-03").daySpan).toBe(3)
    // 单日区间 = 1 天，不能算成 0
    expect(summarizeCommitRange(entries, "2026-08-01", "2026-08-01").daySpan).toBe(1)
  })

  it("activeDays 只数有提交的天，与 daySpan 并列才能看出空档", () => {
    const s = summarizeCommitRange(entries, "2026-08-01", "2026-08-03")
    expect(s.activeDays).toBe(2)
  })

  it("项目数 / 作者数按去重计", () => {
    const s = summarizeCommitRange(entries, "2026-08-01", "2026-08-03")
    expect(s.projectCount).toBe(2) // p1、p2
    expect(s.authorCount).toBe(3) // alice、bob、carol
  })

  it("最活跃一天取提交数最多者", () => {
    const s = summarizeCommitRange(entries, "2026-08-01", "2026-08-03")
    expect(s.busiest).toEqual({ date: "2026-08-03", count: 3 })
  })

  it("最活跃一天并列时取较早的一天（不依赖 Map 插入序）", () => {
    const tie = [
      entry("2026-08-05T09:00:00", "p1", "alice"),
      entry("2026-08-04T09:00:00", "p2", "bob"),
    ]
    expect(summarizeCommitRange(tie, "2026-08-01", "2026-08-07").busiest).toEqual({
      date: "2026-08-04",
      count: 1,
    })
  })

  it("项目 / 作者排行降序并按 rankLimit 截断", () => {
    const s = summarizeCommitRange(entries, "2026-08-01", "2026-08-03", 1)
    expect(s.topProjects).toEqual([{ key: "p1", count: 4 }]) // 8/01 一条 + 8/03 三条
    expect(s.topAuthors).toEqual([{ key: "alice", count: 3 }])
  })

  it("空区间返回零值，busiest 为 null（不是 {count:0} 的假条目）", () => {
    const s = summarizeCommitRange(entries, "2026-07-01", "2026-07-31")
    expect(s.total).toBe(0)
    expect(s.activeDays).toBe(0)
    expect(s.busiest).toBeNull()
    expect(s.topProjects).toEqual([])
    expect(s.topAuthors).toEqual([])
  })

  it("无效日期条目被跳过，不会污染统计", () => {
    const s = summarizeCommitRange([entry("not-a-date", "p1", "alice")], "2026-08-01", "2026-08-03")
    expect(s.total).toBe(0)
  })
})
