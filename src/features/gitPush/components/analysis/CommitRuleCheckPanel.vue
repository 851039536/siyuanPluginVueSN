<!-- gitPush 提交规则检查面板（校验提交信息并集中展示不合规提交） -->
<template>
  <div class="grc-panel">
    <!-- 空状态：无项目 -->
    <EmptyState
      v-if="projectCount === 0"
      icon="mdi:source-repository"
      :text="i18n.noProjectsStats"
    />

    <template v-else>
      <!-- 顶部工具条：分析状态 + 条数选择 + 分析按钮 -->
      <div class="grc-toolbar">
        <!-- 分析状态："分析中…/上次分析 xx/未分析" -->
        <span class="grc-status">{{ analyzing ? i18n.auditing : (analyzed ? i18n.analysisLastRun.replace("{0}", relativeTime(analyzedAt, i18n)) : i18n.ruleCheckNotRun) }}</span>
        <div class="grc-toolbar-right">
          <!-- 条数选择（tooltip："每项目 {0} 条"） -->
          <select
            class="grc-count-select"
            :value="commitCount"
            :title="i18n.analysisCommitsPerProject.replace('{0}', String(commitCount))"
            @change="onCountChange"
          >
            <option
              v-for="n in COMMIT_COUNT_OPTIONS"
              :key="n"
              :value="n"
            >{{ n }}</option>
          </select>
          <!-- 按钮文案："开始分析"/"重新分析"（分析中切换为环形 loading 图标并旋转，业务图标不参与旋转） -->
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm"
            :disabled="analyzing"
            @click="emit('runAnalysis')"
          >
            <Icon
              :icon="analyzing ? 'mdi:loading' : 'mdi:clipboard-check-outline'"
              height="12"
              :class="{ 'gp-spin': analyzing }"
            />
            {{ analyzed ? i18n.auditRerun : i18n.auditRun }}
          </button>
        </div>
      </div>

      <!-- 首次分析中占位 -->
      <div
        v-if="analyzing && !analyzed"
        class="gp-loading"
      >
        <Loader />
        <!-- 加载中文案："分析中…" -->
        <span class="gp-loading-text">{{ i18n.auditing }}</span>
      </div>

      <!-- 未分析提示 -->
      <EmptyState
        v-else-if="!analyzed"
        icon="mdi:clipboard-check-outline"
        :text="i18n.ruleCheckNotRun"
      />

      <template v-else>
        <!-- 空状态：分析完成但无提交数据 -->
        <EmptyState
          v-if="stats.totalCommits === 0"
          icon="mdi:source-commit"
          :text="i18n.ruleCheckNoData"
        />

        <template v-else>
          <!-- 总览卡片 -->
          <div class="grc-cards">
            <div class="grc-card">
              <div class="grc-card-value">{{ stats.totalCommits }}</div>
              <!-- 卡片标签："检查提交数" -->
              <div class="grc-card-label">{{ i18n.ruleCheckTotal }}</div>
            </div>
            <div class="grc-card">
              <div class="grc-card-value grc-card-value--danger">{{ stats.violationCount }}</div>
              <!-- 卡片标签："不合规提交" -->
              <div class="grc-card-label">{{ i18n.ruleCheckViolations }}</div>
            </div>
            <div class="grc-card">
              <div class="grc-card-value">{{ complianceRate }}%</div>
              <!-- 卡片标签："合规率" -->
              <div class="grc-card-label">{{ i18n.ruleCheckCompliant }}</div>
            </div>
          </div>

          <!-- 规则提示 -->
          <div class="grc-hint">
            {{ i18n.ruleCheckHint.replace("{0}", COMMIT_TYPE_VALUES.join(" / ")) }}
          </div>

          <!-- 违规类型分布 -->
          <div
            v-if="stats.byReason.length > 0"
            class="grc-section"
          >
            <!-- 区块标题："违规类型分布" -->
            <div class="grc-section-title">{{ i18n.ruleCheckReasonTitle }}</div>
            <div class="grc-bar-list">
              <div
                v-for="row in reasonRows"
                :key="row.reason"
                class="grc-bar-row"
              >
                <span class="grc-bar-label">{{ i18n[COMMIT_RULE_REASON_META[row.reason].labelKey] }}</span>
                <span class="grc-bar-track">
                  <span
                    class="grc-bar-fill"
                    :style="{ width: row.pct }"
                  />
                </span>
                <span class="grc-bar-num">{{ row.count }}</span>
              </div>
            </div>
          </div>

          <!-- 空状态：全部合规 -->
          <EmptyState
            v-if="stats.violationCount === 0"
            icon="mdi:check-decagram"
            :text="i18n.ruleCheckAllCompliant"
          />

          <!-- 不合规提交列表 -->
          <div
            v-else
            class="grc-section"
          >
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
                    class="grc-item-project"
                    :title="row.projectName"
                    @click.stop="emit('viewProject', row.projectId)"
                  >{{ row.projectName }}</span>
                  <span class="grc-item-hash">{{ row.hash }}</span>
                  <span class="grc-item-reason">{{ i18n[COMMIT_RULE_REASON_META[row.reason].labelKey] }}</span>
                  <span class="grc-item-date">{{ relativeTime(row.date, i18n) }}</span>
                </div>
                <div
                  class="grc-item-msg"
                  :title="row.message"
                >{{ row.message }}</div>
                <div class="grc-item-meta">
                  <span>{{ row.author }}</span>
                  <span :title="row.date">{{ row.date }}</span>
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
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { CommitRuleCheckStats } from "../../types"
import { Icon } from "@iconify/vue"
import { computed } from "vue"
import { COMMIT_TYPE_VALUES, COMMIT_RULE_REASON_META } from "../../types"
import { COMMIT_COUNT_OPTIONS } from "../../composables/useCommitAnalysis"
import { relativeTime, withBarPct } from "../../utils"
import { usePagedList } from "../../composables/usePagedList"
import EmptyState from "../common/EmptyState.vue"
import Loader from "@/components/Loader.vue"
import LoadMoreButton from "../common/LoadMoreButton.vue"

const props = defineProps<{
  i18n: Record<string, any>
  stats: CommitRuleCheckStats
  projectCount: number
  analyzing: boolean
  analyzed: boolean
  /** 上次分析完成时间（ISO） */
  analyzedAt: string
  commitCount: number
}>()

const emit = defineEmits<{
  runAnalysis: []
  updateCount: [n: number]
  viewProject: [projectId: string]
}>()

/** 合规率（保留 1 位小数） */
const complianceRate = computed(() => {
  if (props.stats.totalCommits === 0) return 100
  return Number(((props.stats.compliantCount / props.stats.totalCommits) * 100).toFixed(1))
})

/** 违规类型分布行（复用 withBarPct 计算条形宽度） */
const reasonRows = computed(() => withBarPct(props.stats.byReason))

/** 违规列表分页数据源 */
const pagedSource = computed(() => props.stats.violations)

/** 本地分页（usePagedList 消除与 CommitAnalysisPanel 的分页重复） */
const {
  visibleCount: pagedVisibleCount,
  paged: pagedViolations,
  hasMore: pagedHasMore,
  loadMore: pagedLoadMore,
} = usePagedList(pagedSource, 50)

function onCountChange(e: Event) {
  emit("updateCount", Number((e.target as HTMLSelectElement).value))
}
</script>

<style lang="scss">
@use "../../styles/CommitRuleCheckPanel.scss";
@use "../../styles/index.scss";
</style>
