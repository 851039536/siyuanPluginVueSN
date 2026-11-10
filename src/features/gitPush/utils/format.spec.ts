// src/features/gitPush/utils/format.spec.ts — 展示格式化纯函数单元测试
//
// 覆盖重点：opSummary（推送/拉取输出条目与状态提示共用的摘要单一真源）。
import { describe, expect, it } from "vitest"
import { formatDateTime, opSummary } from "./format"

const i18n: Record<string, any> = {
  opPush: "推送",
  opPull: "拉取",
  opCommit: "提交",
  opResultOk: "{0}完成",
  opResultFail: "{0}失败",
}

// ── 操作结果摘要单一真源（推送/拉取输出条目共用，消除各处各自 split("\n")[0]）──

describe("opSummary", () => {
  it("优先取 git 原始输出的首个非空行（前后空白与空行剥离）", () => {
    expect(opSummary({ action: "commit", ok: true, i18n, raw: "\n  [main 3f2a1b9] feat: x\n第二行" }))
      .toBe("[main 3f2a1b9] feat: x")
  })

  it("无原始输出时按 action + ok 走 i18n 模板键兜底（不再有裸 'OK' / '操作完成'）", () => {
    expect(opSummary({ action: "push", ok: true, i18n })).toBe("推送完成")
    expect(opSummary({ action: "pull", ok: false, i18n })).toBe("拉取失败")
    expect(opSummary({ action: "commit", ok: true, i18n, raw: "   " })).toBe("提交完成")
  })

  it("相同输入下 commit 与 push 走完全相同的兜底模板（口径统一的实质）", () => {
    const raw = ""
    const commit = opSummary({ action: "commit", ok: true, i18n, raw })
    const push = opSummary({ action: "push", ok: true, i18n, raw })
    // 除动作词外，模板结构必须一致
    expect(commit.replace("提交", "{0}")).toBe(push.replace("推送", "{0}"))
  })
})

describe("formatDateTime", () => {
  it("有效 ISO 输出 YYYY-MM-DD HH:mm", () => {
    expect(formatDateTime("2026-08-12T14:35:09.000Z")).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
  })

  it("无效日期降级返回原串（new Date 不抛错）", () => {
    expect(formatDateTime("garbage")).toBe("garbage")
  })

  it("空值返回空串", () => {
    expect(formatDateTime("")).toBe("")
  })
})
