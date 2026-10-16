// src/features/statistics/utils/index.spec.ts — 统计工具纯函数单元测试
// 覆盖：日期解析/格式化（跨时区与闰年边界）、字符处理、数字格式化、活跃度指标聚合
import {
  describe,
  expect,
  it,
} from "vitest"
import {
  computeActivityMetrics,
  formatDate,
  formatNumber,
  formatShortNumber,
  formatYmd,
  isValidDateStr,
  padZero,
  parseYmd,
  stripTags,
  toDashedYmd,
} from "./index"

describe("padZero", () => {
  it("个位数补零，两位数保持不变", () => {
    expect(padZero(0)).toBe("00")
    expect(padZero(5)).toBe("05")
    expect(padZero(9)).toBe("09")
    expect(padZero(10)).toBe("10")
    expect(padZero(59)).toBe("59")
  })
})

describe("formatYmd / formatDate", () => {
  it("输出紧凑 YYYYMMDD 与带连字符 YYYY-MM-DD", () => {
    expect(formatYmd(new Date(2026, 0, 5))).toBe("20260105")
    expect(formatDate(new Date(2026, 0, 5))).toBe("2026-01-05")
  })

  it("年末/月初边界不串位", () => {
    expect(formatYmd(new Date(2026, 11, 31))).toBe("20261231")
    expect(formatYmd(new Date(2026, 0, 1))).toBe("20260101")
  })

  it("闰日 2/29 正确格式化", () => {
    expect(formatYmd(new Date(2024, 1, 29))).toBe("20240229")
    expect(formatDate(new Date(2024, 1, 29))).toBe("2024-02-29")
  })
})

describe("parseYmd", () => {
  it("按本地时区解析为零点，月/日不减位错", () => {
    const d = parseYmd("20260105")
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(0)
    expect(d.getDate()).toBe(5)
    expect(d.getHours()).toBe(0)
  })

  it("与 formatYmd 互为逆运算（往返一致）", () => {
    for (const s of ["20260101", "20240229", "20261231", "20260615"]) {
      expect(formatYmd(parseYmd(s))).toBe(s)
    }
  })

  it("跨月相邻日相差恰好 1 天（连续天数计算依赖此性质）", () => {
    const a = parseYmd("20260131")
    const b = parseYmd("20260201")
    expect((b.getTime() - a.getTime()) / 86400000).toBe(1)
  })

  it("跨年相邻日相差恰好 1 天", () => {
    const a = parseYmd("20251231")
    const b = parseYmd("20260101")
    expect((b.getTime() - a.getTime()) / 86400000).toBe(1)
  })

  it("闰年 2/28→2/29→3/1 均相差 1 天", () => {
    const d28 = parseYmd("20240228")
    const d29 = parseYmd("20240229")
    const d01 = parseYmd("20240301")
    expect((d29.getTime() - d28.getTime()) / 86400000).toBe(1)
    expect((d01.getTime() - d29.getTime()) / 86400000).toBe(1)
  })
})

describe("toDashedYmd", () => {
  it("紧凑日期转带连字符格式", () => {
    expect(toDashedYmd("20260105")).toBe("2026-01-05")
    expect(toDashedYmd("20261231")).toBe("2026-12-31")
  })
})

describe("isValidDateStr", () => {
  it("仅接受 8 位纯数字", () => {
    expect(isValidDateStr("20260105")).toBe(true)
    expect(isValidDateStr("2026-01-05")).toBe(false)
    expect(isValidDateStr("2026010")).toBe(false)
    expect(isValidDateStr("202601051")).toBe(false)
    expect(isValidDateStr("")).toBe(false)
  })

  it("拒绝注入片段（该函数是 SQL 注入防线）", () => {
    expect(isValidDateStr("20260105' OR '1'='1")).toBe(false)
    expect(isValidDateStr("2026010; DROP TABLE blocks")).toBe(false)
  })
})

describe("stripTags", () => {
  it("移除 HTML 标签，保留文本", () => {
    expect(stripTags("<p>hello</p>")).toBe("hello")
    expect(stripTags("<span style=\"x\">a</span><b>b</b>")).toBe("ab")
  })

  it("无标签时原样返回", () => {
    expect(stripTags("plain text")).toBe("plain text")
  })

  it("空串安全", () => {
    expect(stripTags("")).toBe("")
  })
})

describe("formatNumber", () => {
  it("按千分位分组", () => {
    expect(formatNumber(0)).toBe("0")
    expect(formatNumber(999)).toBe("999")
    expect(formatNumber(1000)).toBe("1,000")
    expect(formatNumber(1234567)).toBe("1,234,567")
  })
})

describe("formatShortNumber", () => {
  it("0 与假值返回 \"0\"", () => {
    expect(formatShortNumber(0)).toBe("0")
  })

  it("1000 以下原样输出（不加千分位）", () => {
    expect(formatShortNumber(1)).toBe("1")
    expect(formatShortNumber(999)).toBe("999")
  })

  it("1000 起缩写为 K（保留一位小数）", () => {
    expect(formatShortNumber(1000)).toBe("1.0K")
    expect(formatShortNumber(1500)).toBe("1.5K")
    expect(formatShortNumber(9999)).toBe("10.0K")
    expect(formatShortNumber(999999)).toBe("1000.0K")
  })

  it("1000000 起缩写为 M", () => {
    expect(formatShortNumber(1000000)).toBe("1.0M")
    expect(formatShortNumber(1234567)).toBe("1.2M")
  })

  it("档位边界：999999 仍在 K 档，1000000 进位到 M", () => {
    expect(formatShortNumber(999999)).toBe("1000.0K")
    expect(formatShortNumber(1000000)).toBe("1.0M")
  })
})

describe("computeActivityMetrics", () => {
  const nb = (name: string, words: number[]) => ({
    notebook: name,
    color: "#000",
    data: words.map((w, i) => ({
      date: `2026-01-${padZero(i + 1)}`,
      dateLabel: `${i + 1}`,
      words: w,
    })),
  })

  it("空输入返回全零指标", () => {
    const m = computeActivityMetrics([])
    expect(m.summary.activeCount).toBe(0)
    expect(m.summary.totalWords).toBe(0)
    expect(m.summary.dailyAvg).toBe(0)
    expect(m.ranking).toEqual([])
  })

  it("汇总活跃笔记本数与期间总字数", () => {
    const m = computeActivityMetrics([
      nb("A", [10, 20]),
      nb("B", [5, 5]),
    ])
    expect(m.summary.activeCount).toBe(2)
    expect(m.summary.totalWords).toBe(40)
  })

  it("日均按「有写作的天数」计，而非日历天数", () => {
    // A 两天有写作(10,20)，B 只有一天(5,5 中一天为 0) → 活跃日集合 = {d1, d2}
    const m = computeActivityMetrics([
      nb("A", [10, 20, 0]),
      nb("B", [0, 5, 0]),
    ])
    // 活跃日 = 第1天(10,0→有) 第2天(20,5) 第3天(0,0→无) = 2 天
    expect(m.summary.dailyAvg).toBe(Math.round(35 / 2))
  })

  it("排行按总字数降序，最活跃笔记本取首位", () => {
    const m = computeActivityMetrics([
      nb("small", [1]),
      nb("big", [100]),
      nb("mid", [50]),
    ])
    expect(m.ranking.map((r) => r.notebook)).toEqual([
      "big",
      "mid",
      "small",
    ])
    expect(m.summary.mostActive).toBe("big")
  })
})
