// Git 项目统计信息获取 — 单次遍历统一计算所有统计指标
import type { Ref } from "vue"
import { computed, ref } from "vue"
// ⚠️ 直连纯模块（storage/meta）而非 "../types" 桶：桶首行 `export { GitPushManager } from "../GitPushManager"`
// 是**值**导出，Vite/Rollup 转译期即需解析整条模块图 ⇒ 拉进运行时 "siyuan" 依赖 ⇒ 本模块无法在
// Node 单测环境加载（useGitStats.spec.ts 会直接报 siyuan 包导出错误）。与 useProjectQueryScheduler /
// useGitProbe 的既有做法一致。storage.ts / meta.ts 均无运行时依赖。
import type {
  NeedsPullItem,
  NeedsPushItem,
  PendingProjectItem,
  PlatformStatusItem,
  StatsView,
  UncommittedItem,
} from "../types/meta"
import { PLATFORM_META } from "../types/meta"
import type { GitPushManager } from "../GitPushManager"
import type {
  GitProject,
  ProjectCategory,
  PushStatusInfo,
  WorkingTreeInfo,
} from "../types/storage"
import { DEFAULT_LOCAL_TIMEOUT, DEFAULT_NETWORK_TIMEOUT, UNGROUPED_ID } from "../types/storage"
// 直连 utils/platform（纯函数模块）而非 "../utils" 桶，理由同上
import { getProjectRemoteNames, hasUnpushedCommits } from "../utils/platform"

export function useGitStats(
  manager: GitPushManager,
  projects: Ref<GitProject[]>,
  categories: Ref<ProjectCategory[]>,
  pushStatuses: Ref<Record<string, PushStatusInfo>>,
  workingTrees: Ref<Record<string, WorkingTreeInfo>>,
) {
  const gitConcurrency = ref(3)
  /** 网络命令超时（秒，默认 240s，设置面板展示与修改） */
  const networkTimeout = ref(DEFAULT_NETWORK_TIMEOUT)
  /** 本地命令超时（秒，默认 60s，设置面板展示与修改） */
  const localTimeout = ref(DEFAULT_LOCAL_TIMEOUT)

  function loadGitConcurrency() {
    gitConcurrency.value = manager.getGitConcurrency()
  }

  async function setGitConcurrency(n: number) {
    await manager.setGitConcurrency(n)
    // 回读 manager 钳位后的实际值，避免 UI 显示与持久化值不一致
    gitConcurrency.value = manager.getGitConcurrency()
  }

  function loadNetworkTimeout() {
    networkTimeout.value = manager.getNetworkTimeout()
  }

  async function setNetworkTimeout(n: number) {
    await manager.setNetworkTimeout(n)
    // 回读 manager 钳位后的实际值，避免 UI 显示与持久化值不一致
    networkTimeout.value = manager.getNetworkTimeout()
  }

  function loadLocalTimeout() {
    localTimeout.value = manager.getLocalTimeout()
  }

  async function setLocalTimeout(n: number) {
    await manager.setLocalTimeout(n)
    // 回读 manager 钳位后的实际值，避免 UI 显示与持久化值不一致
    localTimeout.value = manager.getLocalTimeout()
  }

  /**
   * 单次遍历计算所有统计指标，避免多个 computed 各自遍历 projects 数组。
   * 派生 computed 仅从该对象取出对应字段，零额外遍历开销。
   *
   * 「待处理项目」的三路来源（待推送 / 待拉取 / 未提交）本就在同一个循环内逐项目判定，
   * 故在此用同一张 pendingMap 直接累积合并条目 —— 原实现先用三个数组分别收集、
   * 再在 pendingProjects computed 里二次遍历合并（3 次多余遍历 + Map 重建）。
   */
  const projectStats = computed(() => {
    const groupedMap = new Map<string, { category: ProjectCategory; projects: GitProject[] }>()
    for (const cat of categories.value) {
      groupedMap.set(cat.id, { category: cat, projects: [] })
    }

    let github = 0
    let gitee = 0
    let gitea = 0
    let cnb = 0
    let hasRemote = 0
    let multipleRemote = 0
    let ahead = 0
    let behind = 0
    let synced = 0
    let noRemote = 0
    const pendingMap = new Map<string, PendingProjectItem>()
    const needsPush: NeedsPushItem[] = []
    const needsPull: NeedsPullItem[] = []
    const uncommitted: UncommittedItem[] = []
    const platformMissing: PlatformStatusItem[] = []
    const starred: GitProject[] = []
    let archivedCount = 0

    /** 取或创建合并条目（三种待处理来源共用，随主循环一次性累积） */
    const pendingEntry = (p: GitProject): PendingProjectItem => {
      let item = pendingMap.get(p.id)
      if (!item) {
        item = {
          project: p,
          aheadByRemote: [],
          totalAhead: 0,
          behindByRemote: [],
          totalBehind: 0,
          staged: 0,
          unstaged: 0,
          untracked: 0,
        }
        pendingMap.set(p.id, item)
      }
      return item
    }

    for (const p of projects.value) {
      // ── 分组 ──
      const group = groupedMap.get(p.categoryId)
      if (group) {
        group.projects.push(p)
      } else {
        groupedMap.get(UNGROUPED_ID)?.projects.push(p)
      }

      // ── 远程覆盖率（基于实际 git remote 配置，非手动输入的仓库链接）──
      // 由 PLATFORM_META 驱动，避免四个平台写死四次的重复；getProjectRemoteNames 是既有单一真源
      const remoteNames = getProjectRemoteNames(p)
      const remoteCount = remoteNames.length
      for (const { key } of remoteNames) {
        if (key === "github") github++
        else if (key === "gitee") gitee++
        else if (key === "gitea") gitea++
        else cnb++
      }
      if (remoteCount > 0) hasRemote++
      if (remoteCount >= 2) multipleRemote++

      // ── Push 状态统计 ──
      const status = pushStatuses.value[p.id]
      if (!status || Object.keys(status.remotes).length === 0) {
        noRemote++
      } else {
        const vals = Object.values(status.remotes)
        if (vals.some((r) => hasUnpushedCommits(r))) ahead++
        else if (vals.some((r) => r.behind > 0)) behind++
        else synced++
      }

      // ── 待推送 / 待拉取项目（同时累积合并条目）──
      if (status) {
        const aheadByRemote: { key: string; ahead: number }[] = []
        const behindByRemote: { key: string; behind: number }[] = []
        for (const pm of PLATFORM_META) {
          const rs = status.remotes[pm.key]
          if (rs && hasUnpushedCommits(rs)) aheadByRemote.push({ key: pm.key, ahead: rs.ahead })
          if (rs && rs.behind > 0) behindByRemote.push({ key: pm.key, behind: rs.behind })
        }
        if (aheadByRemote.length > 0) {
          const totalAhead = aheadByRemote.reduce((s, r) => s + r.ahead, 0)
          needsPush.push({ project: p, aheadByRemote, totalAhead })
          Object.assign(pendingEntry(p), { aheadByRemote, totalAhead })
        }
        if (behindByRemote.length > 0) {
          const totalBehind = behindByRemote.reduce((s, r) => s + r.behind, 0)
          needsPull.push({ project: p, behindByRemote, totalBehind })
          Object.assign(pendingEntry(p), { behindByRemote, totalBehind })
        }
      }

      // ── 未提交变更（同时累积合并条目）──
      const wt = workingTrees.value[p.id]
      if (wt?.hasChanges) {
        const changeCounts = {
          staged: wt.stagedCount,
          unstaged: wt.unstagedCount,
          untracked: wt.untrackedCount,
        }
        uncommitted.push({ project: p, ...changeCounts })
        Object.assign(pendingEntry(p), changeCounts)
      }

      // ── 平台缺失（基于实际 git remote 配置）──
      const configured = new Set(remoteNames.map((r) => r.key))
      const hasGithub = configured.has("github")
      const hasGitee = configured.has("gitee")
      const hasGitea = configured.has("gitea")
      const hasCnb = configured.has("cnb")
      const missCount = PLATFORM_META.length - configured.size
      if (missCount > 0) {
        platformMissing.push({ project: p, github: hasGithub, gitee: hasGitee, gitea: hasGitea, cnb: hasCnb, missingCount: missCount })
      }

      // ── 收藏 / 归档 ──
      if (p.starred) starred.push(p)
      if (p.archived) archivedCount++
    }

    // 分组排序
    const grouped = [...groupedMap.values()]
      .filter((g) => g.projects.length > 0)
      .sort((a, b) => a.category.order - b.category.order)

    // 待处理项目排序：totalAhead 降序 → totalBehind 降序 → 变更总数降序
    const pending = [...pendingMap.values()].sort((a, b) => {
      if (a.totalAhead !== b.totalAhead) return b.totalAhead - a.totalAhead
      if (a.totalBehind !== b.totalBehind) return b.totalBehind - a.totalBehind
      const aTotal = a.staged + a.unstaged + a.untracked
      const bTotal = b.staged + b.unstaged + b.untracked
      return bTotal - aTotal
    })

    return {
      grouped,
      count: projects.value.length,
      remoteCoverage: { github, gitee, gitea, cnb, hasRemote, multiple: multipleRemote },
      pushStatusStats: { ahead, behind, synced, noRemote },
      needsPush: needsPush.sort((a, b) => b.totalAhead - a.totalAhead),
      needsPull,
      uncommitted,
      pending,
      platformMissing: platformMissing.sort((a, b) => b.missingCount - a.missingCount),
      starred,
      archivedCount,
    }
  })

  /** 按分类分组后的项目列表 */
  const groupedProjects = computed(() => projectStats.value.grouped)
  const projectCount = computed(() => projectStats.value.count)
  const needsPushProjects = computed(() => projectStats.value.needsPush)
  const needsPullProjects = computed(() => projectStats.value.needsPull)
  const uncommittedProjects = computed(() => projectStats.value.uncommitted)
  const starredProjects = computed(() => projectStats.value.starred)

  /** 待处理项目：需要推送 + 需要拉取 + 有未提交变更 的合并视图（已在 projectStats 主循环内合并排序） */
  const pendingProjects = computed<PendingProjectItem[]>(() => projectStats.value.pending)

  /** 统计面板聚合视图（StatsPanel 唯一数据 prop，新增统计维度只需改这里 + 类型 + 面板三处） */
  const statsView = computed<StatsView>(() => ({
    projectCount: projectStats.value.count,
    remoteCoverage: projectStats.value.remoteCoverage,
    pushStatusStats: projectStats.value.pushStatusStats,
    pendingProjects: pendingProjects.value,
    uncommittedCount: projectStats.value.uncommitted.length,
    starredCount: projectStats.value.starred.length,
    archivedCount: projectStats.value.archivedCount,
    platformStatusProjects: projectStats.value.platformMissing,
  }))

  return {
    gitConcurrency,
    loadGitConcurrency,
    setGitConcurrency,
    networkTimeout,
    loadNetworkTimeout,
    setNetworkTimeout,
    localTimeout,
    loadLocalTimeout,
    setLocalTimeout,
    groupedProjects,
    projectCount,
    needsPushProjects,
    needsPullProjects,
    uncommittedProjects,
    starredProjects,
    statsView,
  }
}
