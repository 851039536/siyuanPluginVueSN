// Git 项目筛选排序与分类过滤
import type { Ref } from "vue"
import type { GitProject, ViewMode } from "../types"
import {
  computed,
  onUnmounted,
  ref,
  watch,
} from "vue"
import { VIEW_MODE_META } from "../types"
import { sortProjects } from "../utils"
import { matchProjectQuery } from "../utils/projectSearch"
import { TimerRegistry } from "@/utils/timerRegistry"
import type { TypedStorage } from "@/utils/typedStorage"

/** 分类分组结构（与 useGitStats.groupedProjects 元素结构一致） */
type ProjectGroup = { category: { id: string, name: string, color: string, order: number }, projects: GitProject[] }

/** 「命中项目集合」响应式引用（needsPush / needsPull / uncommitted 等共用：项只需含 project 字段） */
type ProjectItemListRef = Ref<{ project: GitProject }[]>

interface UseProjectFiltersOptions {
  /** git 操作暂停状态持久化槽位（由 GitPushStorage 提供） */
  gitOpsPausedStorage: TypedStorage<boolean>
  /** 显示已归档项目持久化槽位（由 GitPushStorage 提供） */
  showArchivedStorage: TypedStorage<boolean>
  projects: Ref<GitProject[]>
  needsPushProjects: ProjectItemListRef
  needsPullProjects: ProjectItemListRef
  uncommittedProjects: ProjectItemListRef
  starredProjects: Ref<GitProject[]>
  /** 按分类 TAB 过滤后的分组（无搜索词时的数据源） */
  visibleGroups: Ref<ProjectGroup[]>
  /** 全部分组（搜索时跨分类查找的数据源，不受分类 TAB 限制） */
  allGroups: Ref<ProjectGroup[]>
}

export function useProjectFilters(options: UseProjectFiltersOptions) {
  const {
    gitOpsPausedStorage,
    showArchivedStorage,
    projects,
    needsPushProjects,
    needsPullProjects,
    uncommittedProjects,
    starredProjects,
    visibleGroups,
    allGroups,
  } = options

  const searchQuery = ref("")
  /** 防抖后的搜索词（300ms），用于过滤计算，避免每次按键都重算 computed 与 DOM diff */
  const debouncedQuery = ref("")
  /** 搜索防抖定时器（统一走 TimerRegistry，随组件卸载清理） */
  const searchTimers = new TimerRegistry()
  watch(searchQuery, (v) => {
    searchTimers.clearAll()
    searchTimers.setTimeout(() => { debouncedQuery.value = v }, 300)
  })
  onUnmounted(() => {
    searchTimers.clearAll()
  })
  const viewMode = ref<ViewMode>("all")
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

  /** 生效中的搜索词（与列表高亮、结果统计同源，避免 raw/debounced 两套时间基准） */
  const activeQuery = computed(() => debouncedQuery.value.trim())
  /** 是否处于搜索态 */
  const searchActive = computed(() => activeQuery.value.length > 0)

  /**
   * 按【命中项目集合】筛选并排序（needsPush / needsPull 等共用）。
   * 集合项只需含 project 字段，故对 GitProject 之外的项目项类型同样适用。
   */
  function pickByIds(source: ProjectItemListRef): GitProject[] {
    const ids = new Set(source.value.map((n) => n.project.id))
    return sortProjects(projects.value.filter((p) => ids.has(p.id)))
  }

  /** 智能视图模式下，命中条件的扁平项目列表 */
  const smartViewProjects = computed<GitProject[]>(() => {
    if (viewMode.value === "needsPush") return pickByIds(needsPushProjects)
    if (viewMode.value === "needsPull") return pickByIds(needsPullProjects)
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

  /** 标签筛选（浏览与搜索共用，避免两条管道各自复制一份判断） */
  function filterByTags(list: GitProject[]): GitProject[] {
    const tags = selectedTags.value
    if (tags.size === 0) return list
    return list.filter((p) => p.tags?.some((t) => tags.has(t)))
  }

  /**
   * 全局搜索结果（搜索态唯一数据源）。
   * 搜索是「查找器」而非「筛选器」：忽略当前智能视图与分类 TAB，并包含归档项目
   * （归档结果在卡片上已有「归档」角标），避免"换个视图/关着归档就搜不到"。
   */
  const searchGroups = computed<ProjectGroup[]>(() => {
    const q = activeQuery.value
    return allGroups.value
      .map((g) => ({
        ...g,
        projects: sortProjects(
          filterByTags(g.projects).filter((p) => matchProjectQuery(p, q, g.category.name)),
        ),
      }))
      .filter((g) => g.projects.length > 0)
  })

  /** 浏览态分组（无搜索词）：智能视图 / 分类 TAB 按原有范围过滤 */
  const browseGroups = computed<ProjectGroup[]>(() => {
    const isArchivedView = viewMode.value === "archived"

    const applyBrowseFilters = (list: GitProject[]) => {
      let r = list
      if (!isArchivedView && !showArchived.value) r = r.filter((p) => !p.archived)
      return sortProjects(filterByTags(r))
    }

    if (viewMode.value !== "all") {
      const filtered = applyBrowseFilters(smartViewProjects.value)
      if (filtered.length === 0) return []
      const meta = VIEW_MODE_META[viewMode.value]
      return [{
        category: {
          id: `__smart_${viewMode.value}__`,
          // 合成分组名无 UI 渲染点，存 i18n 键名仅作调试标识
          name: meta.labelKey,
          color: "var(--b3-theme-primary)",
          order: -1,
        },
        projects: filtered,
      }]
    }

    return visibleGroups.value
      .map((g) => ({ ...g, projects: applyBrowseFilters(g.projects) }))
      .filter((g) => g.projects.length > 0)
  })

  /** 列表最终数据源：搜索态全局查找，浏览态按视图/分类过滤 */
  const filteredGroups = computed(() => (searchActive.value ? searchGroups.value : browseGroups.value))

  /** 搜索结果总数（搜索提示条与空态共用，避免各自 reduce 一遍） */
  const searchResultCount = computed(() =>
    searchGroups.value.reduce((sum, g) => sum + g.projects.length, 0),
  )

  /** 切换标签筛选（创建新 Set 确保 Vue 响应式） */
  function toggleTag(tag: string) {
    const next = new Set(selectedTags.value)
    if (next.has(tag)) { next.delete(tag) } else { next.add(tag) }
    selectedTags.value = next
  }

  /** 清除所有标签筛选 */
  function clearTags() {
    selectedTags.value = new Set()
  }

  /** 清空搜索词（空态与搜索提示条的一键清除；防抖一并跳过，列表即时恢复） */
  function clearSearch() {
    searchTimers.clearAll()
    debouncedQuery.value = ""
    searchQuery.value = ""
  }

  return {
    searchQuery,
    activeQuery,
    searchActive,
    searchResultCount,
    viewMode,
    showArchived,
    gitOpsPaused,
    selectedTags,
    filteredGroups,
    toggleTag,
    clearTags,
    clearSearch,
    loadGitOpsPaused,
    loadShowArchived,
  }
}
