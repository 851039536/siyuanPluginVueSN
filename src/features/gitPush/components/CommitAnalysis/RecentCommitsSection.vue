<!-- gitPush 提交分析最近提交记录区块（条目列表 + 加载更多，含项目跳转） -->
<template>
  <div class="gpa-section gpa-section--scroll">
    <div class="gpa-section-title">
      <!-- 区块标题："最近提交记录" + 条数徽章 -->
      {{ i18n.analysisRecentCommits }}
      <span class="gpa-section-count">{{ stats.entries.length }}</span>
    </div>
    <div class="gpa-commit-list">
      <div
        v-for="c in pagedEntries"
        :key="`${c.projectId}-${c.hash}`"
        class="gpa-commit-item"
      >
        <span
          class="gpa-commit-hash"
          :title="c.hash"
        >{{ c.hash }}</span>
        <span
          class="gpa-commit-msg"
          :title="c.message"
        >{{ c.message }}</span>
        <span class="gpa-commit-meta">
          <!-- 项目名（可点击跳转列表视图） -->
          <span
            class="gpa-commit-project"
            :title="c.projectName"
            @click.stop="emit('viewProject', c.projectId)"
          >{{ c.projectName }}</span>
          <span class="gpa-commit-author">{{ c.author }}</span>
          <span
            class="gpa-commit-date"
            :title="c.date"
          >{{ relativeTime(c.date, i18n) }}</span>
        </span>
      </div>
    </div>
    <!-- 加载更多 -->
    <LoadMoreButton
      v-if="hasMore"
      :i18n="i18n"
      :visible="visibleCount"
      :total="sortedEntries.length"
      @load-more="loadMore"
    />
  </div>
</template>

<script setup lang="ts">
// gitPush 提交分析最近提交记录区块（跨项目合并条目 + 本地分页 + 加载更多）
import type { CommitAnalysisStats } from "../../types"
import { computed } from "vue"
import { relativeTime } from "../../utils"
import { usePagedList } from "../../composables/usePagedList"
import LoadMoreButton from "../common/LoadMoreButton.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 提交分析聚合视图（取 entries） */
  stats: CommitAnalysisStats
}>()

const emit = defineEmits<{
  viewProject: [projectId: string]
}>()

/** 跨项目合并、按日期降序的提交流 */
const sortedEntries = computed(() =>
  [...props.stats.entries].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)),
)

/** 本地分页（usePagedList 消除与 LogPanel 的 visibleCount/slice/loadMore 重复） */
const {
  visibleCount,
  paged: pagedEntries,
  hasMore,
  loadMore,
} = usePagedList(sortedEntries, 50)
</script>

<style lang="scss">
@use "../../styles/CommitAnalysisPanel.scss";
@use "../../styles/index.scss";
</style>
