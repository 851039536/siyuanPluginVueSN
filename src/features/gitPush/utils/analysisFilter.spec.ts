// 提交分析条目的口径过滤与截断判定（概览 KPI/趋势/排行/热力图共用）单元测试
//
// 契约：四个区块必须建立在同一份过滤结果上；merge 排除只认明确标记的 isMerge，
// 旧缓存条目（无该字段）按非 merge 处理。截断判定按「达到上限即提示」，宁可保守交代。
import { describe, expect, it } from "vitest"
import type { CommitAnalysisEntry } from "../types/meta"
import { filterAnalysisEntries, isCommitLogTruncated, rankByCountWithTotal } from "./analysis"

function entry(patch: Partial<CommitAnalysisEntry> = {}): CommitAnalysisEntry {
  return {
    projectId: "p1",
    projectName: "项目一",
    hash: "abc",
    message: "feat: x",
    author: "alice",
    date: "2026-01-05T10:00:00+08:00",
    ...patch,
  }
}

describe("isCommitLogTruncated（抓取上限判定）", () => {
  it("达到上限即视为可能截断（恰好等于上限无法区分全量，按截断提示）", () => {
    expect(isCommitLogTruncated(5000, 5000)).toBe(true)
  })

  it("低于上限/空结果不截断", () => {
    expect(isCommitLogTruncated(4999, 5000)).toBe(false)
    expect(isCommitLogTruncated(0, 5000)).toBe(false)
  })

  it("无效上限不判定截断", () => {
    expect(isCommitLogTruncated(100, 0)).toBe(false)
  })
})

describe("filterAnalysisEntries（概览口径过滤）", () => {
  const entries = [
    entry({ hash: "1" }),
    entry({ hash: "2", isMerge: true }),
    entry({ hash: "3", isMerge: false }),
  ]

  it("默认不过滤（保持原数组语义）", () => {
    expect(filterAnalysisEntries(entries)).toHaveLength(3)
  })

  it("excludeMerges 只排除明确标记的 merge（isMerge undefined 视为非 merge）", () => {
    const kept = filterAnalysisEntries(entries, { excludeMerges: true })
    expect(kept.map((e) => e.hash)).toEqual(["1", "3"])
  })

  it("旧缓存条目无 isMerge 字段时全部保留", () => {
    const legacy = [entry(), entry({ hash: "x" })]
    expect(filterAnalysisEntries(legacy, { excludeMerges: true })).toHaveLength(2)
  })
})

describe("作者排行（复用 rankByCountWithTotal）", () => {
  it("同名作者跨项目合并计数，空作者跳过", () => {
    const entries = [
      entry({ projectId: "p1", author: "alice" }),
      entry({ projectId: "p2", author: "alice" }),
      entry({ projectId: "p1", author: "bob" }),
      entry({ projectId: "p2", author: "" }),
    ]
    const { rows, totalGroups } = rankByCountWithTotal(entries, (e) => e.author, 50)
    expect(totalGroups).toBe(2)
    expect(rows[0]).toEqual({ key: "alice", count: 2 })
    expect(rows[1]).toEqual({ key: "bob", count: 1 })
  })

  it("超出上限时返回优先行与截断前分组数", () => {
    const entries = ["a", "b", "c", "a", "b", "a"].map((author, i) => entry({ hash: String(i), author }))
    const { rows, totalGroups } = rankByCountWithTotal(entries, (e) => e.author, 2)
    expect(rows).toHaveLength(2)
    expect(totalGroups).toBe(3)
    expect(rows[0].key).toBe("a")
  })
})
