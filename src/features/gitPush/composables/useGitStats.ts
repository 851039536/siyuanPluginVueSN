// Git 项目统计信息获取 — 单次遍历统一计算所有统计指标
import type { Ref } from "vue"
import type {
  GitProject,
  GitPushManager,
  NeedsPullItem,
  NeedsPushItem,
  PendingProjectItem,
  ProjectCategory,
  PushStatusInfo,
  StatsView,
  UncommittedItem,
  WorkingTreeInfo,
} from "../types"
import { computed, ref } from "vue"
import { PLATFORM_META, UNGROUPED_ID, DEFAULT_NETWORK_TIMEOUT, type PlatformStatusItem } from "../types"

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

  /**
   * 单次遍历计算所有统计指标，避免多个 computed 各自遍历 projects 数组。
   * 派生 computed 仅从该对象取出对应字段，零额外遍历开销。
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
    const needsPush: NeedsPushItem[] = []
    const needsPull: NeedsPullItem[] = []
    const uncommitted: UncommittedItem[] = []
    const platformMissing: PlatformStatusItem[] = []
    const starred: GitProject[] = []
    let archivedCount = 0

    for (const p of projects.value) {
      // ── 分组 ──
      const group = groupedMap.get(p.categoryId)
      if (group) {
        group.projects.push(p)
      } else {
        groupedMap.get(UNGROUPED_ID)?.projects.push(p)
      }

      // ── 远程覆盖率（基于实际 git remote 配置，非手动输入的仓库链接）──
      const remoteCount = [p.githubRemote, p.giteeRemote, p.giteaRemote, p.cnbRemote].filter(Boolean).length
      if (p.githubRemote) github++
      if (p.giteeRemote) gitee++
      if (p.giteaRemote) gitea++
      if (p.cnbRemote) cnb++
      if (remoteCount > 0) hasRemote++
      if (remoteCount >= 2) multipleRemote++

      // ── Push 状态统计 ──
      const status = pushStatuses.value[p.id]
      if (!status || Object.keys(status.remotes).length === 0) {
        noRemote++
      } else {
        const vals = Object.values(status.remotes)
        if (vals.some((r) => r.ahead > 0)) ahead++
        else if (vals.some((r) => r.behind > 0)) behind++
        else synced++
      }

      // ── 待推送 / 待拉取项目 ──
      if (status) {
        const aheadByRemote: { key: string; ahead: number }[] = []
        const behindByRemote: { key: string; behind: number }[] = []
        for (const pm of PLATFORM_META) {
          const rs = status.remotes[pm.key]
          if (rs && rs.ahead > 0) aheadByRemote.push({ key: pm.key, ahead: rs.ahead })
          if (rs && rs.behind > 0) behindByRemote.push({ key: pm.key, behind: rs.behind })
        }
        if (aheadByRemote.length > 0) {
          needsPush.push({
            project: p,
            aheadByRemote,
            totalAhead: aheadByRemote.reduce((s, r) => s + r.ahead, 0),
          })
        }
        if (behindByRemote.length > 0) {
          needsPull.push({
            project: p,
            behindByRemote,
            totalBehind: behindByRemote.reduce((s, r) => s + r.behind, 0),
          })
        }
      }

      // ── 未提交变更 ──
      const wt = workingTrees.value[p.id]
      if (wt?.hasChanges) {
        uncommitted.push({
          project: p,
          staged: wt.stagedCount,
          unstaged: wt.unstagedCount,
          untracked: wt.untrackedCount,
        })
      }

      // ── 平台缺失（基于实际 git remote 配置）──
      const hasGithub = !!p.githubRemote
      const hasGitee = !!p.giteeRemote
      const hasGitea = !!p.giteaRemote
      const hasCnb = !!p.cnbRemote
      const missCount = (hasGithub ? 0 : 1) + (hasGitee ? 0 : 1) + (hasGitea ? 0 : 1) + (hasCnb ? 0 : 1)
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

    return {
      grouped,
      count: projects.value.length,
      remoteCoverage: { github, gitee, gitea, cnb, hasRemote, multiple: multipleRemote },
      pushStatusStats: { ahead, behind, synced, noRemote },
      needsPush: needsPush.sort((a, b) => b.totalAhead - a.totalAhead),
      needsPull,
      uncommitted,
      platformMissing: platformMissing.sort((a, b) => b.missingCount - a.missingCount),
      starred,
      archivedCount,
    }
  })

  /** 按分类分组后的项目列表 */
  const groupedProjects = computed(() => projectStats.value.grouped)
  const projectCount = computed(() => projectStats.value.count)
  const needsPushProjects = computed(() => projectStats.value.needsPush)
  const uncommittedProjects = computed(() => projectStats.value.uncommitted)
  const starredProjects = computed(() => projectStats.value.starred)

  /** 待处理项目：需要推送 + 需要拉取 + 有未提交变更 的合并视图（供统计面板表格使用） */
  const pendingProjects = computed<PendingProjectItem[]>(() => {
    const map = new Map<string, PendingProjectItem>()
    // 取或创建项目对应的合并条目（三个来源共用）
    const entry = (p: GitProject): PendingProjectItem => {
      let item = map.get(p.id)
      if (!item) {
        item = { project: p, aheadByRemote: [], totalAhead: 0, behindByRemote: [], totalBehind: 0, staged: 0, unstaged: 0, untracked: 0 }
        map.set(p.id, item)
      }
      return item
    }
    for (const np of projectStats.value.needsPush) {
      Object.assign(entry(np.project), { aheadByRemote: np.aheadByRemote, totalAhead: np.totalAhead })
    }
    for (const nl of projectStats.value.needsPull) {
      Object.assign(entry(nl.project), { behindByRemote: nl.behindByRemote, totalBehind: nl.totalBehind })
    }
    for (const uc of projectStats.value.uncommitted) {
      Object.assign(entry(uc.project), { staged: uc.staged, unstaged: uc.unstaged, untracked: uc.untracked })
    }
    // 按 totalAhead 降序 → totalBehind 降序 → staged+unstaged+untracked 降序
    return [...map.values()].sort((a, b) => {
      if (a.totalAhead !== b.totalAhead) return b.totalAhead - a.totalAhead
      if (a.totalBehind !== b.totalBehind) return b.totalBehind - a.totalBehind
      const aTotal = a.staged + a.unstaged + a.untracked
      const bTotal = b.staged + b.unstaged + b.untracked
      return bTotal - aTotal
    })
  })

  /** 统计面板聚合视图（StatsPanel 唯一数据 prop，新增统计维度只需改这里 + 类型 + 面板三处） */
  const statsView = computed<StatsView>(() => ({
    projectCount: projectStats.value.count,
    remoteCoverage: projectStats.value.remoteCoverage,
    pushStatusStats: projectStats.value.pushStatusStats,
    pendingProjects: pendingProjects.value,
    uncommittedCount: projectStats.value.uncommitted.length,
    starredCount: projectStats.value.starred.length,
    archivedCount: projectStats.value.archivedCount,
    // 分类分布：grouped 已按 order 排序且仅含非空分类，投影为条形区块所需的最小字段
    categoryDistribution: projectStats.value.grouped.map((g) => ({
      id: g.category.id,
      name: g.category.name,
      color: g.category.color,
      count: g.projects.length,
    })),
    platformStatusProjects: projectStats.value.platformMissing,
  }))

  return {
    gitConcurrency,
    loadGitConcurrency,
    setGitConcurrency,
    networkTimeout,
    loadNetworkTimeout,
    setNetworkTimeout,
    groupedProjects,
    projectCount,
    needsPushProjects,
    uncommittedProjects,
    starredProjects,
    statsView,
  }
}
