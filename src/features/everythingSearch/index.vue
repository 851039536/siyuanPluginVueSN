<!-- Everything 搜索主面板：overlay 弹窗 / 独立窗口页签双形态 + 「文件搜索 / 缓存清理」双 Tab -->
<template>
  <Teleport
    to="body"
    :disabled="mode === 'tab'"
  >
    <Transition name="vp-dialog-fade">
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

          <!-- Tab 切换栏（共享 Tabs 五件套；受控 value，非 lazy 以保留两个视图内部状态） -->
          <PanelTabs
            v-model="activeTab"
            :tabs="panelTabs"
            :aria-label="i18n.title"
          />

          <!-- 文件搜索视图 -->
          <template v-if="activeTab === 'search'">
            <SearchBar
              ref="searchBarRef"
              v-model="searchQuery"
              :i18n="i18n"
              :is-searching="searchState.status === 'loading'"
              :can-search="pathFilterActive"
              @search="handleSearch"
              @empty-search="handleEmptySearch"
              @clear="handleClear"
            />

            <SearchOptions
              :options="options"
              :i18n="i18n"
              @update:options="handleOptionUpdate"
            />

            <FrequentKeywords
              :keywords="options.frequentKeywords"
              :i18n="i18n"
              @insert="handleKeywordInsert"
              @add="handleKeywordAdd"
              @delete="handleKeywordDelete"
            />

            <AdvancedHelpPanel
              v-if="options.advancedMode"
              :i18n="i18n"
              @insert="handleSyntaxInsert"
            />

            <ServiceWarning
              v-if="!serviceAvailable"
              :i18n="i18n"
              @retry="checkService"
            />

            <SearchResults
              :state="searchState"
              :i18n="i18n"
              @item-open="handleItemOpen"
              @item-show-in-folder="handleItemShowInFolder"
              @item-copy-path="handleItemCopyPath"
              @item-delete="handleItemDelete"
            />

            <DialogFooter
              :config="config"
              :i18n="i18n"
              @update:config="handleConfigUpdate"
            />
          </template>

          <!-- 缓存清理视图 -->
          <CacheCleanPanel
            v-else
            :i18n="i18n"
            :settings="cacheSettings"
            :update-settings="updateCacheSettings"
            :set-root-enabled="setCacheRootEnabled"
            :history="historyStorage"
          />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import type { PanelTab, PanelTabItem } from "./components/PanelTabs.vue"
import type {
  EverythingConfig,
  SearchOptions as SearchOptionsType,
} from "./types"
import { getFrontend } from "siyuan"
import {
  computed,
  nextTick,
  onUnmounted,
  ref,
  watch,
} from "vue"
import { usePlugin } from "@/main"
import { getCacheCleanHistory } from "./cacheScan/history"
import AdvancedHelpPanel from "./components/AdvancedHelpPanel.vue"
import CacheCleanPanel from "./components/cacheClean/index.vue"
import DialogFooter from "./components/DialogFooter.vue"
import DialogHeader from "./components/DialogHeader.vue"
import FrequentKeywords from "./components/FrequentKeywords.vue"
import PanelTabs from "./components/PanelTabs.vue"
import SearchBar from "./components/SearchBar.vue"
import SearchOptions from "./components/SearchOptions.vue"
import SearchResults from "./components/SearchResults.vue"
import ServiceWarning from "./components/ServiceWarning.vue"
import { useFileSearch } from "./composables/useFileSearch"
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

/** 清理历史共享存储（模块级单例；首次使用缓存清理面板时建库） */
const historyStorage = getCacheCleanHistory(plugin)

// everythingSearch 命名空间的 i18n 文案（传递给各子组件）
const i18n = computed(() => plugin.i18n.everythingSearch as unknown as Record<string, string>)

// 配置持久化（存储加载/防抖保存/选项与配置/常用关键字/缓存清理偏好）
const {
  config,
  options,
  cacheSettings,
  loadConfig,
  updateOption,
  updateConfig,
  updateCacheSettings,
  setCacheRootEnabled,
  addKeyword,
  deleteKeyword,
} = useSearchConfig(plugin)

// 文件搜索编排（防抖 / 竞态守卫 / 空文件夹模式 / 服务探活）
const {
  query: searchQuery,
  state: searchState,
  serviceAvailable,
  pathFilterActive,
  checkService,
  search,
  clear: clearSearch,
  refreshIfActive,
  removeResult,
  dispose: disposeSearch,
} = useFileSearch({
  config,
  options,
  i18n,
})

// 结果操作（打开/资源管理器显示/复制路径/移入回收站；删除成功后同步移出列表）
const {
  handleItemOpen,
  handleItemShowInFolder,
  handleItemCopyPath,
  handleItemDelete: deleteResultItem,
} = useResultActions(i18n, removeResult)

/** 面板 Tab 定义（i18n 文案随语言切换即时更新） */
const panelTabs = computed<PanelTabItem[]>(() => [
  { key: "search", label: i18n.value.tabSearch, icon: "search" },
  { key: "cache", label: i18n.value.tabCache, icon: "databaseRemoveOutline" },
])

/** 当前激活 Tab */
const activeTab = ref<PanelTab>("search")

/** 当前是否运行在独立浮动窗口中（desktop = 主窗口 / desktop-window = 新窗口） */
const isFloating = computed(() => {
  try {
    return getFrontend() === "desktop-window"
  } catch {
    return false
  }
})

/** 打开独立浮动窗口（关闭 overlay 避免双实例） */
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

/** 执行搜索 / 空文件夹搜索 */
const handleSearch = () => {
  void search()
}
const handleEmptySearch = () => {
  void search(true)
}

/** 清除搜索 */
const handleClear = () => {
  clearSearch()
  searchBarRef.value?.focus()
}

/** 删除结果条目（守卫与提示都在 useResultActions 内） */
const handleItemDelete = (item: Parameters<typeof deleteResultItem>[0]) => {
  void deleteResultItem(item)
}

/** 选项更新（按需立即重搜） */
const handleOptionUpdate = (
  key: keyof SearchOptionsType,
  value: SearchOptionsType[keyof SearchOptionsType],
) => {
  updateOption(key, value)
  refreshIfActive()
}

/** 配置更新（host/port 变更后重检服务） */
const handleConfigUpdate = (
  key: keyof EverythingConfig,
  value: EverythingConfig[keyof EverythingConfig],
) => {
  updateConfig(key, value)
  if (key === "host" || key === "port") void checkService()
}

/** 插入高级搜索语法 */
const handleSyntaxInsert = (keyword: string) => {
  searchQuery.value = searchQuery.value ? `${searchQuery.value} ${keyword}` : keyword
  searchBarRef.value?.focus()
}

/** 常用关键字：插入 / 添加 / 删除 */
const handleKeywordInsert = (keyword: string) => {
  searchQuery.value = keyword
  searchBarRef.value?.focus()
}
const handleKeywordAdd = (keyword: string) => addKeyword(keyword)
const handleKeywordDelete = (keyword: string) => deleteKeyword(keyword)

/**
 * 监听 visible 变化（immediate：tab 模式挂载时 visible 恒为 true 不变化，
 * 必须立即触发一次以加载持久化配置，否则常用关键字等保持默认空值）
 */
watch(
  () => props.visible,
  async (newVal) => {
    if (!newVal) return
    await nextTick()
    // 弹窗重新打开时回到文件搜索 Tab
    activeTab.value = "search"
    await loadConfig()
    searchBarRef.value?.focus()
    void checkService()
  },
  { immediate: true },
)

onUnmounted(() => {
  disposeSearch()
})
</script>

<style scoped lang="scss">
@use "./styles/index.scss";
</style>
