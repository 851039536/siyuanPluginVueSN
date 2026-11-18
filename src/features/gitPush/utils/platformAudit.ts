/**
 * 统计中心 · 平台配置与链接校验的行合并与计数
 *
 * 背景：`useGitStats.platformStatusProjects` 只收「平台配置缺失」的项目，而
 * `useRepoLinkAudit.auditRows` 覆盖全部项目。若直接拿前者建矩阵行，
 * 「四平台齐全但链接不一致 / 路径失效」的项目会被静默漏掉，问题计数也会偏小。
 *
 * 本模块把两个来源按项目 id 合并，并以审计行的单元格状态做计数，
 * 让「配置缺失」与「校验异常」两类问题都进入同一张表。纯函数，便于单测。
 */
import type { GitProject } from "../types/storage"
import type {
  PlatformKey,
  PlatformStatusItem,
  RepoLinkAuditRow,
} from "../types/meta"
import { PLATFORM_META } from "../types/meta"

/** 平台配置态（四平台布尔），供矩阵单元格在无审计结果时回落「已配置/未配置」 */
export type PlatformConfiguredState = Record<PlatformKey, boolean>

/** 合并后的矩阵行（审计行可选：尚未校验的项目保留配置态） */
export interface PlatformAuditRowModel {
  id: string
  name: string
  path: string
  configured: PlatformConfiguredState
  /** 该项目的链接校验结果；未校验/未参与审计时为 undefined */
  audit?: RepoLinkAuditRow
}

/** 问题分类计数（项目/单元格口径由调用方展示时说明） */
export interface PlatformAuditIssueCounts {
  mismatch: number
  linkOnly: number
  remoteOnly: number
  /** 路径无效或 git 检测失败的项目数 */
  error: number
}

/**
 * 审计 watch 的指纹：只要影响校验结果的字段变化就必须重审。
 *
 * 注意必须包含 `*Url`：审计比对的是手动链接（urlProp）与实际远程 URL，
 * 只盯 `*Remote` 会让「改链接不重审」——这正是历史缺陷。
 */
export function buildRepoAuditKey(projects: readonly GitProject[]): string {
  return projects
    .map((p) => [
      p.id,
      p.path,
      p.githubRemote,
      p.giteeRemote,
      p.giteaRemote,
      p.cnbRemote,
      p.githubUrl,
      p.giteeUrl,
      p.giteaUrl,
      p.cnbUrl,
    ].join(":"))
    .join("|")
}

/** 由平台配置项构造四平台布尔表 */
function configuredFromStatus(item: PlatformStatusItem): PlatformConfiguredState {
  return {
    github: item.github,
    gitee: item.gitee,
    gitea: item.gitea,
    cnb: item.cnb,
  }
}

/**
 * 由审计单元格反推配置态（仅用于「配置齐全但校验异常」的项目）。
 *
 * 这类项目不在 `platformStatusProjects` 里，拿不到项目字段的布尔值；
 * 但审计单元格保留了链接原文与实际远程 URL，任一非空即视为该平台有配置痕迹。
 */
function configuredFromAudit(audit: RepoLinkAuditRow): PlatformConfiguredState {
  const result = {} as PlatformConfiguredState
  for (const pm of PLATFORM_META) {
    const cell = audit.cells.find((c) => c.key === pm.key)
    result[pm.key] = !!(cell?.link || cell?.remoteUrl)
  }
  return result
}

/**
 * 配置齐全的项目是否值得补进矩阵：只收真正可行动的异常。
 *
 * 仅 `remoteOnly`（远程存在但未填手动链接）是常见状态——正常添加的项目不会
 * 自动写入 `*Url`。若把它也当异常，所有项目都会进入矩阵，页面退化成噪音列表。
 * 缺配置项目本身已有行，其 remoteOnly 单元格仍照常展示与计数。
 */
function hasActionableIssue(audit: RepoLinkAuditRow): boolean {
  return audit.error || audit.cells.some((c) => c.state === "mismatch" || c.state === "linkOnly")
}

/**
 * 合并「配置缺失」与「校验异常」两类项目，并单次遍历产出计数。
 *
 * - 配置缺失项目保持 `platformStatusProjects` 的既有顺序；
 * - 配置齐全但存在可行动异常（不一致 / 仅链接 / 检测失败）的项目追加在后；
 * - 同一项目只出现一次（配置缺失优先，保留其项目字段真值）。
 */
export function buildPlatformAuditRows(opts: {
  platformStatusProjects: readonly PlatformStatusItem[]
  auditRows: Record<string, RepoLinkAuditRow>
}): {
  rows: PlatformAuditRowModel[]
  issueCount: number
  counts: PlatformAuditIssueCounts
} {
  const rows: PlatformAuditRowModel[] = []
  const seen = new Set<string>()

  for (const item of opts.platformStatusProjects) {
    seen.add(item.project.id)
    rows.push({
      id: item.project.id,
      name: item.project.name,
      path: item.project.path,
      configured: configuredFromStatus(item),
      audit: opts.auditRows[item.project.id],
    })
  }

  for (const audit of Object.values(opts.auditRows)) {
    if (!hasActionableIssue(audit) || seen.has(audit.id)) continue
    seen.add(audit.id)
    rows.push({
      id: audit.id,
      name: audit.name,
      path: audit.path,
      configured: configuredFromAudit(audit),
      audit,
    })
  }

  let issueCount = 0
  const counts: PlatformAuditIssueCounts = { mismatch: 0, linkOnly: 0, remoteOnly: 0, error: 0 }

  for (const row of rows) {
    const audit = row.audit
    if (!audit?.hasIssue) continue
    issueCount++
    if (audit.error) counts.error++
    for (const cell of audit.cells) {
      if (cell.state === "mismatch" || cell.state === "linkOnly" || cell.state === "remoteOnly") {
        counts[cell.state]++
      }
    }
  }

  return { rows, issueCount, counts }
}
