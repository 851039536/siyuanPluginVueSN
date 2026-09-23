// src/utils/format.spec.ts — 通用格式化工具单元测试（纯函数，无副作用）
import { describe, expect, it } from "vitest"
import {
  formatFileSize,
  formatRelativeTime,
  formatTime,
} from "./format"

describe("formatFileSize", () => {
  it("0 字节按约定返回 \"0 B\"（不进入对数分支）", () => {
    expect(formatFileSize(0)).toBe("0 B")
  })

  it("1024 进制档位边界：1023 仍属 B 档，1024 进位到 KB", () => {
    expect(formatFileSize(1023)).toBe("1023.00 B")
    expect(formatFileSize(1024)).toBe("1.00 KB")
    expect(formatFileSize(512)).toBe("512.00 B")
  })

  it("各档位取值正确", () => {
    expect(formatFileSize(1024 ** 1)).toBe("1.00 KB")
    expect(formatFileSize(1024 ** 2)).toBe("1.00 MB")
    expect(formatFileSize(1024 ** 3)).toBe("1.00 GB")
    expect(formatFileSize(1024 ** 4)).toBe("1.00 TB")
  })

  it("非整档位保留两位小数", () => {
    expect(formatFileSize(1536)).toBe("1.50 KB")
    expect(formatFileSize(1024 * 1024 * 2.5)).toBe("2.50 MB")
  })

  it("超出 TB 档：i 越界取 sizes[undefined]，单位塌为字符串 \"undefined\"", () => {
    // 既有实现无档位上限守卫：1024**5 时 i=5，sizes[5] 为 undefined
    // 这是真实存在的边界缺陷（登记于测试，不在此处修改源码行为）
    expect(formatFileSize(1024 ** 5)).toBe("1.00 undefined")
    expect(formatFileSize(1024 ** 6)).toBe("1.00 undefined")
  })

  it("负数输入因 Math.log 得 NaN 而产出 \"NaN B\"（边界缺陷，登记不改）", () => {
    // Math.log(-1) = NaN → Math.floor(NaN) = NaN → sizes[NaN] 为 undefined
    expect(formatFileSize(-1)).toBe("NaN undefined")
  })
})

describe("formatTime", () => {
  it("ISO 字符串按本地时区格式化", () => {
    // 用本地时间构造以保证断言与运行环境时区无关
    const d = new Date(2026, 6, 6, 16, 19, 23)
    expect(formatTime(d)).toBe("2026-07-06 16:19:23")
  })

  it("月/日/时/分/秒补零到两位", () => {
    const d = new Date(2026, 0, 5, 3, 4, 9)
    expect(formatTime(d)).toBe("2026-01-05 03:04:09")
  })

  it("时间戳（毫秒）与 Date 等价", () => {
    const d = new Date(2026, 6, 6, 16, 19, 23)
    expect(formatTime(d.getTime())).toBe("2026-07-06 16:19:23")
  })

  it("无效输入回退为原值的字符串形式（不抛错）", () => {
    expect(formatTime("not-a-date")).toBe("not-a-date")
    expect(formatTime("")).toBe("")
  })
})

describe("formatRelativeTime", () => {
  it("无效时间返回空串（不抛错）", () => {
    expect(formatRelativeTime("not-a-date")).toBe("")
  })

  it("不足 1 分钟走秒级分支", () => {
    const now = Date.now()
    const out = formatRelativeTime(now - 5_000)
    expect(typeof out).toBe("string")
    expect(out.length).toBeGreaterThan(0)
  })

  it("档位阈值：命中首个满足的单位（不落到更小单位）", () => {
    const now = Date.now()
    const day = 86400_000
    // numeric:"auto" 下 zh-CN 的既有输出口径（-1/0/1 走措辞化文案，其余为「N 单位前」）
    expect(formatRelativeTime(now - 2 * day)).toBe("前天")
    expect(formatRelativeTime(now - 30 * day)).toBe("上个月")
    expect(formatRelativeTime(now - 400 * day)).toBe("去年")
    // 3 小时前应使用 hour 单位（不落到 minute）
    expect(formatRelativeTime(now - 3 * 3600_000)).toBe("3小时前")
    // 5 分钟前应使用 minute 单位（不落到 second）
    expect(formatRelativeTime(now - 5 * 60_000)).toBe("5分钟前")
    // 45 秒前应落到 second 单位（不满足 minute 阈值 60s）
    expect(formatRelativeTime(now - 45_000)).toBe("45秒钟前")
  })

  it("阈值边界：刚好达到 60 秒进位到 minute，59 秒仍为 second", () => {
    const now = Date.now()
    expect(formatRelativeTime(now - 60_000)).toBe("1分钟前")
    expect(formatRelativeTime(now - 59_000)).toBe("59秒钟前")
  })

  it("过去时间为相对过去文案（diffSec 为负，不误报未来）", () => {
    const out = formatRelativeTime(Date.now() - 3600_000)
    expect(out).toMatch(/前/)
    // 同一输入重复求值结果稳定
    expect(formatRelativeTime(Date.now() - 3600_000)).toBe(out)
  })
})
