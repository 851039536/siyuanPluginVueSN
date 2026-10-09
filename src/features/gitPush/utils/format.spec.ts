// src/features/gitPush/utils/format.spec.ts — 展示格式化纯函数单元测试
//
// 覆盖重点：formatLogEntryText（表格行与详情弹窗共用的复制文本单一真源）。
// 历史 bug：两处各自拼接，行内用 `formatLogTime(time).slice(11)` 只留 HH:mm，
// 弹窗用完整 YYYY-MM-DD HH:mm —— 跨天日志从行内复制后无法分辨日期。本测试锁定统一口径。
import { describe, expect, it } from "vitest"
import { formatLogEntryText, formatLogTime, logDateKey, logDateLabel } from "./format"

const i18n: Record<string, any> = {
  logDateToday: "今天",
  logDateYesterday: "昨天",
}

describe("formatLogEntryText", () => {
  const base = {
    id: "1",
    time: "2026-08-12T14:35:09.000Z",
    projectId: "p1",
    projectName: "demo",
    action: "push" as const,
    ok: true,
    summary: "pushed 2 commits",
  }

  it("普通条目：'[完整日期时间] 项目名 — 摘要'（必须含日期，不可只有时分）", () => {
    const text = formatLogEntryText(base)
    expect(text).toContain(formatLogTime(base.time))
    // 核心回归：日期部分必须在（原行内复制只在前 11 位之后取值，会丢掉日期）
    expect(text).toContain("-")
    expect(text).toBe(`[${formatLogTime(base.time)}] demo — pushed 2 commits`)
  })

  it("日期不被截断：文本中的时间戳与 formatLogTime 完整一致", () => {
    const text = formatLogEntryText(base)
    const stamp = formatLogTime(base.time)
    expect(text.startsWith(`[${stamp}]`)).toBe(true)
    // YYYY-MM-DD HH:mm 共 16 字符，确认不是 slice(11) 后的 5 字符时分
    expect(stamp.length).toBe(16)
  })

  it("commit 条目：附带完整提交信息（换行分隔）", () => {
    const text = formatLogEntryText({ ...base, action: "commit", message: "feat: add x\n\nbody" })
    expect(text).toBe(`[${formatLogTime(base.time)}] demo\nfeat: add x\n\nbody`)
    expect(text).toContain("\n")
  })

  it("失败条目同样走摘要路径", () => {
    const text = formatLogEntryText({ ...base, ok: false, summary: "fatal: no upstream" })
    expect(text).toContain("fatal: no upstream")
    expect(text).toContain("—")
  })
})

describe("logDateKey", () => {
  it("ISO → 本地自然日 YYYY-MM-DD", () => {
    expect(logDateKey("2026-08-12T14:35:09.000Z")).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("无法解析的输入降级返回原串（不抛错）", () => {
    expect(logDateKey("not-a-date")).toBe("not-a-date")
    expect(logDateKey("")).toBe("")
  })
})

describe("logDateLabel", () => {
  it("今天 / 昨天 走 i18n 文案", () => {
    expect(logDateLabel(new Date().toISOString(), i18n)).toBe("今天")
    const y = new Date()
    y.setDate(y.getDate() - 1)
    expect(logDateLabel(y.toISOString(), i18n)).toBe("昨天")
  })

  it("更早的日期回落为 YYYY-MM-DD", () => {
    const old = new Date()
    old.setDate(old.getDate() - 5)
    expect(logDateLabel(old.toISOString(), i18n)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("按本地自然日比较：「今天 00:30」与「昨天 23:50」不混为同一天", () => {
    // 构造本地当天 00:30 与前一天 23:50
    const todayEarly = new Date()
    todayEarly.setHours(0, 30, 0, 0)
    const yestLate = new Date(todayEarly)
    yestLate.setDate(yestLate.getDate() - 1)
    yestLate.setHours(23, 50, 0, 0)
    expect(logDateLabel(todayEarly.toISOString(), i18n)).toBe("今天")
    expect(logDateLabel(yestLate.toISOString(), i18n)).toBe("昨天")
    // 两者日键必须不同（否则会被分到同一组）
    expect(logDateKey(todayEarly.toISOString())).not.toBe(logDateKey(yestLate.toISOString()))
  })

  it("非法输入返回原串", () => {
    expect(logDateLabel("garbage", i18n)).toBe("garbage")
  })
})
