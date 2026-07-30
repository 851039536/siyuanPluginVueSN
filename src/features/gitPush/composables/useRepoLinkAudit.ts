// 仓库链接一致性审计 — 批量执行 git remote -v，归一化后比对手动仓库链接与实际远程 URL
import type { Ref } from "vue"
import type {
  GitProject,
  GitPushManager,
  RepoLinkAuditCell,
  RepoLinkAuditRow,
  RepoLinkAuditState,
  RepoLinkAuditSummary,
} from "../types"
import { computed, ref } from "vue"
import { PLATFORM_META } from "../types"
import { findPlatformRemote, normalizeGitUrl, resolveValidPath } from "../utils"

/** 判定单平台比对状态（link/remoteUrl 为原文，内部归一化比较） */
function resolveCellState(link: string, remoteUrl: string): RepoLinkAuditState {
  if (!link && !remoteUrl) { return "none" }
  if (link && !remoteUrl) { return "linkOnly" }
  if (!link && remoteUrl) { return "remoteOnly" }
  return normalizeGitUrl(link) === normalizeGitUrl(remoteUrl) ? "match" : "mismatch"
}

export function useRepoLinkAudit(manager: GitPushManager, projects: Ref<GitProject[]>) {
  const auditRows = ref<RepoLinkAuditRow[]>([])
  /** 是否正在批量检测 */
  const auditing = ref(false)
  /** 是否已完成过至少一轮检测（区分"未分析"与"分析结果为空"） */
  const audited = ref(false)

  /** 对单个项目执行检测并构建审计行（路径无效/git 失败 → error 行） */
  async function auditProject(p: GitProject): Promise<RepoLinkAuditRow> {
    let cells: RepoLinkAuditCell[] = []
    let error = false
    try {
      const remotes = await manager.detectRemotes(resolveValidPath(p))
      cells = PLATFORM_META.map((pl) => {
        const link = p[pl.urlProp] || ""
        const remoteUrl = findPlatformRemote(remotes, pl.key)?.url || ""
        return { key: pl.key, state: resolveCellState(link, remoteUrl), link, remoteUrl }
      })
    } catch {
      error = true
      // 检测失败时仍展示链接配置侧信息，远程侧置空
      cells = PLATFORM_META.map((pl) => ({
        key: pl.key, state: "none" as const, link: p[pl.urlProp] || "", remoteUrl: "",
      }))
    }
    const hasIssue = error || cells.some((c) => c.state === "mismatch" || c.state === "linkOnly" || c.state === "remoteOnly")
    return { id: p.id, name: p.name, path: p.path, error, cells, hasIssue }
  }

  /** 批量审计全部项目（GitExecutor 自带并发上限，无需额外节流） */
  async function runAudit() {
    if (auditing.value) { return }
    auditing.value = true
    try {
      const settled = await Promise.allSettled(projects.value.map((p) => auditProject(p)))
      auditRows.value = settled
        .filter((r): r is PromiseFulfilledResult<RepoLinkAuditRow> => r.status === "fulfilled")
        .map((r) => r.value)
      audited.value = true
    } finally {
      auditing.value = false
    }
  }

  /** 四态汇总计数（跨全部项目全部平台单元格） */
  const auditSummary = computed<RepoLinkAuditSummary>(() => {
    const s: RepoLinkAuditSummary = { match: 0, mismatch: 0, linkOnly: 0, remoteOnly: 0 }
    for (const row of auditRows.value) {
      for (const c of row.cells) {
        if (c.state !== "none") { s[c.state]++ }
      }
    }
    return s
  })

  return {
    auditRows,
    auditing,
    audited,
    auditSummary,
    runAudit,
  }
}
