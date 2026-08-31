<template>
  <Teleport
    to="body"
    :disabled="mode === 'tab'"
  >
    <div
      v-if="mode === 'tab' || visible"
      :class="mode === 'tab' ? 'vp-search-tab-root' : 'vp-overlay'"
      @click.self="mode === 'overlay' && closeDialog()"
    >
      <div
        class="vp-dialog"
        :class="{ 'vp-dialog--tab': mode === 'tab' }"
      >
        <!-- 头部 -->
        <DialogHeader
          :i18n="i18n"
          :mode="mode"
          :is-floating="isFloating"
          @close="closeDialog"
          @open-floating="handleOpenFloating"
        />

        <!-- 搜索栏 -->
        <SearchBar
          ref="searchBarRef"
          v-model="searchQuery"
          :i18n="i18n"
          :is-searching="searchState.status === 'loading'"
          :can-search="hasPathFilter()"
          @search="handleSearch"
          @empty-search="handleSearch(true)"
          @clear="handleClear"
        />

        <!-- 搜索选项 -->
        <SearchOptions
          :options="options"
          :i18n="i18n"
          @update:options="handleOptionUpdate"
        />

        <!-- 常用关键字 -->
        <FrequentKeywords
          :keywords="options.frequentKeywords"
          :i18n="i18n"
          @insert="handleKeywordInsert"
          @add="handleKeywordAdd"
          @delete="handleKeywordDelete"
        />

        <!-- 高级搜索语法帮助 -->
        <AdvancedHelpPanel
          v-if="options.advancedMode"
          :i18n="i18n"
          @insert="handleSyntaxInsert"
        />

        <!-- 服务状态提示 -->
        <ServiceWarning
          v-if="!serviceAvailable"
          :i18n="i18n"
          @retry="checkService"
        />

        <!-- 结果区域 -->
        <SearchResults
          :state="searchState"
          :i18n="i18n"
          @item-open="handleItemOpen"
          @item-show-in-folder="handleItemShowInFolder"
          @item-copy-path="handleItemCopyPath"
          @item-delete="handleItemDelete"
        />

        <!-- 底部配置 -->
        <DialogFooter
          :config="config"
          :i18n="i18n"
          @update:config="handleConfigUpdate"
        />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type {
  EverythingConfig,
  SearchOptions as SearchOptionsType,
  SearchState,
} from "./types"
import type { EverythingSearchOptions } from "./api"
import { getFrontend } from "siyuan"
import {
  computed,
  nextTick,
  onUnmounted,
  reactive,
  ref,
  watch,
} from "vue"
import { usePlugin } from "@/main"
import {
  TimerRegistry,
  type TimerHandle,
} from "@/utils/timerRegistry"
import {
  checkEverythingService,
  getFullPath,
  isSystemPath,
  searchFiles,
} from "./api"
import AdvancedHelpPanel from "./components/AdvancedHelpPanel.vue"
import DialogFooter from "./components/DialogFooter.vue"
import DialogHeader from "./components/DialogHeader.vue"
import FrequentKeywords from "./components/FrequentKeywords.vue"
import SearchBar from "./components/SearchBar.vue"
import SearchOptions from "./components/SearchOptions.vue"
import SearchResults from "./components/SearchResults.vue"
import ServiceWarning from "./components/ServiceWarning.vue"
import { useResultActions } from "./composables/useResultActions"
import { useSearchConfig } from "./composables/useSearchConfig"

// Props
interface Props {
  visible: boolean
  /** 承载模式：overlay = Teleport 弹窗；tab = 独立窗口页签 */
  mode?: "overlay" | "tab"
}

const props = withDefaults(defineProps<Props>(), {
  mode: "overlay",
})

// Emits
const emit = defineEmits<{
  (e: "update:visible", value: boolean): void
}>()

// Refs
const searchBarRef = ref<InstanceType<typeof SearchBar> | null>(null)

// 获取插件实例
const plugin = usePlugin()

// everythingSearch 命名空间的 i18n 文案（传递给各子组件）
const i18n = computed(() => plugin.i18n.everythingSearch as unknown as Record<string, string>)

// 配置持久化（存储加载/防抖保存/选项与配置更新/常用关键字管理）
const {
  config,
  options,
  loadConfig,
  updateOption,
  updateConfig,
  addKeyword,
  deleteKeyword,
} = useSearchConfig(plugin)

// 状态
const searchQuery = ref("")
const serviceAvailable = ref(true)
const searchTimerRegistry = new TimerRegistry()
let debounceTimer: TimerHandle | null = null
// 搜索请求序号（竞态守卫：并发搜索时丢弃过期响应，防止旧结果覆盖新结果）
let searchSeq = 0

/** 初始搜索状态（初始化与重置共用，消除重复字面量） */
const createEmptySearchState = (): SearchState => ({
  status: "idle",
  results: [],
  errorMessage: "",
})

// 搜索状态
const searchState = reactive<SearchState>(createEmptySearchState())

/** 检查服务 */
const checkService = async () => {
  serviceAvailable.value = await checkEverythingService(config)
}

/** 是否有路径过滤（对应开关开启且路径非空才视为有效搜索条件） */
const hasPathFilter = () =>
  (options.includePathsEnabled && options.includePaths.length > 0)
  || (options.excludePathsEnabled && options.excludePaths.length > 0)

/** 构造 API 请求参数（UI 搜索选项 → Everything 查询参数的显式映射） */
const buildApiRequest = (query: string): EverythingSearchOptions => ({
  query,
  matchCase: options.matchCase,
  matchWholeWord: options.matchWholeWord,
  matchPath: options.matchPath,
  regex: options.regex,
  maxResults: options.maxResults,
  sort: options.sort,
  ascending: options.ascending,
  includePathsEnabled: options.includePathsEnabled,
  includePaths: options.includePaths,
  excludePathsEnabled: options.excludePathsEnabled,
  excludePaths: options.excludePaths,
})

/** 搜索 */
const handleSearch = async (forceEmpty = false) => {
  // 拼接基础查询与文件大小过滤条件
  const rawQuery = searchQuery.value.trim()
  if (!rawQuery && !forceEmpty && !hasPathFilter()) return

  let query = rawQuery
  if (forceEmpty) {
    // 空文件夹查询：追加 Everything empty: 语法仅匹配空文件夹（空文件夹 size 必为 0，跳过大小过滤，否则 minSize 配置会过滤掉全部结果）
    query = query ? `${query} empty:` : "empty:"
  } else {
    if (options.minSize > 0) {
      query += ` size:>${options.minSize}${options.minSizeUnit.toLowerCase()}`
    }
    if (options.maxSize > 0) {
      query += ` size:<${options.maxSize}${options.maxSizeUnit.toLowerCase()}`
    }
  }

  // 取消之前的防抖定时器
  searchTimerRegistry.clear(debounceTimer)
  debounceTimer = null

  // 记录本次请求序号：并发场景下更早发起、更晚返回的响应直接丢弃
  const seq = ++searchSeq
  searchState.status = "loading"
  searchState.errorMessage = ""

  try {
    const results = await searchFiles(buildApiRequest(query), config)
    if (seq !== searchSeq) return
    // 空文件夹查询模式下排除系统关键路径下的结果，防止误删导致系统异常
    searchState.results = forceEmpty
      ? results.filter(
          (item) => !(item.type === "folder" && isSystemPath(getFullPath(item))),
        )
      : results
    searchState.status = searchState.results.length === 0 ? "empty" : "success"
  } catch (error) {
    if (seq !== searchSeq) return
    // 搜索失败提示："搜索失败"
    searchState.errorMessage = (error as Error).message || i18n.value.searchFailed
    searchState.status = "error"
    searchState.results = []
  }
}

/** 重置搜索状态 */
const resetSearchState = () => {
  Object.assign(searchState, createEmptySearchState())
}

/** 防抖搜索 */
const debouncedSearch = () => {
  searchTimerRegistry.clear(debounceTimer)

  const query = searchQuery.value.trim()
  if (!query && !hasPathFilter()) {
    resetSearchState()
    return
  }

  debounceTimer = searchTimerRegistry.setTimeout(() => {
    debounceTimer = null
    void handleSearch()
  }, options.debounceDelay)
}

/** 清除搜索 */
const handleClear = () => {
  searchQuery.value = ""
  resetSearchState()
  searchBarRef.value?.focus()
}

/** 当前是否运行在独立浮动窗口中（getFrontend()：desktop=主窗口 / desktop-window=新窗口） */
const isFloating = computed(() => {
  try {
    return getFrontend() === "desktop-window"
  } catch {
    return false
  }
})

/** 打开独立浮动窗口：经 __everythingSearch 挂载的 Manager 调度，同时关闭 overlay 弹窗避免双实例 */
const handleOpenFloating = () => {
  const manager = (plugin as any).__everythingSearch as
    | { openFloating: () => void }
    | undefined
  if (!manager) return
  closeDialog()
  void manager.openFloating()
}

/** 关闭弹窗 */
const closeDialog = () => {
  emit("update:visible", false)
}

/** 处理选项更新（当前有搜索词或路径过滤时立即重新搜索） */
const handleOptionUpdate = (
  key: keyof SearchOptionsType,
  value: SearchOptionsType[keyof SearchOptionsType],
) => {
  updateOption(key, value)
  if (searchQuery.value.trim() || hasPathFilter()) {
    void handleSearch()
  }
}

/** 处理配置更新（host/port 变更后重检服务可用性） */
const handleConfigUpdate = (
  key: keyof EverythingConfig,
  value: EverythingConfig[keyof EverythingConfig],
) => {
  updateConfig(key, value)
  if (key === "host" || key === "port") {
    void checkService()
  }
}

/** 插入高级搜索语法 */
const handleSyntaxInsert = (keyword: string) => {
  searchQuery.value = searchQuery.value
    ? `${searchQuery.value} ${keyword}`
    : keyword
  searchBarRef.value?.focus()
}

/** 插入常用关键字到搜索框 */
const handleKeywordInsert = (keyword: string) => {
  searchQuery.value = keyword
  searchBarRef.value?.focus()
}

/** 添加常用关键字 */
const handleKeywordAdd = (keyword: string) => {
  addKeyword(keyword)
}

/** 删除常用关键字 */
const handleKeywordDelete = (keyword: string) => {
  deleteKeyword(keyword)
}

// 结果操作（打开/资源管理器显示/复制路径/移入回收站，shell 瀑布 + PowerShell 兜底）
const {
  handleItemOpen,
  handleItemShowInFolder,
  handleItemCopyPath,
  handleItemDelete,
} = useResultActions(i18n, searchState)

/**
 * 监听 visible 变化（immediate：tab 模式挂载时 visible 恒为 true 不变化，
 * 必须立即触发一次以加载持久化配置，否则常用关键字等保持默认空值）
 */
watch(
  () => props.visible,
  async (newVal) => {
    if (newVal) {
      await nextTick()
      await loadConfig()
      searchBarRef.value?.focus()
      void checkService()
    }
  },
  { immediate: true },
)

/** 监听搜索查询变化 */
watch(searchQuery, () => {
  debouncedSearch()
})

onUnmounted(() => {
  searchTimerRegistry.clearAll()
})

</script>

<style scoped lang="scss">
@use "./styles/index.scss";
</style>
