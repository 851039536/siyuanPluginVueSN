// `compareProjectLineRank` 单测 —— 行数排行排序口径的单一来源。
//
// 语义已随视图调整：原「存量降序 → 净增降序 → 新增降序」改为
// 「存量降序 → 最后提交时间降序 → 名称升序」，因为列表不再展示增删净。
// 排序不稳定会让同规模项目的展示顺序在每次刷新后抖动，故逐条覆盖。
import type { ProjectLineRankItem } from "../types"
import { describe, expect, it } from "vitest"
import { compareProjectLineRank } from "./metrics"

/** 构造排行条目（默认给最小合法值，测试只覆盖关心的字段） */
function row(over: Partial<ProjectLineRankItem> = {}): ProjectLineRankItem {
  return {
    id: over.id ?? "x",
    name: over.name ?? "x",
    totalLines: over.totalLines ?? 0,
    firstCommit: over.firstCommit ?? "",
    lastCommit: over.lastCommit ?? "",
  }
}

describe("compareProjectLineRank", () => {
  it("按总行数降序", () => {
    const a = row({ id: "a", name: "a", totalLines: 100 })
    const b = row({ id: "b", name: "b", totalLines: 300 })
    expect([a, b].sort(compareProjectLineRank).map((r) => r.id)).toEqual(["b", "a"])
  })

  it("总行数为 undefined（旧缓存）时按 0 计，排在后方", () => {
    const cachedOld = row({ id: "old", name: "old", totalLines: undefined })
    const normal = row({ id: "new", name: "new", totalLines: 5 })
    expect([cachedOld, normal].sort(compareProjectLineRank).map((r) => r.id)).toEqual(["new", "old"])
  })

  it("总行数相同时，最后提交时间较新的在前", () => {
    const older = row({ id: "older", name: "older", totalLines: 10, lastCommit: "2023-01-01T00:00:00+08:00" })
    const newer = row({ id: "newer", name: "newer", totalLines: 10, lastCommit: "2025-06-01T00:00:00+08:00" })
    expect([older, newer].sort(compareProjectLineRank).map((r) => r.id)).toEqual(["newer", "older"])
  })

  it("总行数与时间都相同时按名称升序（保证顺序稳定不抖动）", () => {
    const b = row({ id: "b", name: "beta", totalLines: 10, lastCommit: "2024-01-01T00:00:00+08:00" })
    const a = row({ id: "a", name: "alpha", totalLines: 10, lastCommit: "2024-01-01T00:00:00+08:00" })
    expect([b, a].sort(compareProjectLineRank).map((r) => r.id)).toEqual(["a", "b"])
  })

  it("时间为空串（无提交/空仓库）时排在同类末尾", () => {
    const empty = row({ id: "empty", name: "empty", totalLines: 10, lastCommit: "" })
    const dated = row({ id: "dated", name: "dated", totalLines: 10, lastCommit: "2020-01-01T00:00:00+08:00" })
    expect([empty, dated].sort(compareProjectLineRank).map((r) => r.id)).toEqual(["dated", "empty"])
  })

  it("总行数优先于时间：行数多的即使更旧也排前面", () => {
    const bigOld = row({ id: "bigOld", name: "bigOld", totalLines: 999, lastCommit: "2010-01-01T00:00:00+08:00" })
    const smallNew = row({ id: "smallNew", name: "smallNew", totalLines: 1, lastCommit: "2026-01-01T00:00:00+08:00" })
    expect([smallNew, bigOld].sort(compareProjectLineRank).map((r) => r.id)).toEqual(["bigOld", "smallNew"])
  })
})
