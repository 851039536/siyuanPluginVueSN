// 提交节奏聚合（buildRhythmStats）单元测试
//
// 概览「时段分布」与代码报告共用该函数：入参只要求 { date }，故用最小结构验证
// 星期/时段分桶、连续天数、并列取首桶与非法日期跳过等契约。
import { describe, expect, it } from "vitest"
import { buildRhythmStats, emptyRhythmStats } from "./rhythm"

/** 本地时刻 → ISO（与 git %aI 同形态；按本地时间断言 getDay/getHours 口径） */
function iso(year: number, month: number, day: number, hour = 0, minute = 0): string {
  return new Date(year, month - 1, day, hour, minute).toISOString()
}

describe("buildRhythmStats（提交节奏）", () => {
  it("按星期与 2 小时桶聚合（2026-01-05 是周一）", () => {
    const rhythm = buildRhythmStats([
      { date: iso(2026, 1, 5, 1, 10) },
      { date: iso(2026, 1, 5, 14, 30) },
      { date: iso(2026, 1, 5, 14, 40) },
      { date: iso(2026, 1, 7, 23, 10) },
    ])
    expect(rhythm.weekday).toHaveLength(7)
    expect(rhythm.weekday[1].count).toBe(3)
    expect(rhythm.weekday[3].count).toBe(1)
    expect(rhythm.topWeekday.dow).toBe(1)
    expect(rhythm.hourly).toHaveLength(12)
    expect(rhythm.hourly[0].count).toBe(1)
    expect(rhythm.hourly[7].count).toBe(2)
    expect(rhythm.hourly[11].count).toBe(1)
    // peakHours.start 是时段起始小时（桶 7 = [14, 16)），不是桶下标
    expect(rhythm.peakHours.start).toBe(14)
  })

  it("最长连续天数：相邻日历日连算、隔天断开", () => {
    const rhythm = buildRhythmStats([
      { date: iso(2026, 1, 5, 9) },
      { date: iso(2026, 1, 6, 9) },
      { date: iso(2026, 1, 8, 9) },
    ])
    expect(rhythm.maxStreak).toBe(2)
  })

  it("非法日期跳过，不影响其他条目", () => {
    const rhythm = buildRhythmStats([
      { date: "not-a-date" },
      { date: iso(2026, 1, 5, 9) },
    ])
    expect(rhythm.weekday[1].count).toBe(1)
  })

  it("并列时取首桶（reduce 保留先遇到的峰值）", () => {
    const rhythm = buildRhythmStats([
      { date: iso(2026, 1, 5, 0, 30) },
      { date: iso(2026, 1, 5, 2, 30) },
    ])
    expect(rhythm.hourly[0].count).toBe(1)
    expect(rhythm.hourly[1].count).toBe(1)
    expect(rhythm.peakHours.start).toBe(0)
  })

  it("空输入：7/12 桶全零、最活跃星期回退周一、高峰回退首桶", () => {
    const rhythm = buildRhythmStats([])
    expect(rhythm.weekday.every((w) => w.count === 0)).toBe(true)
    expect(rhythm.hourly.every((h) => h.count === 0)).toBe(true)
    expect(rhythm.maxStreak).toBe(0)
    expect(rhythm.topWeekday.dow).toBe(1)
    expect(rhythm.peakHours.start).toBe(0)
    expect(emptyRhythmStats()).toEqual(rhythm)
  })
})
