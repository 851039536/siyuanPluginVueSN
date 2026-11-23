// src/features/gitPush/utils/commitMessagePolicy.spec.ts — 一键提交的生成方式选择单元测试
import { describe, expect, it } from "vitest"
import {
  DEEP_COMMIT_FILE_THRESHOLD,
  DEEP_COMMIT_LINE_THRESHOLD,
  shouldUseDeepCommitMessage,
  summarizeCommitSize,
} from "./commitMessagePolicy"
import type { NumstatEntry } from "./gitOutput"

const entry = (add: number, del: number, binary = false): NumstatEntry => ({ add, del, binary })

describe("summarizeCommitSize", () => {
  it("空变更集为 0 文件 0 行", () => {
    expect(summarizeCommitSize({})).toEqual({ fileCount: 0, changedLines: 0 })
  })

  it("累加增删行，二进制文件计文件数但不计行数", () => {
    expect(summarizeCommitSize({
      "a.ts": entry(10, 2),
      "b.ts": entry(3, 1),
      "logo.png": entry(0, 0, true),
    })).toEqual({ fileCount: 3, changedLines: 16 })
  })
})

describe("shouldUseDeepCommitMessage", () => {
  it("空变更集走简单生成", () => {
    expect(shouldUseDeepCommitMessage(summarizeCommitSize({}))).toBe(false)
  })

  it("低于两个阈值走简单生成", () => {
    const size = summarizeCommitSize({
      "a.ts": entry(100, 50),
      "b.ts": entry(30, 19),
    })
    expect(size.fileCount).toBe(2)
    expect(size.changedLines).toBe(199)
    expect(shouldUseDeepCommitMessage(size)).toBe(false)
  })

  it("文件数达到阈值即用深度生成", () => {
    const overview: Record<string, NumstatEntry> = {}
    for (let i = 0; i < DEEP_COMMIT_FILE_THRESHOLD; i++) overview[`f${i}.ts`] = entry(1, 0)
    expect(shouldUseDeepCommitMessage(summarizeCommitSize(overview))).toBe(true)
  })

  it("增删行达到阈值即用深度生成（即使只有一个文件）", () => {
    const size = summarizeCommitSize({ "big.ts": entry(DEEP_COMMIT_LINE_THRESHOLD, 0) })
    expect(shouldUseDeepCommitMessage(size)).toBe(true)
  })

  it("纯二进制改动只按文件数判定", () => {
    const one = summarizeCommitSize({ "a.png": entry(0, 0, true) })
    expect(shouldUseDeepCommitMessage(one)).toBe(false)
  })
})
