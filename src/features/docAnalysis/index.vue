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
      <div class="tab-bar-spacer" />
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
      @optionsUpdate="handleOptionsUpdate"
      @reset="handleReset"
    />

    <!-- 平台快捷过滤栏 -->
    <div class="platform-filter-bar">
      <span class="platform-filter-label">平台过滤</span>
      <button
        v-for="platform in visiblePlatforms"
        :key="platform.id"
        class="platform-chip"
        :class="{ active: activePlatformFilter === platform.id }"
        @click="handlePlatformFilter(platform.id)"
      >
        {{ platform.name }}
        <span
          v-if="platformUnpublishedCounts[platform.id]"
          class="platform-chip-badge"
        >{{ platformUnpublishedCounts[platform.id] }}</span>
      </button>
      <button
        v-if="activePlatformFilter"
        class="platform-chip-clear"
        title="清除平台过滤"
        @click="handlePlatformFilter(activePlatformFilter)"
      >
        <Icon icon="mdi:close" />
      </button>
      <button
        class="platform-manage-btn"
        title="管理平台"
        @click="platformManageVisible = true"
      >
        <Icon icon="mdi:cog-outline" />
      </button>
    </div>
    <div
      v-if="activePlatformFilter"
      class="platform-filter-hint"
    >
      <Icon icon="mdi:information-outline" />
      <span>显示已发布到其他平台、但还没发布到<strong>{{ activePlatformName }}</strong>的文档</span>
    </div>

    <!-- 统计面板 -->
    <div
      v-show="activeTab === 'stats'"
      class="tab-panel"
    >
      <StatsOverview
        :stats="docStats"
        :loading="statsLoading"
        :has-analyzed="hasAnalyzed"
        :active-filter="statsFilter"
        :depth-stats="depthStats"
        :bookmark-details="bookmarkDetails"
        :bookmark-detail-visible="bookmarkDetailVisible"
        :bookmark-detail-loading="bookmarkDetailLoading"
        :collapsible="false"
        @selectCategory="handleSelectCategory"
        @showBookmarkDetails="fetchBookmarkDetails"
        @selectBookmark="queryByBookmark"
        @selectDepth="handleSelectDepth"
      />
    </div>

    <!-- 文档列表面板 -->
    <div
      v-show="activeTab === 'list'"
      class="tab-panel doc-list-panel"
    >
      <!-- 排序和结果数 -->
      <div
        v-if="queryState.hasQueried"
        class="result-bar"
      >
        <div class="result-count">
          <span v-if="queryState.status === 'success'">
            共找到 <strong>{{ queryState.results.length }}</strong> 个文档
            <span
              v-if="statsFilter"
              class="filter-tag"
            >
              ({{ getCategoryLabel(statsFilter) }})
              <button
                class="filter-tag-close"
                @click="clearStatsFilter"
              >&times;</button>
            </span>
          </span>
          <span
            v-else-if="queryState.status === 'empty'"
            class="empty-hint"
          >
            未找到符合条件的文档
          </span>
          <span
            v-else-if="queryState.status === 'error'"
            class="error-hint"
          >
            {{ queryState.errorMessage }}
          </span>
        </div>
        <div
          v-if="queryState.results.length > 0"
          class="sort-controls"
        >
          <select
            :value="filterOptions.sortField"
            class="sort-select"
            @change="handleSortChange"
          >
            <option value="wordCount">
              按字数
            </option>
            <option value="title">
              按标题
            </option>
            <option value="notebook">
              按笔记本
            </option>
            <option value="updated">
              按更新时间
            </option>
            <option value="depth">
              按深度
            </option>
            <option value="refCount">
              按引用数
            </option>
            <option value="imageCount">
              按图片数
            </option>
            <option value="bookmark">
              按书签
            </option>
          </select>
          <button
            class="sort-order-btn"
            @click="toggleSortOrder"
          >
            <Icon :icon="filterOptions.sortOrder === 'asc' ? 'mdi:sort-ascending' : 'mdi:sort-descending'" />
          </button>
        </div>
      </div>

      <!-- 文档列表 -->
      <div class="doc-list-container">
        <div
          v-if="queryState.status === 'loading'"
          class="loading-state"
        >
          <Icon
            icon="mdi:loading"
            class="loading-icon"
          />
          <span>正在查询文档...</span>
        </div>

        <div
          v-else-if="queryState.status === 'idle' && !queryState.hasQueried"
          class="empty-state"
        >
          <Icon
            icon="mdi:file-document-multiple-outline"
            class="empty-icon"
          />
          <p>设置筛选条件后点击查询，或从统计面板点击卡片查看</p>
          <p class="empty-desc">
            支持标题搜索、全文搜索、字数范围筛选、书签过滤、多平台发布
          </p>
        </div>

        <template v-else-if="queryState.results.length > 0">
          <DocListItem
            v-for="doc in visibleDocs"
            :key="doc.id"
            v-memo="[doc.id, doc.title, doc.wordCount, doc.contentSize, doc.updated, doc.depth, doc.refCount, doc.imageCount, doc.bookmark]"
            :doc="doc"
            @open="openDoc"
            @attrs="handleShowAttrs"
          />
          <div
            v-if="hasMoreDocs"
            ref="sentinelRef"
            class="load-more-sentinel"
          >
            <Icon
              v-if="isLoadingMore"
              icon="mdi:loading"
              class="loading-icon"
            />
            <span
              v-else
              class="load-more-text"
            >滚动加载更多 ({{ visibleCount }}/{{ queryState.results.length }})</span>
          </div>
        </template>

        <div
          v-else-if="queryState.status === 'empty'"
          class="empty-state"
          :class="{ 'empty-state--done': activePlatformFilter }"
        >
          <Icon
            icon="mdi:file-check-outline"
            class="empty-icon"
          />
          <p v-if="activePlatformFilter">
            {{ activePlatformName }} 已全部发布
          </p>
          <p v-else>
            没有找到符合条件的文档
          </p>
          <p class="empty-desc">
            尝试调整搜索条件或选择其他笔记本
          </p>
        </div>

        <div
          v-else-if="queryState.status === 'error'"
          class="empty-state"
        >
          <Icon
            icon="mdi:alert-circle-outline"
            class="empty-icon error"
          />
          <p>查询出错</p>
          <p class="empty-desc">
            {{ queryState.errorMessage }}
          </p>
        </div>
      </div>
    </div>

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
          <span class="tip-badge unused">不使用</span>
          <span>废弃文档（归档）</span>
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

    <!-- 属性面板 -->
    <AttrsPanel
      :visible="attrsPanelVisible"
      :doc-id="attrsPanelDocId"
      :attrs="attrsData"
      :loading="attrsLoading"
      :error="attrsError"
      @close="handleCloseAttrs"
      @refresh="handleRefreshAttrs"
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
import type { FilterOptions } from "./types/index"
import { Icon } from "@iconify/vue"
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue"
import {
  getBlockAttrs,
} from "@/api"
import AttrsPanel from "./components/AttrsPanel.vue"
import DocListItem from "./components/DocListItem.vue"
import FilterSettings from "./components/FilterSettings.vue"

import StatsOverview from "./components/StatsOverview.vue"
import PlatformManageModal from "./components/PlatformManageModal.vue"
import {
  PLATFORM_META,
  useDocAnalysis,
} from "./composables/useDocAnalysis"
import { getCategoryLabel } from "./types/index"
import { DEFAULT_FILTER_OPTIONS } from "./types/storage"

interface Props {
  i18n: Record<string, Record<string, string>>
  plugin: Plugin
}

const props = defineProps<Props>()

const {
  notebooks,
  queryState,
  filterOptions,
  docStats,
  depthStats,
  statsLoading,
  hasAnalyzed,
  statsFilter,
  bookmarkDetails,
  bookmarkDetailVisible,
  bookmarkDetailLoading,
  loadNotebooks,
  loadSavedOptions,
  queryDocs,
  analyzeDocStats,
  queryByStatsCategory,
  fetchBookmarkDetails,
  queryByBookmark,
  queryByMissingPlatform,
  openDoc,
  updateSort,
  clearResults,
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

/** 切换平台过滤：点击显示该平台未发布的文档 */
function handlePlatformFilter(matcher: string) {
  if (activePlatformFilter.value === matcher) {
    activePlatformFilter.value = ""
    return
  }
  activePlatformFilter.value = matcher
  queryByMissingPlatform(matcher)
  activeTab.value = "list"
}

// ============================================================
// Tab 切换
// ============================================================
const activeTab = ref<"stats" | "list">("stats")

// ============================================================
// 属性面板状态
// ============================================================
const attrsPanelVisible = ref(false)
const attrsPanelDocId = ref("")
const attrsData = ref<Record<string, string> | null>(null)
const attrsLoading = ref(false)
const attrsError = ref("")

/** 加载指定文档的属性 */
async function loadAttrs(docId: string) {
  attrsData.value = null
  attrsError.value = ""
  attrsLoading.value = true
  try {
    attrsData.value = await getBlockAttrs(docId)
  }
  catch (e: unknown) {
    attrsError.value = e instanceof Error ? e.message : "加载属性失败"
  }
  finally {
    attrsLoading.value = false
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

// ============================================================
// 分批渲染：避免一次渲染上千个 DocListItem 导致卡顿
// ============================================================
const PAGE_SIZE = 50
const visibleCount = ref(PAGE_SIZE)
const isLoadingMore = ref(false)
const sentinelRef = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

const visibleDocs = computed(() => queryState.results.slice(0, visibleCount.value))
const hasMoreDocs = computed(() => visibleCount.value < queryState.results.length)

function loadMore() {
  if (hasMoreDocs.value && !isLoadingMore.value) {
    isLoadingMore.value = true
    // 用 requestAnimationFrame 避免阻塞主线程
    requestAnimationFrame(() => {
      visibleCount.value = Math.min(visibleCount.value + PAGE_SIZE, queryState.results.length)
      isLoadingMore.value = false
    })
  }
}

// 当查询结果变化时重置可见数量
watch(() => queryState.results, () => {
  visibleCount.value = PAGE_SIZE
})

function setupObserver() {
  if (observer) observer.disconnect()
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        loadMore()
      }
    },
    { rootMargin: "200px" },
  )
  // Vue watch 触发时 DOM 已更新，直接观察
  if (sentinelRef.value) {
    observer.observe(sentinelRef.value)
  }
}

// 哨兵元素挂载后启动观察
watch(sentinelRef, (el) => {
  if (el) setupObserver()
})

onBeforeUnmount(() => {
  if (observer) {
    observer.disconnect()
    observer = null
  }
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

/** 清除统计过滤 */
function clearStatsFilter() {
  statsFilter.value = ""
  queryState.hasQueried = false
  clearResults()
  queryState.status = "idle"
}

/** 更新过滤选项 */
function handleOptionsUpdate(newOptions: Partial<FilterOptions>) {
  Object.assign(filterOptions, newOptions)
}

/** 一键清空所有过滤条件 */
function handleReset() {
  Object.assign(filterOptions, DEFAULT_FILTER_OPTIONS)
  statsFilter.value = ""
  clearResults()
  queryState.status = "idle"
  queryState.hasQueried = false
}

/** 排序字段变更 */
function handleSortChange(event: Event) {
  const target = event.target as HTMLSelectElement
  updateSort(target.value, filterOptions.sortOrder)
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
})
</script>

<style lang="scss" scoped>
@use "./styles/index.scss";
</style>
