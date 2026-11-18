// 仓库链接一致性校验 — 批量执行 git remote -v，归一化后比对手动仓库链接与实际远程 URL。
// 统计中心「平台配置与链接校验」区块消费本结果：单元格在已配置/未配置之上，再叠加"链接与实际远程是否一致"的校验态。
import type { Ref } from "vue"
import type {
  GitProject,
  GitPushManager,
  RepoLinkAuditCell,
  RepoLinkAuditRow,
  RepoLinkAuditState,
} from "../types"
import { onUnmounted, ref, watch } from "vue"
import { PLATFORM_META } from "../types"
import { findPlatformRemote, normalizeGitUrl, resolveValidPath } from "../utils"
import { buildRepoAuditKey } from "../utils/platformAudit"
import { poolProcess } from "../utils/runtime"

/** 判定单平台比对状态（link/remoteUrl 为原文，内部归一化比较） */
function resolveCellState(link: string, remoteUrl: string): RepoLinkAuditState {
  if (!link && !remoteUrl) { return "none" }
  if (link && !remoteUrl) { return "linkOnly" }
  if (!link && remoteUrl) { return "remoteOnly" }
  return normalizeGitUrl(link) === normalizeGitUrl(remoteUrl) ? "match" : "mismatch"
}

/** 批量校验并发上限：每项一次 git remote -v，串行太慢、全并发会挤占共享本地池（默认 10） */
const AUDIT_CONCURRENCY = 6

export interface RepoLinkAuditOptions {
  /** 是否允许执行（通常 = 当前视图为统计视图；为空则不跑） */
  enabled?: () => boolean
  /** git 全局暂停中（暂停时不跑） */
  isPaused?: () => boolean
}

export function useRepoLinkAudit(
  manager: GitPushManager,
  projects: Ref<GitProject[]>,
  options: RepoLinkAuditOptions = {},
) {
  const { enabled = () => true, isPaused = () => false } = options
  /** 项目 id → 校验行（供平台矩阵按行取单元格校验态） */
  const auditRows = ref<Record<string, RepoLinkAuditRow>>({})
  /** 是否正在批量校验 */
  const auditing = ref(false)
  /** 最近一次成功校验时对应的项目指纹（用于「进入统计页」按变更决定是否重跑） */
  let lastAuditedKey = ""
  /** 卸载标记：卸载后在飞结果不再写回（避免写已卸载组件的 ref） */
  let cancelled = false
  /** 在途期间又有校验请求：结束后补跑一轮（避免项目变更被静默丢弃） */
  let auditPending = false

  /** 对单个项目执行校验并构建校验行（路径无效/git 失败 → error 行） */
  async function auditProject(p: GitProject): Promise<RepoLinkAuditRow> {
    let cells: RepoLinkAuditCell[] = []
    let error = false
    try {
      // 必须用 strict 版本：detectRemotes 会把「路径失效 / 非仓库」吞成空数组，
      // 从而被误判为「没有远程」，链接侧反而报成 linkOnly（虚假问题）
      const remotes = await manager.detectRemotesStrict(resolveValidPath(p))
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

  /**
   * 批量校验全部项目。
   *
   * 只校验「启用且未暂停」的场景；并发用 poolProcess 压到 6（全并发会把 N 个
   * `git remote -v` 一次性塞进共享本地池，挤占探测/卡片查询）。
   *
   * @param opts.force 绕过 enabled 门控（仅用于用户手动触发的加载链路：
   *   即使期间切走统计页，也应把这次审计跑完；自动项目变更仍走 enabled 门控）
   */
  async function runAudit(opts?: { force?: boolean }) {
    if (cancelled || isPaused()) { return }
    if (!opts?.force && !enabled()) { return }
    // 在途期间又来请求（项目变更 watcher）：标记 pending，结束后补跑，
    // 不能直接丢弃——否则新加/改链接的项目要等用户离开统计视图再进才会被校验
    if (auditing.value) {
      auditPending = true
      return
    }
    auditing.value = true
    try {
      do {
        auditPending = false
        const next: Record<string, RepoLinkAuditRow> = {}
        const queue = [...projects.value]
        await poolProcess(queue, AUDIT_CONCURRENCY, async (p) => {
          if (cancelled) return
          next[p.id] = await auditProject(p)
        })
        // 卸载后不写回：避免向已销毁组件的 ref 提交结果、延长对象存活
        if (cancelled) return
        auditRows.value = next
        lastAuditedKey = buildRepoAuditKey(projects.value)
      } while (auditPending && !cancelled)
    } finally {
      auditing.value = false
    }
  }

  /**
   * 按指纹决定是否重跑：项目集合/路径/远程名/手动链接都没变时直接跳过。
   *
   * 供「进入统计页」使用：链接编辑通常发生在列表视图，此时 enabled() 为 false，
   * 项目 watch 不会跑；回到统计页必须能根据指纹补审，否则矩阵长期停留在旧结果。
   */
  function runAuditIfChanged(): Promise<void> {
    if (lastAuditedKey === buildRepoAuditKey(projects.value)) return Promise.resolve()
    return runAudit()
  }

  /** 删除项目后裁剪审计行，避免已删除项目长期占用内存（审计可能因门控不再重跑） */
  function pruneAuditRows(currentIds: Set<string>): void {
    const stale = Object.keys(auditRows.value).filter((id) => !currentIds.has(id))
    if (stale.length === 0) return
    const next = { ...auditRows.value }
    for (const id of stale) delete next[id]
    auditRows.value = next
  }

  /**
   * 校验行为并入平台卡片后不再有「开始校验」按钮，改为「进入统计视图」自动跑一次。
   *
   * 历史实现是 setup 里 immediate 直接跑：面板一挂载就对全部项目并发 `git remote -v`，
   * 与探测层的 2N 次 rev-parse 叠加成进入页面的进程风暴（审查报告 §P0-2）。
   * 现在：① immediate 不再直接跑，改为由调用方在进入统计视图时调 runAudit；
   *       ② 项目集合变化时若允许（在统计视图）才重跑。
   * 已有结果时保留旧值直到新一轮完成，避免单元格在校验期间闪烁回"未校验"态。
   */
  /**
   * 项目集合/路径/远程名/手动链接变化后重跑（仅在统计视图已加载时）。
   *
   * 指纹必须包含 `*Url`：审计比对的是手动链接与实际远程 URL，只盯 `*Remote`
   * 会让「改链接不重审」——这是本页面历史缺陷之一。
   * 删除项目时即使不满足 enabled 也先裁剪旧行，避免内存长期滞留。
   */
  watch(
    () => buildRepoAuditKey(projects.value),
    () => {
      pruneAuditRows(new Set(projects.value.map((p) => p.id)))
      if (enabled()) void runAudit()
    },
  )

  onUnmounted(() => {
    cancelled = true
  })

  return {
    auditRows,
    auditing,
    runAudit,
    runAuditIfChanged,
  }
}
