// 本地提交索引的覆盖范围决策纯函数（自 GitPushManager.getIndexedCommitLog 提取）
//
// 为什么单独成模块：这段判定决定「能否跳过 git 扫描」与「索引内容是否仍然可用」，
// 错判的后果分别是「每次刷新重扫全历史」与「沿用了不该沿用的覆盖范围」，
// 两者都不会报错、只会表现为慢或数据陈旧，因此必须可被单测直接覆盖。
import type { ProjectIndexMeta } from "../types/indexCache"

/** 覆盖范围判定输入 */
export interface CoverageInput {
  /** 当前 HEAD 对应的 rootHash（`<oid>:<gitdir>`） */
  rootHash: string
  /** 索引中记录的元数据（未索引为 undefined） */
  meta: ProjectIndexMeta | undefined
  /** 本次请求的时间范围下界（相对天数，0 = 全部历史） */
  sinceDays: number
  /** 本次扫描是否到达历史根 */
  scanComplete: boolean
  /** 本次扫描使用的已知 hash 集合是否为 null（null = 未走增量，即从历史根重扫） */
  notIncremental: boolean
  /** 本次扫描到的提交数 */
  scannedCommits: number
  /** 索引当前已有提交数 */
  indexedBefore: number
  /** 单项目索引提交上限 */
  maxCommits: number
}

/** 是否可以完全跳过本次 git 扫描（直接复用索引内存数据） */
export function canSkipScan(input: Pick<CoverageInput, "rootHash" | "meta" | "sinceDays">): boolean {
  const {
    rootHash,
    meta,
    sinceDays,
  } = input
  if (!meta) return false
  // 仓库身份 + HEAD 都必须一致
  if (meta.rootHash !== rootHash) return false
  // 索引必须是完整的，且深度满足本次范围要求
  if (!meta.complete) return false
  return sinceDays === 0 || meta.sinceCoveredDays >= sinceDays
}

/**
 * 本次扫描后的索引是否为「完整」（提交齐全，可覆盖任意时间范围）。
 * 两个条件同时成立：单次扫描到达历史根，且总量未超过单项目上限。
 */
export function isIndexComplete(input: Pick<CoverageInput, "scanComplete" | "scannedCommits" | "indexedBefore" | "maxCommits">): boolean {
  return input.scanComplete && input.indexedBefore + input.scannedCommits <= input.maxCommits
}

/**
 * 计算新的覆盖范围（相对天数）。
 *
 * 三档：
 * - 完整 → 覆盖任意范围（用 Number.MAX_SAFE_INTEGER 表示「无须再判」）
 * - 不完整但既有内容仍有效 → **沿用旧值**，避免被截断的项目每次刷新都从历史根重扫
 * - 不完整且既有内容已作废（本次是权威全量重扫）→ 0（无覆盖保证）
 *
 * 「既有内容仍有效」= 同一仓库（gitdir 一致）且本次并非「从历史根重扫出非空结果」。
 * 后者对应换仓库/被截断后的重建：此时旧覆盖范围属于另一份数据，必须丢弃。
 *
 * @param sameRepo 索引中记录的 gitdir 与当前仓库是否一致
 */
export function nextCoveredDays(
  input: Pick<CoverageInput, "scanComplete" | "scannedCommits" | "indexedBefore" | "maxCommits" | "notIncremental">,
  sameRepo: boolean,
  prevCoveredDays: number | undefined,
): number {
  if (isIndexComplete(input)) return Number.MAX_SAFE_INTEGER
  // 增量补齐（已知 hash 非空）或本次无新提交 → 旧覆盖范围仍然成立
  const indexStillValid = sameRepo && (!input.notIncremental || input.scannedCommits === 0)
  return indexStillValid ? (prevCoveredDays ?? 0) : 0
}
