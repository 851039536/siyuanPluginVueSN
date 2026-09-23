// src/features/globalRelations/utils.spec.ts — parseAnchorText 纯函数行为断言
import { describe, expect, it } from "vitest"
import { parseAnchorText } from "./utils"

describe("parseAnchorText", () => {
  it("null / undefined 返回空串", () => {
    expect(parseAnchorText(null)).toBe("")
    expect(parseAnchorText(undefined)).toBe("")
  })

  it("空白字符串返回空串", () => {
    expect(parseAnchorText("")).toBe("")
    expect(parseAnchorText("   ")).toBe("")
    expect(parseAnchorText("\n\t")).toBe("")
  })

  it("非字符串输入取 String()", () => {
    expect(parseAnchorText(123)).toBe("123")
    expect(parseAnchorText(true)).toBe("true")
  })

  it("明文锚文本原样返回", () => {
    expect(parseAnchorText("普通锚文本")).toBe("普通锚文本")
    expect(parseAnchorText("  trimmed  ")).toBe("trimmed")
  })

  it("JSON 字符串字面量解出内层字符串", () => {
    expect(parseAnchorText('"引用文本"')).toBe("引用文本")
  })

  it("JSON 数组仅保留字符串项并以空格连接", () => {
    expect(parseAnchorText('["a","b"]')).toBe("a b")
    expect(parseAnchorText('["a",1,"b"]')).toBe("a b")
    expect(parseAnchorText("[1,2]")).toBe("")
  })

  it("JSON 对象按 text / content / name / anchor 优先序取字段", () => {
    expect(parseAnchorText('{"text":"T"}')).toBe("T")
    expect(parseAnchorText('{"content":"C"}')).toBe("C")
    expect(parseAnchorText('{"name":"N"}')).toBe("N")
    expect(parseAnchorText('{"anchor":"A"}')).toBe("A")
    // text 优先级最高
    expect(parseAnchorText('{"text":"T","content":"C"}')).toBe("T")
  })

  it("JSON 对象无可用文本字段时序列化返回", () => {
    expect(parseAnchorText('{"foo":"bar"}')).toBe('{"foo":"bar"}')
  })

  it("看起来像 JSON 但解析失败时按明文返回", () => {
    expect(parseAnchorText("{not json")).toBe("{not json")
    expect(parseAnchorText("[1,2")).toBe("[1,2")
  })

  it("JSON 标量兜底返回原文（数字/布尔/number 字面量）", () => {
    // JSON.parse("123") 得 number，非 string/array/object ⇒ 走 return trimmed
    expect(parseAnchorText("123")).toBe("123")
    expect(parseAnchorText("true")).toBe("true")
  })
})
