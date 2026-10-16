// src/features/statistics/queries/reportMath.spec.ts — 报告纯计算逻辑单元测试
// 覆盖：按日聚合派生（替换原 4 条 SQL 的核心逻辑）、最长连续段边界、线性回归与预测口径
//
// 说明：刻意从 reportMath 直接导入而非 reportStats——后者经 executeSql 拉入运行时 `siyuan` 包
// （其 exports 字段在 Vitest 的 node 条件下不可解析）。SQL 层等价性已由真实库对照验证，
// 本文件负责锁住「公式」这一层的回归。
import {
  describe,
  expect,
  it,
} from "vitest"
import {
  derivePeriodStatsFromDaily,
  linearFit,
  longestStreakFromDates,
  projectSum,
} from "./reportMath"

/** 构造按日聚合行 */
function row(date: string, words: number) {
  return {
    date,
    words,
  }
}

describe("derivePeriodStatsFromDaily", () => {
  it("空输入返回全零（不抛错）", () => {
    expect(derivePeriodStatsFromDaily([])).toEqual({
      totalWords: 0,
      activeDays: 0,
      maxWordsDay: {
        date: "",
        words: 0,
      },
      longestStreak: 0,
    })
  })

  it("totalWords 为各日求和，activeDays 为行数", () => {
    const r = derivePeriodStatsFromDaily([
      row("20260101", 100),
      row("20260103", 250),
      row("20260105", 50),
    ])
    expect(r.totalWords).toBe(400)
    expect(r.activeDays).toBe(3)
  })

  it("maxWordsDay 取字数最大的一天，并转为带连字符日期", () => {
    const r = derivePeriodStatsFromDaily([
      row("20260101", 100),
      row("20260102", 999),
      row("20260103", 50),
    ])
    expect(r.maxWordsDay).toEqual({
      date: "2026-01-02",
      words: 999,
    })
  })

  it("连续日期 → 最长连续段等于天数", () => {
    const r = derivePeriodStatsFromDaily([
      row("20260101", 10),
      row("20260102", 10),
      row("20260103", 10),
      row("20260104", 10),
    ])
    expect(r.longestStreak).toBe(4)
  })

  it("中断日期切分连续段，取最长的一段", () => {
    // 连续 3 天 + 断 1 天 + 连续 2 天 → 最长 3
    const r = derivePeriodStatsFromDaily([
      row("20260101", 10),
      row("20260102", 10),
      row("20260103", 10),
      // 01-04 缺失
      row("20260105", 10),
      row("20260106", 10),
    ])
    expect(r.longestStreak).toBe(3)
  })

  it("字数为 0 的活跃日仍计入连续段（有记录即活跃）", () => {
    const r = derivePeriodStatsFromDaily([
      row("20260101", 0),
      row("20260102", 0),
    ])
    expect(r.longestStreak).toBe(2)
    expect(r.totalWords).toBe(0)
  })

  it("words 为 null/undefined 时按 0 处理，不产生 NaN", () => {
    const r = derivePeriodStatsFromDaily([
      { date: "20260101" } as { date: string, words: number },
      row("20260102", 100),
    ])
    expect(r.totalWords).toBe(100)
    expect(Number.isNaN(r.totalWords)).toBe(false)
  })
})

describe("longestStreakFromDates", () => {
  it("空输入返回 0", () => {
    expect(longestStreakFromDates([])).toBe(0)
  })

  it("单日返回 1", () => {
    expect(longestStreakFromDates(["20260101"])).toBe(1)
  })

  it("同日重复不影响结果（内部去重）", () => {
    expect(longestStreakFromDates(["20260101", "20260101", "20260102"])).toBe(2)
  })

  it("输入乱序时不受影响（内部先排序）", () => {
    expect(longestStreakFromDates(["20260103", "20260101", "20260102"])).toBe(3)
  })

  it("跨越月份边界仍视为连续", () => {
    expect(longestStreakFromDates(["20260130", "20260131", "20260201"])).toBe(3)
  })

  it("跨越年份边界仍视为连续", () => {
    expect(longestStreakFromDates(["20251231", "20260101"])).toBe(2)
  })

  it("跨越闰日 2024-02-29 仍视为连续", () => {
    expect(longestStreakFromDates(["20240228", "20240229", "20240301"])).toBe(3)
  })

  it("非闰年的 2/28→3/1 也视为连续（相差 1 天）", () => {
    expect(longestStreakFromDates(["20260228", "20260301"])).toBe(2)
  })

  it("间隔超过 1 天则断开", () => {
    expect(longestStreakFromDates(["20260101", "20260103"])).toBe(1)
  })
})

describe("projectSum（下月预计口径）", () => {
  it("平稳趋势（slope=0）时等于 单日值 × 天数", () => {
    expect(projectSum(0, 1000, 30, 30)).toBe(30000)
  })

  it("上升趋势下小于「取末日单值再乘天数」的旧算法（旧算法高估）", () => {
    const slope = 100
    const intercept = 1000
    const n = 30
    const fixed = projectSum(slope, intercept, n, 30)
    const buggy = Math.round((slope * (n + 30) + intercept) * 30)
    expect(fixed).toBeLessThan(buggy)
  })

  it("平稳趋势下新旧算法结果一致（旧算法仅在趋势项上出错）", () => {
    const n = 30
    const fixed = projectSum(0, 1000, n, 30)
    const buggy = Math.round((0 * (n + 30) + 1000) * 30)
    expect(fixed).toBe(buggy)
  })

  it("下降趋势下逐日取 max(0,...)，不产生负值", () => {
    expect(projectSum(-100, 500, 30, 30)).toBeGreaterThanOrEqual(0)
  })

  it("下降趋势极陡时结果为 0（所有预测日归零）", () => {
    // 从第 0 天起预测即为负 → 全部 clamp 到 0
    expect(projectSum(-1000, 100, 30, 30)).toBe(0)
  })

  it("30 天总和大于 7 天总和（趋势非负）", () => {
    const slope = 111.21
    const intercept = 729.32
    const n = 30
    expect(projectSum(slope, intercept, n, 30)).toBeGreaterThan(projectSum(slope, intercept, n, 7))
  })

  it("与逐日累加的手工计算一致", () => {
    const slope = 10
    const intercept = 100
    const n = 5
    let manual = 0
    for (let i = 0; i < 30; i++) manual += Math.max(0, slope * (n + i) + intercept)
    expect(projectSum(slope, intercept, n, 30)).toBe(Math.round(manual))
  })
})

describe("linearFit", () => {
  it("完美线性序列的 slope/intercept 精确，R²=1", () => {
    const {
      slope,
      intercept,
      rSquared,
    } = linearFit([0, 10, 20, 30, 40])
    expect(slope).toBeCloseTo(10, 10)
    expect(intercept).toBeCloseTo(0, 10)
    expect(rSquared).toBeCloseTo(1, 10)
  })

  it("恒定序列 slope=0 且 R²=0（ssTot 为 0 时不产生 NaN）", () => {
    const {
      slope,
      rSquared,
    } = linearFit([50, 50, 50])
    expect(slope).toBe(0)
    expect(rSquared).toBe(0)
    expect(Number.isNaN(rSquared)).toBe(false)
  })

  it("单元素输入返回 slope=0、intercept=该值", () => {
    const {
      slope,
      intercept,
      rSquared,
    } = linearFit([42])
    expect(slope).toBe(0)
    expect(intercept).toBe(42)
    expect(rSquared).toBe(0)
  })

  it("空输入安全返回全零", () => {
    expect(linearFit([])).toEqual({
      slope: 0,
      intercept: 0,
      rSquared: 0,
    })
  })

  it("r² 被约束在 [0,1] 区间内", () => {
    const { rSquared } = linearFit([1, 100, 2, 90, 3])
    expect(rSquared).toBeGreaterThanOrEqual(0)
    expect(rSquared).toBeLessThanOrEqual(1)
  })

  it("下降趋势 slope 为负", () => {
    const { slope } = linearFit([100, 80, 60, 40])
    expect(slope).toBeLessThan(0)
  })
})
