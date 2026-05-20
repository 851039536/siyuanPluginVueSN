<template>
  <div class="doc-analysis-panel">
    <!-- 过滤设置区 -->
    <FilterSettings
      :options="filterOptions"
      :notebooks="notebooks"
      :is-querying="queryState.status === 'loading'"
      @query="handleQuery"
      @update:options="handleOptionsUpdate"
    />

    <!-- 统计概览区 -->
    <StatsOverview
      :stats="docStats"
      :loading="statsLoading"
      :has-analyzed="hasAnalyzed"
      :active-filter="statsFilter"
      :depth-stats="depthStats"
      @analyze="handleAnalyze"
      @select-category="handleSelectCategory"
      @batch-publish="handleBatchPublish"
    />

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
        <!-- 批量操作按钮 -->
        <button
          class="batch-publish-btn"
          title="批量发布当前结果"
          @click="handleBatchPublishAll"
        >
          <Icon icon="mdi:publish" />
        </button>
        <button
          class="batch-mark-btn"
          title="批量标记为待发布"
          @click="handleBatchMarkPending"
        >
          <Icon icon="mdi:bookmark-plus-outline" />
        </button>
      </div>
    </div>

    <!-- 文档列表区 -->
    <div class="doc-list-container">
      <!-- 加载中 -->
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

      <!-- 空状态 - 未查询 -->
      <div
        v-else-if="queryState.status === 'idle' && !queryState.hasQueried"
        class="empty-state"
      >
        <Icon
          icon="mdi:file-document-multiple-outline"
          class="empty-icon"
        />
        <p>点击上方「分析」查看统计，或设置筛选条件后查询</p>
        <p class="empty-desc">
          支持标题搜索、全文搜索、字数范围筛选、书签过滤、多平台发布
        </p>
      </div>

      <!-- 查询结果 -->
      <template v-else-if="queryState.results.length > 0">
        <DocListItem
          v-for="doc in visibleDocs"
          :key="doc.id"
          v-memo="[doc.id, doc.title, doc.wordCount, doc.contentSize, doc.updated, doc.depth, doc.refCount, doc.imageCount, doc.bookmark, doc.publishStatus]"
          :doc="doc"
          @open="openDoc"
          @publish="handlePublishDoc"
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

      <!-- 无结果 -->
      <div
        v-else-if="queryState.status === 'empty'"
        class="empty-state"
      >
        <Icon
          icon="mdi:file-check-outline"
          class="empty-icon"
        />
        <p>没有找到符合条件的文档</p>
        <p class="empty-desc">
          尝试调整搜索条件或选择其他笔记本
        </p>
      </div>

      <!-- 错误状态 -->
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
      <h4>📋 书签 · 发布标准</h4>
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
          <span class="tip-badge category">其他描述</span>
          <span>如 <code>JS</code>、<code>C#</code>、<code>API</code> 等：属于已发布并已完成分类处理</span>
        </li>
      </ul>
    </div>

    <!-- 发布面板 -->
    <PublishPanel
      :visible="publishPanelVisible"
      :doc-id="publishDocId"
      :doc-title="publishDocTitle"
      :plugin="plugin"
      @close="publishPanelVisible = false"
      @published="handlePublished"
    />
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue"
import DocListItem from "./components/DocListItem.vue"
import FilterSettings from "./components/FilterSettings.vue"
import PublishPanel from "./components/PublishPanel.vue"
import StatsOverview from "./components/StatsOverview.vue"
import { useDocAnalysis } from "./composables/useDocAnalysis"
import { usePublish } from "./composables/usePublish"

import type { FilterOptions } from "./types/index"
import type { Plugin } from "siyuan"

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
  loadNotebooks,
  loadSavedOptions,
  queryDocs,
  analyzeDocStats,
  queryByStatsCategory,
  openDoc,
  updateSort,
  clearResults,
} = useDocAnalysis(props.plugin)

const { markAsPending } = usePublish(props.plugin)

const showPublishTip = ref(false)

// ============================================================
// 发布面板状态
// ============================================================
const publishPanelVisible = ref(false)
const publishDocId = ref("")
const publishDocTitle = ref("")

/** 打开单个文档发布面板 */
function handlePublishDoc(docId: string, docTitle: string) {
  publishDocId.value = docId
  publishDocTitle.value = docTitle
  publishPanelVisible.value = true
}

/** 发布完成回调 */
function handlePublished() {
  // 刷新列表以更新发布状态
  if (queryState.hasQueried) {
    queryDocs()
  }
}

/** 批量发布 - 按统计类别 */
async function handleBatchPublish(category: string) {
  // 先查询该类别的文档
  await queryByStatsCategory(category)

  if (queryState.results.length === 0) {
    return
  }

  // 打开批量发布面板（取第一个文档作为示例）
  if (queryState.results.length > 0) {
    publishDocId.value = queryState.results[0].id
    publishDocTitle.value = `批量发布 (${queryState.results.length} 篇)`
    publishPanelVisible.value = true
  }
}

/** 批量发布全部当前结果 */
function handleBatchPublishAll() {
  if (queryState.results.length === 0) return
  publishDocId.value = queryState.results[0].id
  publishDocTitle.value = `批量发布当前结果 (${queryState.results.length} 篇)`
  publishPanelVisible.value = true
}

/** 批量标记为待发布 */
async function handleBatchMarkPending() {
  if (queryState.results.length === 0) return
  const docIds = queryState.results.map(d => d.id)
  await markAsPending(docIds)
  // 刷新列表
  if (queryState.hasQueried) {
    queryDocs()
  }
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
  // 延迟观察，等 DOM 更新
  requestAnimationFrame(() => {
    if (sentinelRef.value && observer) {
      observer.observe(sentinelRef.value)
    }
  })
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
}

/** 执行分析 */
function handleAnalyze() {
  analyzeDocStats()
}

/** 点击统计卡片 */
function handleSelectCategory(category: string) {
  queryByStatsCategory(category)
}

/** 获取分类标签 */
function getCategoryLabel(category: string): string {
  switch (category) {
    case "0B": return "0B 空文档"
    case "small": return "< 1KB"
    case "medium": return "1~10KB"
    case "duplicate": return "重名文档"
    case "7days": return "7天内更新"
    case "30days": return "7~30天更新"
    case "1to2month": return "1~2月更新"
    case "2to3month": return "2~3月更新"
    case "halfYear": return "半年以上未更新"
    case "customTime": return "自定义时间"
    case "deep": return "深层文档(≥5层)"
    case "hasRef": return "含引用"
    case "hasImage": return "含图片"
    case "hasBookmark": return "有书签"
    case "noBookmark": return "无书签"
    case "pendingPublish": return "待发布"
    case "published": return "已发布"
    case "unused": return "不使用"
    default: return category
  }
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
  await loadNotebooks()
  await loadSavedOptions()
})
</script>

<style lang="scss" scoped>
@use "./styles/index.scss";
</style>
