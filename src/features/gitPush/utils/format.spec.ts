// src/features/gitPush/utils/format.spec.ts — 展示格式化纯函数单元测试
//
// 覆盖重点：formatLogEntryText（表格行与详情弹窗共用的复制文本单一真源）。
// 历史 bug：两处各自拼接，行内用 `formatLogTime(time).slice(11)` 只留 HH:mm，
// 弹窗用完整 YYYY-MM-DD HH:mm —— 跨天日志从行内复制后无法分辨日期。本测试锁定统一口径。
import { describe, expect, it } from "vitest"
import {
  deriveOpOk,
  formatLogEntryText,
  formatLogTime,
  hasLogDetail,
  hasLogPlatforms,
  logDateKey,
  logDateLabel,
  opLogSummary,
} from "./format"

const i18n: Record<string, any> = {
  logDateToday: "今天",
  logDateYesterday: "昨天",
  opPush: "推送",
  opPull: "拉取",
  opCommit: "提交",
  opResultOk: "{0}完成",
  opResultFail: "{0}失败",
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

  it("回归：判据是 action 而非 message 是否存在（push 带 message 也走摘要路径）", () => {
    // 原实现用 `entry.message` 判定，push 若携带关联提交信息会静默切换为多行格式并丢掉摘要
    const text = formatLogEntryText({ ...base, action: "push", message: "feat: 关联提交" })
    expect(text).toBe(`[${formatLogTime(base.time)}] demo — pushed 2 commits`)
    expect(text).not.toContain("\n")
  })

  it("回归：commit 无 message 时回落摘要路径（不产出尾部空行）", () => {
    const text = formatLogEntryText({ ...base, action: "commit" })
    expect(text).toBe(`[${formatLogTime(base.time)}] demo — pushed 2 commits`)
  })
})

// ── 操作日志摘要单一真源（commit 与 push/pull 埋点共用，消除三处各自 split("\n")[0]）──

describe("opLogSummary", () => {
  it("优先取 git 原始输出的首个非空行（前后空白与空行剥离）", () => {
    expect(opLogSummary({ action: "commit", ok: true, i18n, raw: "\n  [main 3f2a1b9] feat: x\n第二行" }))
      .toBe("[main 3f2a1b9] feat: x")
  })

  it("无原始输出时按 action + ok 走 i18n 模板键兜底（不再有裸 'OK' / '操作完成'）", () => {
    expect(opLogSummary({ action: "push", ok: true, i18n })).toBe("推送完成")
    expect(opLogSummary({ action: "pull", ok: false, i18n })).toBe("拉取失败")
    expect(opLogSummary({ action: "commit", ok: true, i18n, raw: "   " })).toBe("提交完成")
  })

  it("相同输入下 commit 与 push 走完全相同的兜底模板（口径统一的实质）", () => {
    const raw = ""
    const commit = opLogSummary({ action: "commit", ok: true, i18n, raw })
    const push = opLogSummary({ action: "push", ok: true, i18n, raw })
    // 除动作词外，模板结构必须一致
    expect(commit.replace("提交", "{0}")).toBe(push.replace("推送", "{0}"))
  })
})

describe("deriveOpOk", () => {
  it("跳过项不参与判定（全跳过时回落 fallback）", () => {
    expect(deriveOpOk([{ ok: false, skipped: true }], true)).toBe(true)
    expect(deriveOpOk([{ ok: false, skipped: true }], false)).toBe(false)
  })

  it("有非跳过项时取全体合取（部分失败即失败）", () => {
    expect(deriveOpOk([{ ok: true, skipped: false }, { ok: false, skipped: false }], true)).toBe(false)
    expect(deriveOpOk([{ ok: true, skipped: false }, { ok: false, skipped: true }], false)).toBe(true)
  })

  it("无平台明细（commit 路径）回落调用方结论", () => {
    expect(deriveOpOk(undefined, true)).toBe(true)
    expect(deriveOpOk(undefined, false)).toBe(false)
    expect(deriveOpOk([], true)).toBe(true)
  })
})

describe("hasLogDetail", () => {
  const base = {
    id: "1",
    time: "2026-08-12T14:35:09.000Z",
    projectId: "p1",
    projectName: "demo",
    ok: true,
    summary: "s",
  }

  it("push/pull 有 platforms → 可展开；无 platforms → 不可展开", () => {
    expect(hasLogDetail({ ...base, action: "push", platforms: [{ key: "github", label: "GitHub", ok: true, skipped: false, summary: "ok" }] })).toBe(true)
    expect(hasLogDetail({ ...base, action: "push" })).toBe(false)
  })

  it("commit 有 message → 可展开（与 push 共用同一展开范式）", () => {
    expect(hasLogDetail({ ...base, action: "commit", message: "feat: x" })).toBe(true)
    expect(hasLogDetail({ ...base, action: "commit" })).toBe(false)
  })

  it("commit 即使带了 platforms 也不误判为平台明细", () => {
    expect(hasLogPlatforms({ ...base, action: "commit", platforms: [{ key: "github", label: "G", ok: true, skipped: false, summary: "s" }] })).toBe(false)
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
