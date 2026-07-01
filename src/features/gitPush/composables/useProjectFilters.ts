import type { Ref } from "vue"
import type { GitProject } from "../types"
import {
  computed,
  ref,
  watch,
} from "vue"
import type { TypedStorage } from "@/utils/typedStorage"

interface UseProjectFiltersOptions {
  /** git 操作暂停状态持久化槽位（由 GitPushStorage 提供） */
  gitOpsPausedStorage: TypedStorage<boolean>
  /** 显示已归档项目持久化槽位（由 GitPushStorage 提供） */
  showArchivedStorage: TypedStorage<boolean>
  projects: Ref<GitProject[]>
  needsPushProjects: Ref<{ project: GitProject }[]>
  uncommittedProjects: Ref<{ project: GitProject }[]>
  starredProjects: Ref<GitProject[]>
  visibleGroups: Ref<{ category: { id: string, name: string, color: string, order: number }, projects: GitProject[] }[]>
  sortProjects: (list: GitProject[]) => GitProject[]
}

/** 智能视图模式元数据（标签 + 命中数） */
export const VIEW_MODE_META: Record<string, { label: string, icon: string }> = {
  all: { label: "全部", icon: "mdi:view-grid-outline" },
  needsPush: { label: "需推送", icon: "mdi:cloud-upload-outline" },
  uncommitted: { label: "有变更", icon: "mdi:source-branch" },
  starred: { label: "收藏", icon: "mdi:star" },
  archived: { label: "归档", icon: "mdi:archive-outline" },
}

export function useProjectFilters(options: UseProjectFiltersOptions) {
  const {
    gitOpsPausedStorage,
    showArchivedStorage,
    projects,
    needsPushProjects,
    uncommittedProjects,
    starredProjects,
    visibleGroups,
    sortProjects,
  } = options

  const searchQuery = ref("")
  const viewMode = ref<"all" | "needsPush" | "uncommitted" | "starred" | "archived">("all")
  const showArchived = ref(false)
  const selectedTags = ref<Set<string>>(new Set())

  const gitOpsPaused = ref(false)

  async function loadGitOpsPaused() {
    gitOpsPaused.value = await gitOpsPausedStorage.loadOrDefault()
  }

  watch(gitOpsPaused, (v) => {
    gitOpsPausedStorage.save(v).catch(() => {})
  })

  async function loadShowArchived() {
    showArchived.value = await showArchivedStorage.loadOrDefault()
  }

  watch(showArchived, (v) => {
    showArchivedStorage.save(v).catch(() => {})
  })

  /** 智能视图模式下，命中条件的扁平项目列表 */
  const smartViewProjects = computed<GitProject[]>(() => {
    if (viewMode.value === "needsPush") {
      const ids = new Set(needsPushProjects.value.map((n) => n.project.id))
      return sortProjects(projects.value.filter((p) => ids.has(p.id)))
    }
    if (viewMode.value === "uncommitted") {
      return sortProjects(uncommittedProjects.value.map((u) => u.project))
    }
    if (viewMode.value === "starred") {
      return sortProjects(starredProjects.value)
    }
    if (viewMode.value === "archived") {
      return sortProjects(projects.value.filter((p) => p.archived))
    }
    return []
  })

  /** 统一筛选 + 分组管道 */
  const filteredGroups = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    const tags = selectedTags.value
    const isArchivedView = viewMode.value === "archived"

    const applyFilters = (list: GitProject[]) => {
      let r = list
      if (!isArchivedView && !showArchived.value) r = r.filter((p) => !p.archived)
      if (tags.size > 0) r = r.filter((p) => p.tags?.some((t) => tags.has(t)))
      if (q) r = r.filter((p) =>
        p.name.toLowerCase().includes(q)
        || p.path.toLowerCase().includes(q)
        || (p.localPaths?.some((lp) => lp.toLowerCase().includes(q)))
        || (p.tags?.some((t) => t.toLowerCase().includes(q))),
      )
      return r
    }

    if (viewMode.value !== "all") {
      const filtered = applyFilters(smartViewProjects.value)
      if (filtered.length === 0) return []
      const meta = VIEW_MODE_META[viewMode.value]
      return [{
        category: {
          id: `__smart_${viewMode.value}__`,
          name: meta.label,
          color: "var(--b3-theme-primary)",
          order: -1,
        },
        projects: filtered,
      }]
    }

    return visibleGroups.value
      .map((g) => ({ ...g, projects: applyFilters(g.projects) }))
      .map((g) => ({ ...g, projects: sortProjects(g.projects) }))
      .filter((g) => g.projects.length > 0)
  })

  return {
    searchQuery,
    viewMode,
    showArchived,
    gitOpsPaused,
    selectedTags,
    smartViewProjects,
    filteredGroups,
    loadGitOpsPaused,
    loadShowArchived,
  }
}
