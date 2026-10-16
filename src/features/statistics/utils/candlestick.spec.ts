import type { HistoricalDataItem } from "../types"
// src/features/statistics/utils/candlestick.spec.ts — K 线计算纯函数单元测试
// 覆盖：日内采样合并、蜡烛构建（采样优先/近似兜底）、均线窗口、上限截断
import {
  describe,
  expect,
  it,
} from "vitest"
import {
  buildStatCandles,
  calcCloseMa7,
  KLINE_METRICS,
  mergeOhlcSamples,
  STAT_MAX_CANDLES,
} from "./candlestick"

/** 构造历史项（仅填测试关心的字段） */
function item(
  date: string,
  totalWords: number,
  totalNotes = 0,
  ohlc?: HistoricalDataItem["ohlc"],
): HistoricalDataItem {
  return {
    date,
    dateLabel: date.slice(5),
    totalNotes,
    totalWords,
    totalBlocks: 0,
    todayCreated: 0,
    todayModified: 0,
    ohlc,
  }
}

describe("mergeOhlcSamples", () => {
  it("无历史采样时：open/high/low 三者均取当前值", () => {
    const result = mergeOhlcSamples(undefined, {
      totalWords: 100,
      totalNotes: 5,
    })
    expect(result.totalWords).toEqual({
      open: 100,
      high: 100,
      low: 100,
    })
    expect(result.totalNotes).toEqual({
      open: 5,
      high: 5,
      low: 5,
    })
  })

  it("已有采样时：open 保持首次值，high/low 外扩包络当前值", () => {
    const prev = {
      totalWords: {
        open: 100,
        high: 120,
        low: 90,
      },
    }
    const result = mergeOhlcSamples(prev, {
      totalWords: 150,
      totalNotes: 0,
    })
    expect(result.totalWords).toEqual({
      open: 100,
      high: 150,
      low: 90,
    })
  })

  it("当前值更低时 low 下移、high 不变（双向包络）", () => {
    const prev = {
      totalWords: {
        open: 100,
        high: 120,
        low: 90,
      },
    }
    const result = mergeOhlcSamples(prev, {
      totalWords: 50,
      totalNotes: 0,
    })
    expect(result.totalWords).toEqual({
      open: 100,
      high: 120,
      low: 50,
    })
  })

  it("一次采样覆盖全部 KLINE_METRICS 键", () => {
    const result = mergeOhlcSamples(undefined, {
      totalWords: 1,
      totalNotes: 2,
    })
    expect(Object.keys(result).sort()).toEqual([...KLINE_METRICS].sort())
  })
})

describe("buildStatCandles", () => {
  it("空输入返回空序列", () => {
    expect(buildStatCandles([], "totalWords")).toEqual([])
  })

  it("有日内采样时优先使用采样，且 high/low 校正为包络 open 与 close", () => {
    const candles = buildStatCandles([
      item("2026-01-01", 100, 0, {
        totalWords: {
          open: 80,
          high: 90,
          low: 85,
        },
      }),
    ], "totalWords")
    // 采样 high=90 低于 close=100 → 校正为 100；采样 low=85 高于 open=80 但低于 close → 保持 85
    expect(candles[0]).toMatchObject({
      open: 80,
      high: 100,
      low: 80,
      close: 100,
      approx: false,
    })
  })

  it("无采样时以「前日收盘为开盘」近似，并标记 approx=true", () => {
    const candles = buildStatCandles([
      item("2026-01-01", 100),
      item("2026-01-02", 120),
    ], "totalWords")
    expect(candles[1].approx).toBe(true)
    expect(candles[1].open).toBe(100)
    expect(candles[1].close).toBe(120)
    // 影线按实体跨度 15% 外扩（跨度 20 → 外扩 3）
    expect(candles[1].high).toBe(123)
    expect(candles[1].low).toBe(97)
  })

  it("首日无采样时开盘取当日收盘（无前日参照）", () => {
    const candles = buildStatCandles([item("2026-01-01", 100)], "totalWords")
    expect(candles[0].open).toBe(100)
    expect(candles[0].direction).toBe("flat")
  })

  it("数值持平时影线仍有最小外扩量（保证可见）", () => {
    const candles = buildStatCandles([
      item("2026-01-01", 100),
      item("2026-01-02", 100),
    ], "totalWords")
    // 跨度 0 → spread 取最小值 1
    expect(candles[1].high).toBe(101)
    expect(candles[1].low).toBe(99)
  })

  it("low 受 0 下界约束（不出现负值）", () => {
    const candles = buildStatCandles([
      item("2026-01-01", 0),
      item("2026-01-02", 0),
    ], "totalWords")
    expect(candles[1].low).toBe(0)
  })

  it("方向按相对前日收盘判定：涨/跌/平", () => {
    const candles = buildStatCandles([
      item("2026-01-01", 100),
      item("2026-01-02", 120),
      item("2026-01-03", 120),
      item("2026-01-04", 90),
    ], "totalWords")
    expect(candles.map((c) => c.direction)).toEqual([
      "flat",
      "up",
      "flat",
      "down",
    ])
  })

  it("输入为降序（最新在前）时先归一为升序，不依赖输入顺序", () => {
    const candles = buildStatCandles([
      item("2026-01-03", 300),
      item("2026-01-01", 100),
      item("2026-01-02", 200),
    ], "totalWords")
    expect(candles.map((c) => c.date)).toEqual([
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
    ])
  })

  it("超过 STAT_MAX_CANDLES 时仅保留最近 N 天", () => {
    const items: HistoricalDataItem[] = []
    for (let i = 0; i < STAT_MAX_CANDLES + 20; i++) {
      const d = new Date(2026, 0, 1)
      d.setDate(d.getDate() + i)
      const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      items.push(item(ymd, i))
    }
    const candles = buildStatCandles(items, "totalWords")
    expect(candles).toHaveLength(STAT_MAX_CANDLES)
    // 保留的是"最近"的，即末尾日期应为输入最后一天
    expect(candles[candles.length - 1].date).toBe(items[items.length - 1].date)
  })

  it("metric 切换读取对应字段", () => {
    const candles = buildStatCandles([item("2026-01-01", 100, 7)], "totalNotes")
    expect(candles[0].close).toBe(7)
  })
})

describe("calcCloseMa7", () => {
  it("前 6 日返回 null，第 7 日起给出 7 日窗口均值（四舍五入）", () => {
    const candles = buildStatCandles(
      Array.from({ length: 8 }, (_, i) => item(`2026-01-0${i + 1}`, (i + 1) * 10)),
      "totalWords",
    )
    const ma = calcCloseMa7(candles)
    expect(ma.slice(0, 6)).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
    ])
    // 第 7 日：收盘 10..70 → 均值 40
    expect(ma[6]).toBe(40)
    // 第 8 日：收盘 20..80 → 均值 50
    expect(ma[7]).toBe(50)
  })

  it("空输入返回空数组", () => {
    expect(calcCloseMa7([])).toEqual([])
  })
})
