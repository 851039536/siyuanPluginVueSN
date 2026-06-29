import type { Ref } from "vue"
import type {
  GitProject,
  GitPushManager,
  ProjectCategory,
  PushStatusInfo,
  WorkingTreeInfo,
} from "../types"
import { computed, ref } from "vue"
import { PLATFORM_META, type PlatformStatusItem } from "../types"

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
    if (projects.value.length === 0) { return { github: 0, gitee: 0, gitea: 0, cnb: 0, hasRemote: 0, multiple: 0 } }
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
    return { github, gitee, gitea, cnb, hasRemote, multiple }
  })

  const pushStatusStats = computed(() => {
    if (projects.value.length === 0) { return { ahead: 0, behind: 0, synced: 0, noRemote: 0 } }
    let ahead = 0; let behind = 0; let synced = 0; let noRemote = 0
    for (const p of projects.value) {
      const status = pushStatuses.value[p.id]
      if (!status || Object.keys(status.remotes).length === 0) { noRemote++; continue }
      const remotes = Object.values(status.remotes)
      if (remotes.some((r) => r.ahead > 0)) ahead++
      else if (remotes.some((r) => r.behind > 0)) behind++
      else synced++
    }
    return { ahead, behind, synced, noRemote }
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

  const starredProjects = computed(() => projects.value.filter((p) => p.starred))

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
