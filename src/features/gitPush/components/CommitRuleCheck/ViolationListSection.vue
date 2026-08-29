<!-- gitPush 提交规则检查不合规提交列表区块（条目 + 批量修复 + 修正入口 + 分页加载） -->
<template>
  <div class="grc-section">
    <!-- 区块标题："不合规提交列表" + 条数徽章 + 批量操作 -->
    <div class="grc-section-title">
      {{ i18n.ruleCheckTitle }}
      <span class="grc-section-count">{{ pagedSource.length }}</span>
      <span class="grc-section-actions">
        <!-- 全选当前可见项 -->
        <button
          class="vp-btn vp-btn--ghost vp-btn--xs"
          :disabled="pagedViolations.length === 0 || fixing"
          @click.stop="selectAllVisible(pagedViolations)"
        >
          <Icon icon="mdi:checkbox-multiple-outline" height="12" />
          {{ i18n.ruleCheckSelectAll }}
        </button>
        <!-- 批量修复选中项（未勾选时点击给出提示，禁用仅限修复执行中） -->
        <button
          class="vp-btn vp-btn--ghost vp-btn--xs"
          :disabled="fixing"
          :title="i18n.ruleCheckBatchFixTip"
          @click.stop="runBatchFix"
        >
          <Icon
            :icon="fixing ? 'mdi:loading' : 'mdi:pencil-multiple'"
            height="12"
            :class="{ 'gp-spin': fixing }"
          />
          {{ i18n.ruleCheckBatchFix }}
        </button>
      </span>
    </div>

    <!-- 批量修复提示 / 结果（含跳过原因） -->
    <div
      v-if="batchNotice"
      class="grc-batch-result grc-batch-result--hint"
    >{{ batchNotice }}</div>
    <div
      v-else-if="lastResult"
      class="grc-batch-result"
    >{{ i18n.ruleCheckBatchResult.replace("{0}", String(lastResult.fixed)).replace("{1}", String(lastResult.skipped)).replace("{2}", String(lastResult.failed)) }}<span v-if="skippedReasonText">（{{ skippedReasonText }}）</span></div>

    <div class="grc-list">
      <div
        v-for="row in pagedRows"
        :key="row.key"
        class="grc-item"
      >
        <div class="grc-item-head">
          <!-- 勾选复选框（批量修复） -->
          <input
            type="checkbox"
            class="grc-item-check"
            :checked="isSelected(row)"
            @change="toggle(row.key)"
          />
          <span
            v-if="!scoped"
            class="grc-item-project"
            :title="row.projectName"
            @click.stop="emit('viewProject', row.projectId)"
          >{{ row.projectName }}</span>
          <span class="grc-item-hash">{{ row.hash }}</span>
          <span class="grc-item-reason">{{ i18n[COMMIT_RULE_REASON_META[row.reason].labelKey] }}</span>
          <!-- 可自动修复标记（仅格式类问题可确定性修复，语义类需 AI/手动） -->
          <Icon
            v-if="row.autoFixable"
            class="grc-item-autofix"
            icon="mdi:auto-fix"
            height="12"
            :title="i18n.ruleCheckAutoFixable"
          />
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
// gitPush 提交规则检查不合规提交列表区块（本地分页 + 批量修复 + 修正入口）
import type { CommitRuleCheckStats, CommitRuleViolation } from "../../types"
import { CARD_SERVICES_KEY, COMMIT_RULE_REASON_META } from "../../types"
import { Icon } from "@iconify/vue"
import { computed, inject, ref, watch } from "vue"
import { formatDateTime, relativeTime } from "../../utils"
import { usePagedList } from "../../composables/usePagedList"
import { isAutoFixable, useBatchCommitFix, violationKey } from "../../composables/useBatchCommitFix"
import LoadMoreButton from "../common/LoadMoreButton.vue"

/** 违规行视图：预计算唯一 key 与可自动修复标记（isAutoFixable 内含正则，模板内不再逐行重复执行） */
interface ViolationRow extends CommitRuleViolation {
  key: string
  autoFixable: boolean
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
  /** 批量修复完成且存在成功项，父级按这些项目局部刷新分析 */
  batchFixed: [projectIds: string[]]
}>()

/** 通过卡片依赖注入获取 manager（批量修复需直接执行 git 改写，参考 CommitFixDialog） */
const services = inject(CARD_SERVICES_KEY)!
const { manager } = services

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

/** 分页行视图：行 key 与可自动修复标记随数据源变化各算一次，不在每次渲染重复计算 */
const pagedRows = computed<ViolationRow[]>(() =>
  pagedViolations.value.map((v) => ({
    ...v,
    key: violationKey(v),
    autoFixable: isAutoFixable(v),
  })),
)

/** 批量修复状态与操作（选中映射 / 串行修复 / 结果统计） */
const {
  selectedCount,
  fixing,
  lastResult,
  isSelected,
  toggle,
  selectAllVisible,
  clearSelection,
  fixSelected,
} = useBatchCommitFix(manager, pagedSource)

/** 操作提示文案（未勾选时点击批量修复的引导，优先于结果提示显示） */
const batchNotice = ref("")

/** 跳过原因文案（去重拼接，如 "缺少 type、描述非中文"），结果提示解释为什么未修复 */
const skippedReasonText = computed(() => {
  const reasons = lastResult.value?.skippedReasons
  if (!reasons || reasons.length === 0) return ""
  return reasons.map((r) => props.i18n[COMMIT_RULE_REASON_META[r].labelKey]).join("、")
})

/** 数据源变化（重新分析/切换过滤项目）时重置分页、清空选中与提示，防止新结果集停留在旧页码/残留状态 */
watch(pagedSource, () => {
  pagedReset()
  clearSelection()
  batchNotice.value = ""
  lastResult.value = null
})

/** 批量修复选中项：未勾选时提示引导；成功修复后清空选择并通知父级按受影响项目局部刷新 */
async function runBatchFix() {
  if (selectedCount.value === 0) {
    batchNotice.value = props.i18n.ruleCheckSelectHint
    return
  }
  batchNotice.value = ""
  const result = await fixSelected()
  if (result.fixed > 0) {
    clearSelection()
    emit("batchFixed", result.projectIds)
  }
}
</script>

<style lang="scss">
@use "../../styles/CommitRuleCheckPanel.scss";
@use "../../styles/index.scss";
</style>
