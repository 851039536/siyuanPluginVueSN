<!-- 文档分析功能 - Dock 侧边栏主面板，含统计/列表/排版三 Tab -->
<template>
  <div class="doc-analysis-panel">
    <!-- Tab 切换栏 -->
    <div class="tab-bar">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'stats' }"
        @click="activeTab = 'stats'"
      >
        <Icon icon="mdi:chart-bar" />
        统计
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'list' }"
        @click="activeTab = 'list'"
      >
        <Icon icon="mdi:format-list-bulleted" />
        文档列表
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'publish' }"
        @click="activeTab = 'publish'"
      >
        <Icon icon="mdi:brush" />
        排版
      </button>
      <div class="tab-bar-spacer" />
      <!-- 在独立窗口打开（浮动窗口内隐藏；关闭浮动窗口自动移回主窗口） -->
      <button
        v-if="!isFloating"
        class="float-btn"
        :title="i18n.openFloatingWindow"
        @click="openFloatingWindow"
      >
        <Icon
          icon="mdi:open-in-new"
          :size="14"
        />
      </button>
      <button
        class="analyze-btn"
        :disabled="statsLoading"
        @click="handleAnalyze"
      >
        <Icon
          :icon="statsLoading ? 'mdi:loading' : 'mdi:chart-bar'"
          :class="{ 'spin-icon': statsLoading }"
        />
        {{ statsLoading ? '分析中...' : '分析' }}
      </button>
    </div>

    <!-- 过滤设置区 -->
    <FilterSettings
      :options="filterOptions"
      :notebooks="notebooks"
      :is-querying="queryState.status === 'loading'"
      @query="handleQuery"
      @reset="handleReset"
    />

    <!-- 统计面板 -->
    <div
      v-show="activeTab === 'stats'"
      class="tab-panel"
    >
      <StatsOverview
        :stats="docStats"
        :has-analyzed="hasAnalyzed"
        :active-filter="statsFilter"
        :depth-stats="depthStats"
        :effective-duplicate-groups="effectiveDuplicateGroups"
        :duplicate-name-filter="duplicateNameFilter"
        :health-settings="healthSettings"
        @selectCategory="handleSelectCategory"
        @selectBookmark="queryByBookmark"
        @selectPlatform="handleSelectPlatform"
        @selectDepth="handleSelectDepth"
        @update:duplicate-name-filter="(val: string[]) => duplicateNameFilter = val"
        @update:health-settings="handleUpdateHealthSettings"
      />
    </div>

    <!-- 文档列表面板 -->
    <DocListView
      v-show="activeTab === 'list'"
      :query-state="queryState"
      :filter-options="filterOptions"
      :stats-filter="statsFilter"
      :active-platform-filter="activePlatformFilter"
      :active-platform-name="activePlatformName"
      :visible-platforms="visiblePlatforms"
      :platform-unpublished-counts="platformUnpublishedCounts"
      :i18n="i18n"
      @open="openDoc"
      @attrs="handleShowAttrs"
      @sort-change="handleSortChange"
      @toggle-sort-order="toggleSortOrder"
      @clear-stats-filter="clearStatsFilter"
      @select-platform="handlePlatformFilter"
      @open-platform-manage="platformManageVisible = true"
    />

    <!-- 底部信息 -->
    <div class="panel-footer">
      <span class="footer-hint">点击文档可在思源中打开 · 点击发布图标发布文档</span>
      <button
        class="footer-toggle-tip"
        @click="showPublishTip = !showPublishTip"
      >
        {{ showPublishTip ? '收起' : '发布标准' }}
      </button>
    </div>

    <!-- 发布标准提示 -->
    <div
      v-if="showPublishTip"
      class="publish-tip"
    >
      <h4><Icon
        icon="mdi:format-list-bulleted"
        height="14"
      /> 书签 · 发布标准</h4>
      <ul>
        <li>
          <span class="tip-badge pending">待发布</span>
          <span>调整好的文章，等待发布</span>
        </li>
        <li>
          <span class="tip-badge published">已发布</span>
          <span>发布完成后需重新区分书签，如：<code>已发布</code> → <code>C#</code></span>
        </li>
        <li>
          <span class="tip-badge none">无</span>
          <span>无需理会操作</span>
        </li>
        <li>
          <span class="tip-badge none">无</span>
          <span>暂未分类的文档，不计入统计数据</span>
        </li>
        <li>
          <span class="tip-badge category">其他描述</span>
          <span>如 <code>JS</code>、<code>C#</code>、<code>API</code> 等：属于已发布并已完成分类处理</span>
        </li>
      </ul>
    </div>

    <!-- 发布面板 -->
    <div
      v-show="activeTab === 'publish'"
      class="tab-panel publish-tab-panel"
    >
      <PublishPanel
        :plugin="props.plugin"
        :doc-id="publishDocId"
        :i18n="i18n"
      />
    </div>

    <!-- 属性面板 -->
    <AttrsPanel
      :visible="attrsPanelVisible"
      :doc-id="attrsPanelDocId"
      :attrs="attrsData"
      :loading="attrsLoading"
      :error="attrsError"
      :i18n="i18n"
      @close="handleCloseAttrs"
      @refresh="handleRefreshAttrs"
      @publish="handlePublishDoc"
    />

    <!-- 平台管理弹窗 -->
    <PlatformManageModal
      :visible="platformManageVisible"
      :save-platform-meta="savePlatformMeta"
      @close="platformManageVisible = false"
      @saved="onPlatformSaved"
    />
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import {
  getFrontend,
} from "siyuan"
import { Icon } from "@iconify/vue"
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
} from "vue"
import {
  getBlockAttrs,
} from "@/api"
import AttrsPanel from "./components/AttrsPanel/index.vue"
import DocListView from "./components/DocListView/index.vue"
import FilterSettings from "./components/DocListView/FilterSettings.vue"
import PublishPanel from "./components/PublishPanel/index.vue"
import StatsOverview from "./components/StatsView/index.vue"
import PlatformManageModal from "./components/PlatformManage/index.vue"
import { useDocAnalysis } from "./composables/useDocAnalysis"
import { PLATFORM_META } from "./composables/platformMeta"
import type { DocI18n, HealthSettings } from "./types/index"
import { DEFAULT_FILTER_OPTIONS } from "./types/index"

interface Props {
  /** docAnalysis 分片 i18n（index.ts 传入 plugin.i18n.docAnalysis，扁平键值） */
  i18n: DocI18n
  plugin: Plugin
  /** 承载模式：dock = 侧边栏面板；tab = 独立页签/浮动窗口 */
  mode?: "dock" | "tab"
}

const props = withDefaults(defineProps<Props>(), {
  mode: "dock",
})

/** 当前是否运行在独立浮动窗口中（思源 getFrontend()：desktop=主窗口 / desktop-window=新窗口） */
const isFloating = computed(() => {
  try {
    return getFrontend() === "desktop-window"
  } catch {
    return false
  }
})

/** 打开独立浮动窗口：经 __docAnalysis 挂载的 Manager 调度 */
const openFloatingWindow = () => {
  const manager = (props.plugin as any).__docAnalysis as
    | { openFloating: () => void }
    | undefined
  if (!manager) return
  void manager.openFloating()
}

const {
  notebooks,
  queryState,
  filterOptions,
  docStats,
  depthStats,
  statsLoading,
  hasAnalyzed,
  statsFilter,
  effectiveDuplicateGroups,
  duplicateNameFilter,
  healthSettings,
  loadHealthSettings,
  loadNotebooks,
  loadSavedOptions,
  loadDuplicateNameFilter,
  queryDocs,
  analyzeDocStats,
  queryByStatsCategory,
  queryByBookmark,
  queryByMissingPlatform,
  queryByPlatformPublished,
  openDoc,
  updateSort,
  resetQueryState,
  loadPlatformMeta,
  savePlatformMeta,
  platformUnpublishedCounts,
} = useDocAnalysis(props.plugin)

/** 非隐藏平台（过滤栏显示用） */
const visiblePlatforms = computed(() => PLATFORM_META.value.filter((p) => !p.hidden))

const showPublishTip = ref(false)

/** 平台管理弹窗可见性 */
const platformManageVisible = ref(false)

/** 平台配置保存后重新分析 */
function onPlatformSaved() {
  // 平台变更后清空旧分析结果，用户下次点击「分析」时使用新平台列表
  if (hasAnalyzed.value) {
    handleAnalyze()
  }
}

/** 当前选中的平台过滤 */
const activePlatformFilter = ref("")

/** 当前过滤平台的显示名称 */
const activePlatformName = computed(() => {
  const meta = PLATFORM_META.value.find((p) => p.id === activePlatformFilter.value)
  return meta ? meta.name : activePlatformFilter.value
})

/** 切换平台过滤：点击显示该平台未发布的文档（列表 Tab 内调用，无需再切 Tab） */
function handlePlatformFilter(matcher: string) {
  if (activePlatformFilter.value === matcher) {
    activePlatformFilter.value = ""
    // 清除过滤时同步重置列表结果，保持 chip 高亮与列表数据一致
    resetQueryState()
    return
  }
  activePlatformFilter.value = matcher
  queryByMissingPlatform(matcher)
}

// Tab 切换
const activeTab = ref<"stats" | "list" | "publish">("stats")

// 发布面板状态
const publishDocId = ref<string | undefined>(undefined)

function handlePublishDoc(docId: string) {
  publishDocId.value = docId
  activeTab.value = "publish"
  // 关闭属性弹窗，避免全屏遮罩盖住发布面板
  attrsPanelVisible.value = false
}

// 属性面板状态
const attrsPanelVisible = ref(false)
const attrsPanelDocId = ref("")
const attrsData = ref<Record<string, string> | null>(null)
const attrsLoading = ref(false)
const attrsError = ref("")

/** 属性加载令牌：使在途旧请求失效，避免快速切换文档时旧结果覆盖新结果 */
let attrsToken = 0

/** 加载指定文档的属性 */
async function loadAttrs(docId: string) {
  const token = ++attrsToken
  attrsData.value = null
  attrsError.value = ""
  attrsLoading.value = true
  try {
    const data = await getBlockAttrs(docId)
    if (token !== attrsToken) return
    attrsData.value = data
  }
  catch (e: unknown) {
    if (token !== attrsToken) return
    attrsError.value = e instanceof Error ? e.message : "加载属性失败"
  }
  finally {
    if (token === attrsToken) attrsLoading.value = false
  }
}

function handleShowAttrs(docId: string) {
  attrsPanelDocId.value = docId
  attrsPanelVisible.value = true
  loadAttrs(docId)
}

function handleCloseAttrs() {
  attrsPanelVisible.value = false
  attrsData.value = null
  attrsError.value = ""
}

function handleRefreshAttrs() {
  loadAttrs(attrsPanelDocId.value)
}

onBeforeUnmount(() => {
  // 使在途属性加载失效，避免组件销毁后写响应式状态
  attrsToken++
})

/** 执行查询 */
function handleQuery() {
  statsFilter.value = ""
  queryDocs()
  activeTab.value = "list"
}

/** 执行分析 */
function handleAnalyze() {
  analyzeDocStats()
  activeTab.value = "stats"
}

/** 点击统计卡片 */
function handleSelectCategory(category: string) {
  queryByStatsCategory(category)
  activeTab.value = "list"
}

/** 点击深度柱状图 */
function handleSelectDepth(depth: number) {
  queryByStatsCategory(`depth_${depth}`)
  activeTab.value = "list"
}

/** 点击发布状态分区的平台分布行：查询已发布到该平台的文档 */
function handleSelectPlatform(platformId: string) {
  queryByPlatformPublished(platformId)
  activeTab.value = "list"
}

/** 清除统计过滤 */
function clearStatsFilter() {
  statsFilter.value = ""
  duplicateNameFilter.value = []
  resetQueryState()
}

/** 更新健康度扣分项配置（useDocAnalysis 内 watch 自动持久化） */
function handleUpdateHealthSettings(settings: HealthSettings) {
  healthSettings.value = settings
}

/** 一键清空所有过滤条件 */
function handleReset() {
  Object.assign(filterOptions, DEFAULT_FILTER_OPTIONS)
  statsFilter.value = ""
  duplicateNameFilter.value = []
  activePlatformFilter.value = ""
  resetQueryState()
}

/** 排序字段变更（来自 DocListView 转发） */
function handleSortChange(field: string) {
  updateSort(field, filterOptions.sortOrder)
}

/** 切换排序方向 */
function toggleSortOrder() {
  const newOrder = filterOptions.sortOrder === "asc" ? "desc" : "asc"
  updateSort(filterOptions.sortField, newOrder)
}

onMounted(async () => {
  await loadPlatformMeta()
  await loadNotebooks()
  await loadSavedOptions()
  await loadDuplicateNameFilter()
  await loadHealthSettings()
})
</script>

<style lang="scss" scoped>
@use "./styles/index.scss";
</style>
