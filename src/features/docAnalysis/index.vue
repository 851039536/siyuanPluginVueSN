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
      @analyze="handleAnalyze"
      @select-category="handleSelectCategory"
    />

    <!-- 排序和结果数 -->
    <div class="result-bar" v-if="queryState.hasQueried">
      <div class="result-count">
        <span v-if="queryState.status === 'success'">
          共找到 <strong>{{ queryState.results.length }}</strong> 个文档
          <span v-if="statsFilter" class="filter-tag">
            ({{ getCategoryLabel(statsFilter) }})
            <button class="filter-tag-close" @click="clearStatsFilter">&times;</button>
          </span>
        </span>
        <span v-else-if="queryState.status === 'empty'" class="empty-hint">
          未找到符合条件的文档
        </span>
        <span v-else-if="queryState.status === 'error'" class="error-hint">
          {{ queryState.errorMessage }}
        </span>
      </div>
      <div class="sort-controls" v-if="queryState.results.length > 0">
        <select
          :value="filterOptions.sortField"
          class="sort-select"
          @change="handleSortChange"
        >
          <option value="size">按大小</option>
          <option value="title">按标题</option>
          <option value="notebook">按笔记本</option>
        </select>
        <button class="sort-order-btn" @click="toggleSortOrder">
          <Icon :icon="filterOptions.sortOrder === 'asc' ? 'mdi:sort-ascending' : 'mdi:sort-descending'" />
        </button>
      </div>
    </div>

    <!-- 文档列表区 -->
    <div class="doc-list-container">
      <!-- 加载中 -->
      <div v-if="queryState.status === 'loading'" class="loading-state">
        <Icon icon="mdi:loading" class="loading-icon" />
        <span>正在查询文档...</span>
      </div>

      <!-- 空状态 - 未查询 -->
      <div v-else-if="queryState.status === 'idle' && !queryState.hasQueried" class="empty-state">
        <Icon icon="mdi:file-document-multiple-outline" class="empty-icon" />
        <p>点击上方「分析」查看统计，或设置筛选条件后查询</p>
        <p class="empty-desc">查找内容量小于指定阈值的小文档</p>
      </div>

      <!-- 查询结果 -->
      <template v-else-if="queryState.results.length > 0">
        <DocListItem
          v-for="doc in queryState.results"
          :key="doc.id"
          :doc="doc"
          @open="openDoc"
        />
      </template>

      <!-- 无结果 -->
      <div v-else-if="queryState.status === 'empty'" class="empty-state">
        <Icon icon="mdi:file-check-outline" class="empty-icon" />
        <p>没有找到符合条件的文档</p>
        <p class="empty-desc">尝试调整阈值或选择其他笔记本</p>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="queryState.status === 'error'" class="empty-state">
        <Icon icon="mdi:alert-circle-outline" class="empty-icon error" />
        <p>查询出错</p>
        <p class="empty-desc">{{ queryState.errorMessage }}</p>
      </div>
    </div>

    <!-- 底部信息 -->
    <div class="panel-footer">
      <span class="footer-hint">点击文档可在思源中打开</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { Icon } from "@iconify/vue";
import FilterSettings from "./components/FilterSettings.vue";
import DocListItem from "./components/DocListItem.vue";
import StatsOverview from "./components/StatsOverview.vue";
import { useDocAnalysis } from "./composables/useDocAnalysis";
import type { DocAnalysisStorage as DocAnalysisStorageType } from "./types/storage";

interface Props {
  i18n: any;
  plugin: any;
  storage: DocAnalysisStorageType;
}

const props = defineProps<Props>();

const {
  notebooks,
  queryState,
  filterOptions,
  docStats,
  statsLoading,
  hasAnalyzed,
  statsFilter,
  loadNotebooks,
  loadSavedOptions,
  querySmallDocs,
  analyzeDocStats,
  queryByStatsCategory,
  openDoc,
  updateSort,
} = useDocAnalysis(props.plugin);

/** 执行查询 */
function handleQuery() {
  statsFilter.value = "";
  querySmallDocs();
}

/** 执行分析 */
function handleAnalyze() {
  analyzeDocStats();
}

/** 点击统计卡片 */
function handleSelectCategory(category: string) {
  queryByStatsCategory(category);
}

/** 获取分类标签 */
function getCategoryLabel(category: string): string {
  switch (category) {
    case "0B": return "0B 空文档";
    case "small": return "< 1KB";
    case "medium": return "1~10KB";
    default: return category;
  }
}

/** 清除统计过滤 */
function clearStatsFilter() {
  statsFilter.value = "";
  queryState.hasQueried = false;
  queryState.results = [];
  queryState.status = "idle";
}

/** 更新过滤选项 */
function handleOptionsUpdate(newOptions: any) {
  Object.assign(filterOptions, newOptions);
}

/** 排序字段变更 */
function handleSortChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  updateSort(target.value, filterOptions.sortOrder);
}

/** 切换排序方向 */
function toggleSortOrder() {
  const newOrder = filterOptions.sortOrder === "asc" ? "desc" : "asc";
  updateSort(filterOptions.sortField, newOrder);
}

onMounted(async () => {
  await loadNotebooks();
  await loadSavedOptions();
});
</script>

<style lang="scss" scoped>
@use "./styles/index.scss";
</style>
