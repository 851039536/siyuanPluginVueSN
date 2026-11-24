// reflog 解析：NUL 三列（hash / 说明 / 选择器）+ 坏行跳过
import { describe, expect, it } from "vitest"
import { parseReflog } from "./reflogParse"

const H1 = "a".repeat(40)
const H2 = "b".repeat(40)

describe("parseReflog", () => {
  it("按 NUL 切分 hash / 说明 / 选择器（说明里的空格不参与切分）", () => {
    const raw = [
      `${H1}\x00commit: 修复 登录 流程\x00HEAD@{2026-11-24 09:00:00 +0800}`,
      `${H2}\x00reset: moving to ${H1.slice(0, 7)}\x00HEAD@{2026-11-23 10:00:00 +0800}`,
    ].join("\n")
    expect(parseReflog(raw)).toEqual([
      { hash: H1, subject: "commit: 修复 登录 流程", selector: "HEAD@{2026-11-24 09:00:00 +0800}" },
      { hash: H2, subject: `reset: moving to ${H1.slice(0, 7)}`, selector: "HEAD@{2026-11-23 10:00:00 +0800}" },
    ])
  })

  it("空行、非 hash 行、缺选择器行一律跳过（并发写入/半行不抛错）", () => {
    const raw = [
      "",
      `not-a-hash\x00whatever\x00HEAD@{0}`,
      `${H1}\x00commit: ok\x00`,
      `${H2}\x00commit: ok\x00HEAD@{0}`,
      "   ",
    ].join("\r\n")
    expect(parseReflog(raw)).toEqual([
      { hash: H2, subject: "commit: ok", selector: "HEAD@{0}" },
    ])
  })

  it("空输入返回空数组", () => {
    expect(parseReflog("")).toEqual([])
  })
})
