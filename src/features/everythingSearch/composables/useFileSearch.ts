/**
 * Everything 文件搜索编排 composable
 * 托管搜索状态机（防抖 / 竞态序号 / 空文件夹模式 / 服务探活），把表达式组装交给纯函数 utils.ts
 */
import type { ComputedRef } from "vue"
import type {
  EverythingConfig,
  SearchOptions,
  SearchState,
} from "../types"
import {
  computed,
  reactive,
  ref,
  watch,
} from "vue"
import {
  TimerRegistry,
  type TimerHandle,
} from "@/utils/timerRegistry"
import {
  checkEverythingService,
  searchFiles,
} from "../api"
import {
  buildSearchQuery,
  getFullPath,
  hasPathFilter,
  isProtectedPath,
} from "../utils"

/** 空文件夹搜索结果里需要隐藏的系统路径（防止用户误删系统目录） */
function isSystemFolder(item: { name: string, path: string, type: "file" | "folder" }): boolean {
  return item.type === "folder" && isProtectedPath(getFullPath(item))
}

/** 初始搜索状态（初始化与重置共用，消除重复字面量） */
export function createEmptySearchState(): SearchState {
  return {
    status: "idle",
    results: [],
    errorMessage: "",
  }
}

/** 依赖注入：配置与选项由父层（useSearchConfig）提供 */
export interface UseFileSearchDeps {
  config: EverythingConfig
  options: SearchOptions
  i18n: ComputedRef<Record<string, string>>
}

export function useFileSearch(deps: UseFileSearchDeps) {
  const { config, options, i18n } = deps
  const timerRegistry = new TimerRegistry()

  const query = ref("")
  const serviceAvailable = ref(true)
  const state = reactive<SearchState>(createEmptySearchState())

  let debounceTimer: TimerHandle | null = null
  /** 搜索请求序号（竞态守卫：并发搜索时丢弃过期响应，防止旧结果覆盖新结果） */
  let searchSeq = 0

  /** 路径过滤是否生效（对应开关开启且路径非空才视为有效搜索条件） */
  const pathFilterActive = computed(() => hasPathFilter(options))

  /** 检查服务可用性 */
  const checkService = async () => {
    serviceAvailable.value = await checkEverythingService(config)
  }

  /** 重置搜索状态 */
  const resetState = () => {
    Object.assign(state, createEmptySearchState())
  }

  /**
   * 执行搜索。
   * @param forceEmpty 空文件夹模式（追加 `empty:` 语法并跳过大小过滤）
   */
  const run = async (forceEmpty = false) => {
    const keyword = query.value.trim()
    if (!keyword && !forceEmpty && !pathFilterActive.value) return

    // 取消之前的防抖定时器
    timerRegistry.clear(debounceTimer)
    debounceTimer = null

    // 记录本次请求序号：并发场景下更早发起、更晚返回的响应直接丢弃
    const seq = ++searchSeq
    state.status = "loading"
    state.errorMessage = ""

    try {
      const results = await searchFiles({
        query: buildSearchQuery({
          query: keyword,
          emptyFolders: forceEmpty,
          minSize: options.minSize,
          minSizeUnit: options.minSizeUnit,
          maxSize: options.maxSize,
          maxSizeUnit: options.maxSizeUnit,
          includePathsEnabled: options.includePathsEnabled,
          includePaths: options.includePaths,
          excludePathsEnabled: options.excludePathsEnabled,
          excludePaths: options.excludePaths,
        }),
        matchCase: options.matchCase,
        matchWholeWord: options.matchWholeWord,
        matchPath: options.matchPath,
        regex: options.regex,
        maxResults: options.maxResults,
        sort: options.sort,
        ascending: options.ascending,
      }, config)

      if (seq !== searchSeq) return
      // 空文件夹查询模式下排除系统关键路径下的结果，防止误删导致系统异常
      state.results = forceEmpty ? results.filter(item => !isSystemFolder(item)) : results
      state.status = state.results.length === 0 ? "empty" : "success"
    } catch (error) {
      if (seq !== searchSeq) return
      state.errorMessage = (error as Error).message || i18n.value.searchFailed
      state.status = "error"
      state.results = []
    }
  }

  /** 防抖触发搜索 */
  const scheduleSearch = () => {
    timerRegistry.clear(debounceTimer)

    if (!query.value.trim() && !pathFilterActive.value) {
      resetState()
      return
    }

    debounceTimer = timerRegistry.setTimeout(() => {
      debounceTimer = null
      void run()
    }, options.debounceDelay)
  }

  /** 清除搜索 */
  const clear = () => {
    query.value = ""
    resetState()
  }

  /** 选项变更后：当前有搜索词或路径过滤时立即重搜 */
  const refreshIfActive = () => {
    if (query.value.trim() || pathFilterActive.value) void run()
  }

  /** 从结果列表移除条目（删除成功后调用；仅当条目仍在当前结果中才更新） */
  const removeResult = (item: SearchState["results"][number]) => {
    if (!state.results.includes(item)) return
    state.results = state.results.filter(result => result !== item)
    if (state.results.length === 0) state.status = "empty"
  }

  watch(query, () => {
    scheduleSearch()
  })

  /** 清理定时器（组件卸载时调用） */
  const dispose = () => {
    timerRegistry.clearAll()
    debounceTimer = null
  }

  return {
    query,
    state,
    serviceAvailable,
    pathFilterActive,
    checkService,
    search: run,
    scheduleSearch,
    clear,
    refreshIfActive,
    removeResult,
    resetState,
    dispose,
  }
}
