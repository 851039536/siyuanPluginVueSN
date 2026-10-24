// src/features/gitPush/utils/reportFormat.spec.ts — 报告展示格式化纯函数单元测试
//
// 覆盖重点：splitPath 路径拆分边界、formatNet/formatSignedNet 的零值口径差异
// （作者排行表 0 → "0"，文件详情弹窗 0 → "+0"，两处展示语义不同，勿合并）、churnText 百分比取整。
import { describe, expect, it } from "vitest"
import { churnText, formatNet, formatSignedNet, splitPath } from "./reportFormat"

describe("splitPath", () => {
  it("常规路径：dir 保留尾部斜杠，base 为文件名", () => {
    expect(splitPath("src/features/a.ts")).toEqual({ dir: "src/features/", base: "a.ts" })
    expect(splitPath("a.ts")).toEqual({ dir: "", base: "a.ts" })
  })

  it("无斜杠路径：dir 空串", () => {
    expect(splitPath("README.md")).toEqual({ dir: "", base: "README.md" })
    expect(splitPath("")).toEqual({ dir: "", base: "" })
  })

  it("多级嵌套与尾部文件名含点均正确", () => {
    expect(splitPath("a/b/c/d.e.f.g")).toEqual({ dir: "a/b/c/", base: "d.e.f.g" })
  })
})

describe("formatNet（作者排行表口径：0 不带符号）", () => {
  it("正数带 +，负数原样，零显示 0", () => {
    expect(formatNet(12)).toBe("+12")
    expect(formatNet(-3)).toBe("-3")
    expect(formatNet(0)).toBe("0")
  })
})

describe("formatSignedNet（文件详情弹窗口径：非负均带 +）", () => {
  it("零显示 +0，与 formatNet 刻意不同", () => {
    expect(formatSignedNet(0)).toBe("+0")
    expect(formatSignedNet(5)).toBe("+5")
    expect(formatSignedNet(-5)).toBe("-5")
    expect(formatSignedNet(0)).not.toBe(formatNet(0))
  })
})

describe("churnText", () => {
  it("转百分比并四舍五入", () => {
    expect(churnText(0.2)).toBe("20%")
    expect(churnText(0.256)).toBe("26%")
    expect(churnText(0)).toBe("0%")
    expect(churnText(1)).toBe("100%")
  })
})
