<!-- 文档列表视图 - 平台快捷过滤栏 + 排序/结果计数 + 列表渲染 + 分批滚动加载 -->
<template>
  <div class="tab-panel doc-list-panel">
    <!-- 平台快捷过滤栏：查看已发布其他平台、但未发布至所选平台的文档 -->
    <div class="platform-filter-bar">
      <span class="platform-filter-label">平台过滤</span>
      <button
        v-for="platform in visiblePlatforms"
        :key="platform.id"
        class="platform-chip"
        :class="{ active: activePlatformFilter === platform.id }"
        :title="`查看未发布至${platform.name}的文档`"
        @click="$emit('selectPlatform', platform.id)"
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
        @click="$emit('selectPlatform', activePlatformFilter)"
      >
        <Icon icon="mdi:close" />
      </button>
    </div>
    <!-- 平台过滤提示（激活时显示，说明当前列表筛选语义） -->
    <div
      v-if="activePlatformFilter"
      class="platform-filter-hint"
    >
      <Icon icon="mdi:information-outline" />
      <span>已发布其他平台 · 待发布至<strong>{{ activePlatformName }}</strong></span>
    </div>

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
              @click="$emit('clearStatsFilter')"
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
          <option
            v-for="opt in SORT_FIELD_OPTIONS"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </option>
        </select>
        <button
          class="sort-order-btn"
          @click="$emit('toggleSortOrder')"
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
          v-memo="[doc.id, doc.title, doc.wordCount, doc.contentSize, doc.updated, doc.depth, doc.refCount, doc.imageCount, doc.bookmark, doc.notebookName, doc.hpath, doc.unpublishedPlatforms]"
          :doc="doc"
          :i18n="i18n"
          @open="$emit('open', $event)"
          @attrs="$emit('attrs', $event)"
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
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
import { computed, onBeforeUnmount, ref, watch } from "vue"
import type { DocI18n, FilterOptions, PlatformMeta, QueryState } from "../../types/index"
import { SORT_FIELD_OPTIONS, getCategoryLabel } from "../../types/index"
import DocListItem from "./DocListItem.vue"

interface Props {
  queryState: QueryState
  filterOptions: FilterOptions
  statsFilter: string
  /** 平台过滤（空串表示未过滤），用于空态差异化文案 */
  activePlatformFilter: string
  /** 当前过滤平台的显示名称 */
  activePlatformName: string
  /** 可见平台列表（过滤栏 chips，不含隐藏平台） */
  visiblePlatforms: Pick<PlatformMeta, "id" | "name">[]
  /** 各平台待补发文档数（过滤栏 badge） */
  platformUnpublishedCounts: Record<string, number>
  i18n: DocI18n
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: "open", docId: string): void
  (e: "attrs", docId: string): void
  (e: "sortChange", field: string): void
  (e: "toggleSortOrder"): void
  (e: "clearStatsFilter"): void
  (e: "selectPlatform", platformId: string): void
}>()

// 分批渲染：避免一次渲染上千个 DocListItem 导致卡顿
const PAGE_SIZE = 50
const visibleCount = ref(PAGE_SIZE)
const isLoadingMore = ref(false)
const sentinelRef = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

const visibleDocs = computed(() => props.queryState.results.slice(0, visibleCount.value))
const hasMoreDocs = computed(() => visibleCount.value < props.queryState.results.length)

function loadMore() {
  if (hasMoreDocs.value && !isLoadingMore.value) {
    isLoadingMore.value = true
    // 用 requestAnimationFrame 避免阻塞主线程
    requestAnimationFrame(() => {
      visibleCount.value = Math.min(visibleCount.value + PAGE_SIZE, props.queryState.results.length)
      isLoadingMore.value = false
    })
  }
}

// 当查询结果变化时重置可见数量
watch(() => props.queryState.results, () => {
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

// 哨兵元素挂载后启动观察；元素被移除时断开旧 observer，避免面板存活期内累积失效实例
watch(sentinelRef, (el) => {
  if (el) {
    setupObserver()
  } else if (observer) {
    observer.disconnect()
    observer = null
  }
})

onBeforeUnmount(() => {
  if (observer) {
    observer.disconnect()
    observer = null
  }
})

/** 排序字段变更（转发给父层 updateSort） */
function handleSortChange(event: Event) {
  const target = event.target as HTMLSelectElement
  emit("sortChange", target.value)
}
</script>

<style lang="scss" scoped>
@use "../../styles/DocListView.scss";
@use "../../styles/index.scss";
</style>
