// 仓库链接一致性校验 — 批量执行 git remote -v，归一化后比对手动仓库链接与实际远程 URL。
// 统计视图「平台配置状态」卡片消费本结果：单元格在已配置/未配置之上，再叠加"链接与实际远程是否一致"的校验态。
import type { Ref } from "vue"
import type {
  GitProject,
  GitPushManager,
  RepoLinkAuditCell,
  RepoLinkAuditRow,
  RepoLinkAuditState,
} from "../types"
import { ref, watch } from "vue"
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
  /** 项目 id → 校验行（供平台矩阵按行取单元格校验态） */
  const auditRows = ref<Record<string, RepoLinkAuditRow>>({})
  /** 是否正在批量校验 */
  const auditing = ref(false)
  /** 是否已完成过至少一轮校验（区分"校验中"与"校验结果为空"） */
  const audited = ref(false)

  /** 对单个项目执行校验并构建校验行（路径无效/git 失败 → error 行） */
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

  /** 批量校验全部项目（GitExecutor 自带并发上限，无需额外节流） */
  async function runAudit() {
    if (auditing.value) { return }
    auditing.value = true
    try {
      const settled = await Promise.allSettled(projects.value.map((p) => auditProject(p)))
      const next: Record<string, RepoLinkAuditRow> = {}
      for (const r of settled) {
        if (r.status === "fulfilled") { next[r.value.id] = r.value }
      }
      auditRows.value = next
      audited.value = true
    } finally {
      auditing.value = false
    }
  }

  /**
   * 校验行为并入平台卡片后不再有「开始校验」按钮，改为进入视图自动跑一次。
   * 项目集合变化（新增/删除/编辑路径或链接）会触发重跑；immediate 保证首次挂载即执行。
   * 已有结果时保留旧值直到新一轮完成，避免单元格在校验期间闪烁回"未校验"态。
   */
  watch(
    () => projects.value.map((p) => `${p.id}:${p.path}:${p.githubRemote}:${p.giteeRemote}:${p.giteaRemote}:${p.cnbRemote}`).join("|"),
    () => { void runAudit() },
    { immediate: true },
  )

  return {
    auditRows,
    auditing,
    audited,
    runAudit,
  }
}
