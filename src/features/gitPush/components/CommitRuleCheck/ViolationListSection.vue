<!-- gitPush 提交规则检查不合规提交列表区块（条目 + 修正入口 + 分页加载） -->
<template>
  <div class="grc-section">
    <!-- 区块标题："不合规提交列表" + 条数徽章 -->
    <div class="grc-section-title">
      {{ i18n.ruleCheckTitle }}
      <span class="grc-section-count">{{ stats.violationCount }}</span>
    </div>
    <div class="grc-list">
      <div
        v-for="row in pagedViolations"
        :key="`${row.projectId}-${row.hash}-${row.reason}`"
        class="grc-item"
      >
        <div class="grc-item-head">
          <span
            v-if="!scoped"
            class="grc-item-project"
            :title="row.projectName"
            @click.stop="emit('viewProject', row.projectId)"
          >{{ row.projectName }}</span>
          <span class="grc-item-hash">{{ row.hash }}</span>
          <span class="grc-item-reason">{{ i18n[COMMIT_RULE_REASON_META[row.reason].labelKey] }}</span>
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm grc-item-fix"
            :title="i18n.ruleFixOpen"
            @click.stop="emit('openFix', row)"
          >
            <Icon icon="mdi:pencil-outline" height="12" />
          </button>
          <span class="grc-item-date">{{ relativeTime(row.date, i18n) }}</span>
        </div>
        <div
          class="grc-item-msg"
          :title="row.message"
        >{{ row.message }}</div>
        <div class="grc-item-meta">
          <span>{{ row.author }}</span>
          <!-- 提交时间："YYYY-MM-DD HH:mm"（title 保留 ISO 原值） -->
          <span :title="row.date">{{ formatDateTime(row.date) }}</span>
        </div>
      </div>
    </div>
    <!-- 加载更多 -->
    <LoadMoreButton
      v-if="pagedHasMore"
      :i18n="i18n"
      :visible="pagedVisibleCount"
      :total="pagedSource.length"
      @load-more="pagedLoadMore"
    />
  </div>
</template>

<script setup lang="ts">
// gitPush 提交规则检查不合规提交列表区块（本地分页 + 修正入口）
import type { CommitRuleCheckStats, CommitRuleViolation } from "../../types"
import { Icon } from "@iconify/vue"
import { computed } from "vue"
import { COMMIT_RULE_REASON_META } from "../../types"
import { formatDateTime, relativeTime } from "../../utils"
import { usePagedList } from "../../composables/usePagedList"
import LoadMoreButton from "../common/LoadMoreButton.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 规则检查聚合视图（取 violations + violationCount） */
  stats: CommitRuleCheckStats
  /** 是否限定到单个项目（隐藏每行重复的项目名 chip） */
  scoped?: boolean
}>()

const emit = defineEmits<{
  viewProject: [projectId: string]
  openFix: [violation: CommitRuleViolation]
}>()

/** 违规列表分页数据源 */
const pagedSource = computed(() => props.stats.violations)

/** 本地分页（usePagedList 消除与 CommitAnalysis 的分页重复） */
const {
  visibleCount: pagedVisibleCount,
  paged: pagedViolations,
  hasMore: pagedHasMore,
  loadMore: pagedLoadMore,
} = usePagedList(pagedSource, 50)
</script>

<style lang="scss">
@use "../../styles/CommitRuleCheckPanel.scss";
@use "../../styles/index.scss";
</style>
