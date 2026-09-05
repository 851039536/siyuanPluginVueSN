<!-- gitPush 提交规则检查不合规提交列表区块（条目 + 修正入口 + 分页加载） -->
<template>
  <div class="grc-section">
    <!-- 区块标题："不合规提交列表" + 条数徽章 + 全选 + 批量修正 -->
    <div class="grc-section-title">
      <span>{{ i18n.ruleCheckTitle }}</span>
      <span class="grc-section-count">{{ pagedSource.length }}</span>
      <span class="grc-title-actions">
        <!-- 全选 checkbox（勾选 = 选中全部违规项） -->
        <label class="grc-select-all">
          <input
            type="checkbox"
            :checked="allSelected"
            :title="i18n.ruleCheckSelectAll"
            @change="toggleSelectAll"
          />
          {{ i18n.ruleCheckSelectAll }}
        </label>
        <!-- 批量修正按钮（显示选中计数，未选中时禁用） -->
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          :disabled="selectedCount === 0"
          :title="i18n.ruleFixOpen"
          @click="openBatch"
        >
          <Icon icon="mdi:auto-fix" height="12" />
          {{ i18n.ruleCheckBatchFix }}
          <span
            v-if="selectedCount > 0"
            class="grc-select-count"
          >{{ selectedCount }}</span>
        </button>
      </span>
    </div>

    <div class="grc-list">
      <div
        v-for="row in pagedRows"
        :key="row.key"
        class="grc-item"
      >
        <div class="grc-item-head">
          <!-- 批量选择复选框（选中键 = 行 key：projectId-hash-reason） -->
          <input
            type="checkbox"
            class="grc-item-check"
            :checked="selectedKeys.has(row.key)"
            :title="i18n.ruleCheckBatchFix"
            @change="toggleSelect(row.key)"
          />
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
import { COMMIT_RULE_REASON_META } from "../../types"
import { Icon } from "@iconify/vue"
import { computed, ref, watch } from "vue"
import { formatDateTime, relativeTime } from "../../utils"
import { usePagedList } from "../../composables/usePagedList"
import LoadMoreButton from "../common/LoadMoreButton.vue"

/** 违规行视图：预计算唯一 key（projectId-hash-reason），模板内不再逐行重复拼接 */
interface ViolationRow extends CommitRuleViolation {
  key: string
}

const props = defineProps<{
  i18n: Record<string, any>
  /** 规则检查聚合视图（取 violations） */
  stats: CommitRuleCheckStats
  /** 是否限定到单个项目（隐藏每行重复的项目名 chip） */
  scoped?: boolean
}>()

const emit = defineEmits<{
  viewProject: [projectId: string]
  openFix: [violation: CommitRuleViolation]
  openBatchFix: [violations: CommitRuleViolation[]]
}>()

/** 选中项 key 集合（key = projectId-hash-reason，与行 key 一致） */
const selectedKeys = ref<Set<string>>(new Set())

/** 选中项数量 */
const selectedCount = computed(() => selectedKeys.value.size)

/** 全选态：非空列表且全部选中 */
const allSelected = computed(() => pagedSource.value.length > 0 && selectedKeys.value.size === pagedSource.value.length)

function toggleSelect(key: string) {
  const next = new Set(selectedKeys.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  selectedKeys.value = next
}

function toggleSelectAll() {
  selectedKeys.value = allSelected.value
    ? new Set()
    : new Set(pagedSource.value.map((v) => `${v.projectId}-${v.hash}-${v.reason}`))
}

/** 批量修正：按 stats.violations 顺序（日期降序）传出选中项，保证同项目祖先-后代违规"新→旧"处理 */
function openBatch() {
  const selected = props.stats.violations.filter((v) => selectedKeys.value.has(`${v.projectId}-${v.hash}-${v.reason}`))
  if (selected.length > 0) emit("openBatchFix", selected)
}

/** 违规列表分页数据源 */
const pagedSource = computed(() => props.stats.violations)

/** 本地分页（usePagedList 消除与 CommitAnalysis 的分页重复） */
const {
  visibleCount: pagedVisibleCount,
  paged: pagedViolations,
  hasMore: pagedHasMore,
  loadMore: pagedLoadMore,
  reset: pagedReset,
} = usePagedList(pagedSource, 50)

/** 分页行视图：行 key 随数据源变化各算一次，不在每次渲染重复计算 */
const pagedRows = computed<ViolationRow[]>(() =>
  pagedViolations.value.map((v) => ({
    ...v,
    key: `${v.projectId}-${v.hash}-${v.reason}`,
  })),
)

/** 数据源变化（重新分析/切换过滤项目）时重置分页并清空选择，防止旧结果集的页码/选中项残留 */
watch(pagedSource, () => {
  pagedReset()
  selectedKeys.value = new Set()
})
</script>

<style lang="scss">
@use "../../styles/CommitRuleCheckPanel.scss";
@use "../../styles/index.scss";
</style>