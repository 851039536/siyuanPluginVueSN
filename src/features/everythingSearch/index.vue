<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="vp-overlay"
      @click.self="closeDialog"
    >
      <div class="vp-dialog">
        <!-- 头部 -->
        <DialogHeader
          :i18n="i18n"
          @close="closeDialog"
        />

        <!-- 搜索栏 -->
        <SearchBar
          ref="searchBarRef"
          v-model="searchQuery"
          :i18n="i18n"
          :is-searching="searchState.status === 'loading'"
          @search="handleSearch"
          @clear="handleClear"
          @escape="closeDialog"
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
  EverythingSearchResult,
  SearchOptions as SearchOptionsType,
  SearchState,
} from "./types"
import { showMessage } from "siyuan"
import {
  computed,
  nextTick,
  onUnmounted,
  reactive,
  ref,
  watch,
} from "vue"
import { usePlugin } from "@/main"
import { copyToClipboard } from "@/utils/domUtils"
import {
  checkEverythingService,
  deleteFile,
  getFullPath,
  openFile,
  searchFiles,
  showInExplorer,
} from "./api"
import AdvancedHelpPanel from "./components/AdvancedHelpPanel.vue"
import DialogFooter from "./components/DialogFooter.vue"
import DialogHeader from "./components/DialogHeader.vue"
import FrequentKeywords from "./components/FrequentKeywords.vue"
import SearchBar from "./components/SearchBar.vue"
import SearchOptions from "./components/SearchOptions.vue"
import SearchResults from "./components/SearchResults.vue"
import ServiceWarning from "./components/ServiceWarning.vue"
import {
  DEFAULT_CONFIG,
  DEFAULT_OPTIONS,
  EverythingSearchStorage,
} from "./types/storage"

// Props
interface Props {
  visible: boolean
}

const props = defineProps<Props>()

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

// 存储管理
const storage = new EverythingSearchStorage(plugin)

// 状态
const searchQuery = ref("")
const serviceAvailable = ref(true)
const debounceTimer = ref<number | null>(null)
const saveConfigTimer = ref<number | null>(null)
// 正在从存储加载配置（避免加载触发 deep watch 回写）
let isLoadingConfig = false

// 配置
const config = reactive<EverythingConfig>({ ...DEFAULT_CONFIG })

// 搜索选项
const options = reactive<SearchOptionsType>({ ...DEFAULT_OPTIONS })

// 搜索状态
const searchState = reactive<SearchState>({
  status: "idle",
  results: [],
  errorMessage: "",
  hasSearched: false,
})

/** 从插件存储加载配置 */
const loadConfig = async () => {
  isLoadingConfig = true
  try {
    const savedData = await storage.init()
    Object.assign(config, savedData.config)
    Object.assign(options, savedData.options)
  } catch (error) {
    console.error("从插件存储加载配置失败:", error)
  } finally {
    // 延迟一个 tick 重置，确保 deep watch 已跳过本次加载触发的回调
    await nextTick()
    isLoadingConfig = false
  }
}

/** 保存配置到插件存储（带防抖） */
const saveConfigToPlugin = async () => {
  // 清除之前的定时器
  if (saveConfigTimer.value) {
    clearTimeout(saveConfigTimer.value)
  }

  // 延迟保存，避免频繁写入
  saveConfigTimer.value = window.setTimeout(async () => {
    try {
      await storage.config.save(config)
      await storage.options.save(options)
    } catch (error) {
      console.error("保存配置到插件存储失败:", error)
    }
  }, 500)
}

/** 检查服务 */
const checkService = async () => {
  serviceAvailable.value = await checkEverythingService(config)
}

/** 搜索 */
const handleSearch = async () => {
  // 拼接基础查询与文件大小过滤条件
  const rawQuery = searchQuery.value.trim()
  if (!rawQuery) return

  let query = rawQuery
  if (options.minSize > 0) {
    query += ` size:>${options.minSize}${options.minSizeUnit.toLowerCase()}`
  }
  if (options.maxSize > 0) {
    query += ` size:<${options.maxSize}${options.maxSizeUnit.toLowerCase()}`
  }

  // 取消之前的防抖定时器
  if (debounceTimer.value) {
    clearTimeout(debounceTimer.value)
    debounceTimer.value = null
  }

  searchState.status = "loading"
  searchState.errorMessage = ""
  searchState.hasSearched = true

  try {
    const results = await searchFiles(
      {
        query,
        matchCase: options.matchCase,
        matchWholeWord: options.matchWholeWord,
        matchPath: options.matchPath,
        regex: options.regex,
        maxResults: options.maxResults,
        sort: options.sort,
        ascending: options.ascending,
      },
      config,
    )

    searchState.results = results
    searchState.status = results.length === 0 ? "empty" : "success"
  } catch (error) {
    // 搜索失败提示："搜索失败"
    searchState.errorMessage = (error as Error).message || i18n.value.searchFailed
    searchState.status = "error"
    searchState.results = []
  }
}

/** 重置搜索状态 */
const resetSearchState = () => {
  searchState.results = []
  searchState.status = "idle"
  searchState.hasSearched = false
  searchState.errorMessage = ""
}

/** 防抖搜索 */
const debouncedSearch = () => {
  if (debounceTimer.value) {
    clearTimeout(debounceTimer.value)
  }

  const query = searchQuery.value.trim()
  if (!query) {
    resetSearchState()
    return
  }

  debounceTimer.value = window.setTimeout(() => {
    handleSearch()
  }, options.debounceDelay)
}

/** 清除搜索 */
const handleClear = () => {
  searchQuery.value = ""
  resetSearchState()
  searchBarRef.value?.focus()
}

/** 关闭弹窗 */
const closeDialog = () => {
  emit("update:visible", false)
}

/** 处理选项更新 */
const handleOptionUpdate = (
  key: keyof SearchOptionsType,
  value: SearchOptionsType[keyof SearchOptionsType],
) => {
  Object.assign(options, { [key]: value })
  // 当前有搜索词时立即重新搜索
  if (searchQuery.value.trim()) {
    handleSearch()
  }
}

/** 处理配置更新 */
const handleConfigUpdate = (
  key: keyof EverythingConfig,
  value: EverythingConfig[keyof EverythingConfig],
) => {
  Object.assign(config, { [key]: value })
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
  options.frequentKeywords.push(keyword)
}

/** 删除常用关键字 */
const handleKeywordDelete = (keyword: string) => {
  const idx = options.frequentKeywords.indexOf(keyword)
  if (idx !== -1) {
    options.frequentKeywords.splice(idx, 1)
  }
}

/** 打开项目 */
const handleItemOpen = async (item: EverythingSearchResult) => {
  try {
    await openFile(getFullPath(item))
  } catch (error) {
    // 错误提示："打开失败"
    showMessage(`${i18n.value.openFailed}: ${(error as Error).message}`, 3000, "error")
  }
}

/** 在文件夹中显示 */
const handleItemShowInFolder = (item: EverythingSearchResult) => {
  try {
    showInExplorer(getFullPath(item))
  } catch (error) {
    // 错误提示："操作失败"
    showMessage(`${i18n.value.operationFailed}: ${(error as Error).message}`, 3000, "error")
  }
}

/** 复制路径 */
const handleItemCopyPath = async (item: EverythingSearchResult) => {
  const ok = await copyToClipboard(getFullPath(item))
  // 提示："路径已复制" / "复制失败"
  showMessage(ok ? i18n.value.pathCopied : i18n.value.copyFailed, 2000, ok ? "info" : "error")
}

/** 删除文件 */
const handleItemDelete = async (item: EverythingSearchResult) => {
  const fullPath = getFullPath(item)
  try {
    await deleteFile(fullPath)
    searchState.results = searchState.results.filter((r) => r !== item)
    if (searchState.results.length === 0) {
      searchState.status = "empty"
    }
    // 提示："文件已移入回收站"
    showMessage(i18n.value.deletedToTrash, 2000, "info")
  } catch (error) {
    // 错误提示："删除失败"
    showMessage(`${i18n.value.deleteFailed}: ${(error as Error).message}`, 3000, "error")
  }
}

/** 键盘事件（仅在弹窗可见时监听） */
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === "Escape") {
    closeDialog()
  }
}

/** 监听 visible 变化 */
watch(
  () => props.visible,
  async (newVal) => {
    if (newVal) {
      document.addEventListener("keydown", handleKeyDown)
      await nextTick()
      await loadConfig()
      searchBarRef.value?.focus()
      checkService()
    } else {
      document.removeEventListener("keydown", handleKeyDown)
    }
  },
)

/** 监听搜索查询变化 */
watch(searchQuery, () => {
  debouncedSearch()
})

/** 监听配置变化 */
watch(
  [config, options],
  () => {
    // 加载配置触发的变更不回写存储（消除"读后即写"）
    if (isLoadingConfig) return
    saveConfigToPlugin().catch((error) => {
      console.error("保存配置时出错:", error)
    })
  },
  { deep: true },
)

onUnmounted(() => {
  if (debounceTimer.value) {
    clearTimeout(debounceTimer.value)
  }
  if (saveConfigTimer.value) {
    clearTimeout(saveConfigTimer.value)
  }
  // 弹窗打开状态下卸载时防止监听器泄漏
  document.removeEventListener("keydown", handleKeyDown)
})

</script>

<style scoped lang="scss">
@use "./styles/index.scss";
</style>
