/**
 * 数据管理 - 纯函数测试
 */
import { describe, expect, it } from "vitest"
import {
  formatBytes,
  formatTime,
  GROWTH_WARNING_BYTES,
  isGrowthWarning,
  sum,
} from "./utils"

describe("formatBytes", () => {
  it("按 B / KB / MB 分档", () => {
    expect(formatBytes(0)).toBe("0 B")
    expect(formatBytes(512)).toBe("512 B")
    expect(formatBytes(2048)).toBe("2.0 KB")
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.00 MB")
  })

  it("非法值归零", () => {
    expect(formatBytes(Number.NaN)).toBe("0 B")
    expect(formatBytes(-1)).toBe("0 B")
  })
})

describe("isGrowthWarning", () => {
  it("只有增长型且超过阈值才告警", () => {
    expect(isGrowthWarning(true, GROWTH_WARNING_BYTES + 1)).toBe(true)
    expect(isGrowthWarning(true, GROWTH_WARNING_BYTES)).toBe(false)
    expect(isGrowthWarning(false, GROWTH_WARNING_BYTES * 10)).toBe(false)
  })
})

describe("sum", () => {
  it("空数组为 0", () => {
    expect(sum([])).toBe(0)
    expect(sum([1, 2, 3])).toBe(6)
  })
})

describe("formatTime", () => {
  it("空值显示占位符", () => {
    expect(formatTime(undefined)).toBe("—")
    expect(formatTime(0)).toBe("—")
  })
})
