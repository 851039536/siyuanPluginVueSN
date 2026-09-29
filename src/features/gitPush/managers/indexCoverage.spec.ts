import type { ProjectIndexMeta } from "../types/indexCache"
// 索引覆盖范围决策单测：跳过扫描的判据 + 截断项目不得每次重扫全历史
import {
  describe,
  expect,
  it,
} from "vitest"
import {
  canSkipScan,
  isIndexComplete,
  nextCoveredDays,
} from "./indexCoverage"

/** 构造项目元数据 */
function meta(over: Partial<ProjectIndexMeta> = {}): ProjectIndexMeta {
  return {
    projectId: "p1",
    rootHash: "head1:/repo/.git",
    analyzedAt: "2026-01-01T00:00:00.000Z",
    complete: true,
    lastCommit: "alice|2026-01-01T00:00:00Z",
    sinceCoveredDays: 365,
    ...over,
  }
}

describe("canSkipScan：能否完全跳过 git 扫描", () => {
  it("rootHash 一致 + 完整 + 范围满足 → 可跳过", () => {
    expect(canSkipScan({
      rootHash: "head1:/repo/.git",
      meta: meta(),
      sinceDays: 90,
    })).toBe(true)
    expect(canSkipScan({
      rootHash: "head1:/repo/.git",
      meta: meta(),
      sinceDays: 0,
    })).toBe(true)
  })

  it("hEAD 变化 → 不可跳过", () => {
    expect(canSkipScan({
      rootHash: "head2:/repo/.git",
      meta: meta(),
      sinceDays: 90,
    })).toBe(false)
  })

  it("换仓库（同 HEAD 不同 gitdir）→ 不可跳过", () => {
    expect(canSkipScan({
      rootHash: "head1:/other/.git",
      meta: meta(),
      sinceDays: 90,
    })).toBe(false)
  })

  it("索引被截断（complete=false）→ 不可跳过", () => {
    expect(canSkipScan({
      rootHash: "head1:/repo/.git",
      meta: meta({ complete: false }),
      sinceDays: 90,
    })).toBe(false)
  })

  it("覆盖范围不足 → 不可跳过（即使 rootHash 与完整性都满足）", () => {
    // 已覆盖 180 天，请求 365 天
    expect(canSkipScan({
      rootHash: "head1:/repo/.git",
      meta: meta({ sinceCoveredDays: 180 }),
      sinceDays: 365,
    })).toBe(false)
    expect(canSkipScan({
      rootHash: "head1:/repo/.git",
      meta: meta({ sinceCoveredDays: 365 }),
      sinceDays: 365,
    })).toBe(true)
  })

  it("未索引 → 不可跳过", () => {
    expect(canSkipScan({
      rootHash: "head1:/repo/.git",
      meta: undefined,
      sinceDays: 90,
    })).toBe(false)
  })
})

describe("isIndexComplete：扫描后是否提交齐全", () => {
  it("到达历史根且未超上限 → 完整", () => {
    expect(isIndexComplete({
      scanComplete: true,
      scannedCommits: 100,
      indexedBefore: 200,
      maxCommits: 20000,
    })).toBe(true)
  })

  it("恰好达到上限 → 完整（边界包含）", () => {
    expect(isIndexComplete({
      scanComplete: true,
      scannedCommits: 100,
      indexedBefore: 19900,
      maxCommits: 20000,
    })).toBe(true)
  })

  it("未到历史根 → 不完整", () => {
    expect(isIndexComplete({
      scanComplete: false,
      scannedCommits: 100,
      indexedBefore: 0,
      maxCommits: 20000,
    })).toBe(false)
  })

  it("超出单项目上限 → 不完整", () => {
    expect(isIndexComplete({
      scanComplete: true,
      scannedCommits: 200,
      indexedBefore: 19900,
      maxCommits: 20000,
    })).toBe(false)
  })
})

describe("nextCoveredDays：覆盖范围演进", () => {
  it("完整索引 → 覆盖任意范围", () => {
    expect(nextCoveredDays(
      {
        scanComplete: true,
        scannedCommits: 10,
        indexedBefore: 10,
        maxCommits: 20000,
        notIncremental: false,
      },
      true,
      0,
    )).toBe(Number.MAX_SAFE_INTEGER)
  })

  it("截断项目：增量补齐时沿用旧覆盖范围（不得清零，否则每次刷新都重扫全历史）", () => {
    const covered = nextCoveredDays(
      {
        scanComplete: true,
        scannedCommits: 10,
        indexedBefore: 25000,
        maxCommits: 20000,
        notIncremental: false,
      },
      true,
      365,
    )
    expect(covered).toBe(365)
  })

  it("截断项目：本次无新提交时同样沿用旧覆盖范围", () => {
    const covered = nextCoveredDays(
      {
        scanComplete: true,
        scannedCommits: 0,
        indexedBefore: 25000,
        maxCommits: 20000,
        notIncremental: true,
      },
      true,
      90,
    )
    expect(covered).toBe(90)
  })

  it("换仓库后的权威全量重扫（非增量且有新提交）→ 丢弃旧覆盖范围", () => {
    const covered = nextCoveredDays(
      {
        scanComplete: false,
        scannedCommits: 500,
        indexedBefore: 0,
        maxCommits: 20000,
        notIncremental: true,
      },
      false,
      365,
    )
    expect(covered).toBe(0)
  })

  it("首次索引且被单次上限截断 → 无覆盖保证", () => {
    const covered = nextCoveredDays(
      {
        scanComplete: false,
        scannedCommits: 20000,
        indexedBefore: 0,
        maxCommits: 20000,
        notIncremental: true,
      },
      false,
      0,
    )
    expect(covered).toBe(0)
  })

  it("旧元数据无 sinceCoveredDays（旧版本/新建）→ 视为 0 而非 undefined 泄漏", () => {
    const covered = nextCoveredDays(
      {
        scanComplete: true,
        scannedCommits: 5,
        indexedBefore: 25000,
        maxCommits: 20000,
        notIncremental: false,
      },
      true,
      undefined,
    )
    expect(covered).toBe(0)
  })
})
