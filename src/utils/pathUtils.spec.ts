// src/renderer/src/utils/pathUtils.spec.ts — 路径 basename 单元测试
import { describe, expect, it } from "vitest"
import { pathBasename } from "./pathUtils"

describe("pathBasename", () => {
  it("无分隔符时原样返回", () => {
    expect(pathBasename("README.md")).toBe("README.md")
  })

  it("多级路径取最后一段", () => {
    expect(pathBasename("src/features/gitPush/index.vue")).toBe("index.vue")
  })

  it("空串返回空串", () => {
    expect(pathBasename("")).toBe("")
  })

  it("隐藏文件保留前导点", () => {
    expect(pathBasename("config/.gitignore")).toBe(".gitignore")
  })
})
