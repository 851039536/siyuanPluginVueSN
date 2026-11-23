// diffPolicy.spec.ts — 变更集失败后的按文件加载门槛
import { describe, expect, it } from "vitest"
import { shouldAutoLoadDiff } from "./diffPolicy"

describe("shouldAutoLoadDiff", () => {
  it("规模未知时允许加载（未跟踪 / overview 不可用）", () => {
    expect(shouldAutoLoadDiff(undefined)).toBe(true)
  })

  it("二进制文件改为点击加载", () => {
    expect(shouldAutoLoadDiff({
      add: 0,
      del: 0,
      binary: true,
    })).toBe(false)
  })

  it("改动行数超过阈值改为点击加载，边界值仍自动加载", () => {
    expect(shouldAutoLoadDiff({
      add: 2000,
      del: 1000,
      binary: false,
    })).toBe(true)
    expect(shouldAutoLoadDiff({
      add: 2000,
      del: 1001,
      binary: false,
    })).toBe(false)
  })
})
