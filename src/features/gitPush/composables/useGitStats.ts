// Git 项目统计信息获取 — 单次遍历统一计算所有统计指标
import type { Ref } from "vue"
import type {
  GitProject,
  GitPushManager,
  ProjectCategory,
  PushStatusInfo,
  WorkingTreeInfo,
} from "../types"
import { computed, ref } from "vue"
import { PLATFORM_META, UNGROUPED_ID, type PlatformStatusItem } from "../types"

export function useGitStats(
  manager: GitPushManager,
  projects: Ref<GitProject[]>,
  categories: Ref<ProjectCategory[]>,
  pushStatuses: Ref<Record<string, PushStatusInfo>>,
  workingTrees: Ref<Record<string, WorkingTreeInfo>>,
) {
  const gitConcurrency = ref(3)

  function loadGitConcurrency() {
    gitConcurrency.value = manager.getGitConcurrency()
  }

  async function setGitConcurrency(n: number) {
    await manager.setGitConcurrency(n)
    gitConcurrency.value = n
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
    const needsPush: { project: GitProject; aheadByRemote: { key: string; ahead: number }[]; totalAhead: number }[] = []
    const uncommitted: { project: GitProject; staged: number; unstaged: number; untracked: number }[] = []
    const platformMissing: PlatformStatusItem[] = []
    const starred: GitProject[] = []

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

      // ── 待推送项目 ──
      if (status) {
        const aheadByRemote: { key: string; ahead: number }[] = []
        for (const pm of PLATFORM_META) {
          const rs = status.remotes[pm.key]
          if (rs && rs.ahead > 0) aheadByRemote.push({ key: pm.key, ahead: rs.ahead })
        }
        if (aheadByRemote.length > 0) {
          needsPush.push({
            project: p,
            aheadByRemote,
            totalAhead: aheadByRemote.reduce((s, r) => s + r.ahead, 0),
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

      // ── 收藏 ──
      if (p.starred) starred.push(p)
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
      uncommitted,
      platformMissing: platformMissing.sort((a, b) => b.missingCount - a.missingCount),
      starred,
    }
  })

  /** 按分类分组后的项目列表 */
  const groupedProjects = computed(() => projectStats.value.grouped)
  const projectCount = computed(() => projectStats.value.count)
  const remoteCoverage = computed(() => projectStats.value.remoteCoverage)
  const pushStatusStats = computed(() => projectStats.value.pushStatusStats)
  const needsPushProjects = computed(() => projectStats.value.needsPush)
  const uncommittedProjects = computed(() => projectStats.value.uncommitted)
  const platformStatusProjects = computed(() => projectStats.value.platformMissing)
  const starredProjects = computed(() => projectStats.value.starred)

  return {
    gitConcurrency,
    loadGitConcurrency,
    setGitConcurrency,
    groupedProjects,
    projectCount,
    remoteCoverage,
    pushStatusStats,
    needsPushProjects,
    uncommittedProjects,
    platformStatusProjects,
    starredProjects,
  }
}
