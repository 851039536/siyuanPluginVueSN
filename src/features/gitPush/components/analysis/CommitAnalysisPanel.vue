<!-- gitPush 提交分析面板（提交记录/时间趋势/提交次数/内容类型聚合视图） -->
<template>
  <div class="gpa-panel">
    <!-- 空状态：无项目 -->
    <EmptyState
      v-if="stats.projectCount === 0"
      icon="mdi:chart-timeline-variant"
      :text="i18n.noProjectsStats"
    />

    <template v-else>
      <!-- 顶部工具条：分析状态 + 条数选择 + 分析按钮 -->
      <div class="gpa-toolbar">
        <!-- 分析状态："分析中…/上次分析 xx/未分析" -->
        <span class="gpa-status">{{ analyzing ? i18n.auditing : (analyzed ? i18n.analysisLastRun.replace("{0}", relativeTime(analyzedAt, i18n)) : i18n.analysisNotRun) }}</span>
        <div class="gpa-toolbar-right">
          <!-- 条数选择（tooltip："每项目 {0} 条"） -->
          <select
            class="gpa-count-select"
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
              :icon="analyzing ? 'mdi:loading' : 'mdi:chart-timeline-variant'"
              height="12"
              :class="{ 'gp-spin': analyzing }"
            />
            {{ analyzed ? i18n.auditRerun : i18n.auditRun }}
          </button>
          <!-- 显示设置菜单 -->
          <CommitAnalysisSettings
            :i18n="i18n"
            :view-settings="viewSettings"
            :years="yearOptions"
            @update="emit('updateViewSettings', $event)"
          />
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
        icon="mdi:chart-timeline-variant"
        :text="i18n.analysisNotRun"
      />

      <template v-else>
        <!-- 总览卡片 -->
        <div class="gpa-cards">
          <div class="gpa-card">
            <div class="gpa-card-value">{{ stats.totalCommits }}</div>
            <!-- 卡片标签："总提交次数" -->
            <div class="gpa-card-label">{{ i18n.analysisTotalCommits }}</div>
          </div>
          <div class="gpa-card">
            <div class="gpa-card-value">{{ stats.analyzedCount }} / {{ stats.projectCount }}</div>
            <!-- 卡片标签："已分析项目" -->
            <div class="gpa-card-label">{{ i18n.analysisCoveredProjects }}</div>
          </div>
        </div>

        <!-- 失败提示 -->
        <div
          v-if="stats.failedCount > 0"
          class="gpa-fail-hint"
        >
          {{ i18n.analysisFailedCount.replace("{0}", String(stats.failedCount)) }}
        </div>

        <!-- 空状态：分析完成但无提交数据 -->
        <EmptyState
          v-if="stats.totalCommits === 0"
          icon="mdi:source-commit"
          :text="i18n.analysisNoData"
        />

        <template v-else>
          <!-- 双栏：项目提交排行 | 最近提交记录 -->
          <div class="gpa-pair">
            <div class="gpa-section gpa-section--scroll">
              <!-- 区块标题："项目提交排行" -->
              <div class="gpa-section-title">
                {{ i18n.analysisProjectRanking }}
              </div>
              <div class="gpa-bar-list">
                <div
                  v-for="row in projectRows"
                  :key="row.id"
                  class="gpa-bar-row gpa-bar-row--clickable"
                  @click="emit('viewProject', row.id)"
                >
                  <span
                    class="gpa-bar-label"
                    :title="row.name"
                  >{{ row.name }}</span>
                  <span class="gpa-bar-track">
                    <span
                      class="gpa-bar-fill"
                      :style="{ width: row.pct }"
                    />
                  </span>
                  <!-- 数字列：占总提交百分比（tooltip 保留原始次数） -->
                  <span
                    class="gpa-bar-num"
                    :title="row.title"
                  >{{ row.shareText }}</span>
                </div>
              </div>
            </div>

            <!-- 最近提交记录 -->
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
                v-if="pagedHasMore"
                :i18n="i18n"
                :visible="pagedVisibleCount"
                :total="sortedEntries.length"
                @load-more="pagedLoadMore"
              />
            </div>
          </div>

          <!-- 提交热力图 / 日历 -->
          <div class="gpa-section">
            <!-- 区块标题："提交热力图"/"提交日历" -->
            <div class="gpa-section-title">
              {{ viewSettings.view === "heatmap" ? i18n.analysisHeatTitle : i18n.analysisCalendarTitle }}
            </div>
            <CommitHeatmap
              v-if="viewSettings.view === 'heatmap'"
              :i18n="i18n"
              :day-counts="dayCounts"
              :start="heatRange.start"
              :end="heatRange.end"
              :week-start="viewSettings.weekStart"
              :color="viewSettings.color"
            />
            <CommitCalendar
              v-else
              :i18n="i18n"
              :day-counts="dayCounts"
              :start="heatRange.start"
              :end="heatRange.end"
              :week-start="viewSettings.weekStart"
              :color="viewSettings.color"
            />
          </div>

          <!-- 最近 30 天提交趋势 -->
          <div class="gpa-section">
            <!-- 区块标题："最近 30 天提交趋势" -->
            <div class="gpa-section-title">
              {{ i18n.analysisDailyTitle }}
            </div>
            <div class="gpa-daily">
              <!-- 每日柱 -->
              <div
                v-for="d in dailyRows"
                :key="d.label"
                class="gpa-daily-col"
                :title="`${d.label}: ${d.count}`"
              >
                <div
                  class="gpa-daily-bar"
                  :style="{ height: d.pct }"
                />
              </div>
            </div>
          </div>

          <!-- 双栏：作者提交排行 | 提交内容类型 -->
          <div class="gpa-pair">
            <!-- 作者提交排行 -->
            <div class="gpa-section">
              <!-- 区块标题："作者提交排行" -->
              <div class="gpa-section-title">
                {{ i18n.analysisAuthorRanking }}
              </div>
              <div class="gpa-bar-list">
                <div
                  v-for="a in authorRows"
                  :key="a.author"
                  class="gpa-bar-row"
                >
                  <span
                    class="gpa-bar-label"
                    :title="a.author"
                  >{{ a.author }}</span>
                  <span class="gpa-bar-track">
                    <span
                      class="gpa-bar-fill"
                      :style="{ width: a.pct }"
                    />
                  </span>
                  <span class="gpa-bar-num">{{ a.count }}</span>
                </div>
              </div>
            </div>

            <!-- 提交内容类型 -->
            <div class="gpa-section">
              <!-- 区块标题："提交内容类型" -->
              <div class="gpa-section-title">
                {{ i18n.analysisTypeDistribution }}
              </div>
              <div class="gpa-bar-list">
                <div
                  v-for="t in typeRows"
                  :key="t.type"
                  class="gpa-bar-row"
                >
                  <span class="gpa-bar-label">{{ i18n[COMMIT_ANALYSIS_TYPE_META[t.type].labelKey] }}</span>
                  <span class="gpa-bar-track">
                    <span
                      class="gpa-bar-fill"
                      :style="{ width: t.pct, background: COMMIT_ANALYSIS_TYPE_META[t.type].color }"
                    />
                  </span>
                  <span class="gpa-bar-num">{{ t.count }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { CommitAnalysisStats, CommitAnalysisViewSettings } from "../../types"
import { Icon } from "@iconify/vue"
import { computed } from "vue"
import { COMMIT_COUNT_OPTIONS } from "../../composables/useCommitAnalysis"
import { COMMIT_ANALYSIS_TYPE_META } from "../../types"
import { buildDayCountMap, formatLocalDate, relativeTime, resolveAnalysisRange, withBarPct } from "../../utils"
import { usePagedList } from "../../composables/usePagedList"
import CommitAnalysisSettings from "./CommitAnalysisSettings.vue"
import CommitCalendar from "./CommitCalendar.vue"
import CommitHeatmap from "./CommitHeatmap.vue"
import EmptyState from "../common/EmptyState.vue"
import Loader from "@/components/Loader.vue"
import LoadMoreButton from "../common/LoadMoreButton.vue"

const props = defineProps<{
  i18n: Record<string, any>
  stats: CommitAnalysisStats
  analyzing: boolean
  analyzed: boolean
  /** 上次分析完成时间（ISO） */
  analyzedAt: string
  commitCount: number
  viewSettings: CommitAnalysisViewSettings
}>()

const emit = defineEmits<{
  runAnalysis: []
  updateCount: [n: number]
  updateViewSettings: [patch: Partial<CommitAnalysisViewSettings>]
  viewProject: [projectId: string]
}>()

/** 日计数映射（YYYY-MM-DD → 提交数） */
const dayCounts = computed(() => buildDayCountMap(props.stats.entries))

/** 当前显示范围起止（YYYY-MM-DD） */
const heatRange = computed(() => {
  const { start, end } = resolveAnalysisRange(props.viewSettings.range)
  return { start: formatLocalDate(start), end: formatLocalDate(end) }
})

/** 年份选项：数据年份 ∪ 今年 ∪ 已保存年份，降序 */
const yearOptions = computed(() => {
  const years = new Set<number>()
  years.add(new Date().getFullYear())
  if (typeof props.viewSettings.range === "number") years.add(props.viewSettings.range)
  for (const e of props.stats.entries) {
    const d = new Date(e.date)
    if (!Number.isNaN(d.getTime())) years.add(d.getFullYear())
  }
  return [...years].sort((a, b) => b - a)
})

/** 跨项目合并、按日期降序的提交流 */
const sortedEntries = computed(() =>
  [...props.stats.entries].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)),
)

/** 本地分页（usePagedList 消除与 LogPanel 的 visibleCount/slice/loadMore 重复） */
const {
  visibleCount: pagedVisibleCount,
  paged: pagedEntries,
  hasMore: pagedHasMore,
  loadMore: pagedLoadMore,
} = usePagedList(sortedEntries, 50)

/** 百分比格式化：保留 1 位小数并去掉尾零；极小占比显示 <0.1% 避免误导 */
function formatShare(share: number): string {
  if (share > 0 && share < 0.1) return "<0.1%"
  return `${share.toFixed(1).replace(/\.0$/, "")}%`
}

/** 项目排行行视图：条形宽度相对最大值；数字列显示占总提交的百分比 */
const projectRows = computed(() => {
  const total = props.stats.totalCommits || 1
  return withBarPct(props.stats.projectRanking).map((r) => {
    const shareText = formatShare((r.count / total) * 100)
    return {
      ...r,
      shareText,
      title: String(props.i18n.analysisShareTooltip || "")
        .replace("{0}", String(r.count))
        .replace("{1}", shareText),
    }
  })
})

/** 每日趋势行视图：高度百分比预计算（0 次日留空柱） */
const dailyRows = computed(() => withBarPct(props.stats.dailyCommits, { zeroAsEmpty: true }))

/** 提交类型行视图 */
const typeRows = computed(() => withBarPct(props.stats.typeDistribution))

/** 作者排行行视图 */
const authorRows = computed(() => withBarPct(props.stats.authorRanking))

function onCountChange(e: Event) {
  emit("updateCount", Number((e.target as HTMLSelectElement).value))
}
</script>

<style lang="scss">
@use "../../styles/CommitAnalysisPanel.scss";
@use "../../styles/index.scss";
</style>
