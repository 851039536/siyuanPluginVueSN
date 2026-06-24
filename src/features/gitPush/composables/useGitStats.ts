import type { Ref } from "vue"
import type {
  CommitLogEntry,
  GitProject,
  GitPushManager,
  ProjectCategory,
  PushStatusInfo,
  WorkingTreeInfo,
} from "../types"
import { computed, ref } from "vue"
import { PLATFORM_META } from "../types"

export function useGitStats(
  manager: GitPushManager,
  projects: Ref<GitProject[]>,
  categories: Ref<ProjectCategory[]>,
  pushStatuses: Ref<Record<string, PushStatusInfo>>,
  workingTrees: Ref<Record<string, WorkingTreeInfo>>,
  commitLogs: Ref<Record<string, CommitLogEntry[]>>,
) {
  const gitConcurrency = ref(3)

  function loadGitConcurrency() {
    gitConcurrency.value = manager.getGitConcurrency()
  }

  async function setGitConcurrency(n: number) {
    await manager.setGitConcurrency(n)
    gitConcurrency.value = n
  }

  /** 按分类分组后的项目列表 */
  const groupedProjects = computed(() => {
    const map = new Map<string, { category: ProjectCategory, projects: GitProject[] }>()
    for (const cat of categories.value) {
      map.set(cat.id, { category: cat, projects: [] })
    }
    for (const p of projects.value) {
      const group = map.get(p.categoryId)
      if (group) {
        group.projects.push(p)
      } else {
        const ungrouped = map.get("__ungrouped__")
        if (ungrouped) ungrouped.projects.push(p)
      }
    }
    return [...map.values()]
      .filter((g) => g.projects.length > 0)
      .sort((a, b) => a.category.order - b.category.order)
  })

  const projectCount = computed(() => projects.value.length)

  const remoteCoverage = computed(() => {
    const total = projects.value.length
    if (total === 0) { return { total: 0, github: 0, gitee: 0, gitea: 0, cnb: 0, hasRemote: 0, noRemote: 0, multiple: 0 } }
    let github = 0; let gitee = 0; let gitea = 0; let cnb = 0; let hasRemote = 0; let multiple = 0
    for (const p of projects.value) {
      const remotes = [p.githubUrl, p.giteeUrl, p.giteaUrl, p.cnbUrl].filter(Boolean).length
      if (p.githubUrl) github++
      if (p.giteeUrl) gitee++
      if (p.giteaUrl) gitea++
      if (p.cnbUrl) cnb++
      if (remotes > 0) hasRemote++
      if (remotes >= 2) multiple++
    }
    return { total, github, gitee, gitea, cnb, hasRemote, noRemote: total - hasRemote, multiple }
  })

  const pushStatusStats = computed(() => {
    const total = projects.value.length
    if (total === 0) { return { total: 0, ahead: 0, behind: 0, synced: 0, noRemote: 0 } }
    let ahead = 0; let behind = 0; let synced = 0; let noRemote = 0
    for (const p of projects.value) {
      const status = pushStatuses.value[p.id]
      if (!status || Object.keys(status.remotes).length === 0) { noRemote++; continue }
      const remotes = Object.values(status.remotes)
      if (remotes.some((r) => r.ahead > 0)) ahead++
      else if (remotes.some((r) => r.behind > 0)) behind++
      else synced++
    }
    return { total, ahead, behind, synced, noRemote }
  })

  const needsPushProjects = computed(() => {
    const result: { project: GitProject, aheadByRemote: { key: string, ahead: number }[], totalAhead: number }[] = []
    for (const p of projects.value) {
      const status = pushStatuses.value[p.id]
      if (!status) continue
      const aheadByRemote: { key: string, ahead: number }[] = []
      for (const pm of PLATFORM_META) {
        const rs = status.remotes[pm.key]
        if (rs && rs.ahead > 0) aheadByRemote.push({ key: pm.key, ahead: rs.ahead })
      }
      if (aheadByRemote.length > 0) {
        result.push({ project: p, aheadByRemote, totalAhead: aheadByRemote.reduce((s, r) => s + r.ahead, 0) })
      }
    }
    return result.sort((a, b) => b.totalAhead - a.totalAhead)
  })

  const uncommittedProjects = computed(() => {
    return projects.value
      .filter((p) => workingTrees.value[p.id]?.hasChanges)
      .map((p) => ({
        project: p,
        staged: workingTrees.value[p.id]!.stagedCount,
        unstaged: workingTrees.value[p.id]!.unstagedCount,
        untracked: workingTrees.value[p.id]!.untrackedCount,
      }))
  })

  interface PlatformStatusItem {
    project: GitProject
    github: boolean
    gitee: boolean
    gitea: boolean
    cnb: boolean
    missingCount: number
  }
  const platformStatusProjects = computed<PlatformStatusItem[]>(() => {
    const result: PlatformStatusItem[] = []
    for (const p of projects.value) {
      const github = !!p.githubUrl
      const gitee = !!p.giteeUrl
      const gitea = !!p.giteaUrl
      const cnb = !!p.cnbUrl
      const missingCount = (github ? 0 : 1) + (gitee ? 0 : 1) + (gitea ? 0 : 1) + (cnb ? 0 : 1)
      if (missingCount > 0) {
        result.push({ project: p, github, gitee, gitea, cnb, missingCount })
      }
    }
    return result.sort((a, b) => b.missingCount - a.missingCount)
  })

  /** @deprecated 使用 platformStatusProjects 替代 */
  const noPlatformProjects = computed(() => {
    return platformStatusProjects.value
      .filter((item) => item.missingCount === PLATFORM_META.length)
      .map((item) => item.project)
  })

  const recentCommits = computed(() => {
    const allEntries: { projectId: string, projectName: string, entry: CommitLogEntry }[] = []
    for (const p of projects.value) {
      const logs = commitLogs.value[p.id]
      if (logs && logs.length > 0) {
        allEntries.push({ projectId: p.id, projectName: p.name, entry: logs[0] })
      }
    }
    return allEntries.sort((a, b) => (b.entry.date || "").localeCompare(a.entry.date || ""))
  })

  const starredProjects = computed(() => projects.value.filter((p) => p.starred))
  const archivedProjects = computed(() => projects.value.filter((p) => p.archived))

  const tagStats = computed<{ tag: string, count: number }[]>(() => {
    const map = new Map<string, number>()
    for (const p of projects.value) {
      if (!p.archived && p.tags) {
        for (const t of p.tags) { if (t) map.set(t, (map.get(t) || 0) + 1) }
      }
    }
    return [...map.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count)
  })

  const statusStats = computed(() => {
    const result = { active: 0, maintenance: 0, paused: 0 }
    for (const p of projects.value) {
      if (p.archived) continue
      const s = p.status || "active"
      if (s === "maintenance") result.maintenance++
      else if (s === "paused") result.paused++
      else result.active++
    }
    return result
  })

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
    noPlatformProjects,
    platformStatusProjects,
    recentCommits,
    starredProjects,
    archivedProjects,
    tagStats,
    statusStats,
  }
}
