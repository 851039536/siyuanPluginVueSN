<!-- gitPush 提交分析面板（提交记录/时间趋势/提交次数/内容类型聚合视图） -->
<template>
  <div class="gpa-panel">
    <!-- 空状态：无项目（复用 gp-empty 基座） -->
    <div
      v-if="stats.projectCount === 0"
      class="gp-empty"
    >
      <div class="gp-empty-icon">
        <Icon
          icon="mdi:chart-timeline-variant"
          width="48"
          height="48"
        />
      </div>
      <!-- 空状态文案："暂无项目，请在列表视图中添加" -->
      <div class="gp-empty-text">
        {{ i18n.noProjectsStats }}
      </div>
    </div>

    <template v-else>
      <!-- 顶部工具条：分析状态 + 条数选择 + 分析按钮 -->
      <div class="gpa-toolbar">
        <!-- 分析状态："分析中…/完成/未分析" -->
        <span class="gpa-status">{{ analyzing ? i18n.auditing : (analyzed ? i18n.done : i18n.analysisNotRun) }}</span>
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
          <!-- 按钮文案："开始分析"/"重新分析"（分析中图标转圈） -->
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm"
            :disabled="analyzing"
            @click="emit('runAnalysis')"
          >
            <Icon
              icon="mdi:chart-timeline-variant"
              height="12"
              :class="{ 'gp-spin': analyzing }"
            />
            {{ analyzed ? i18n.auditRerun : i18n.auditRun }}
          </button>
        </div>
      </div>

      <!-- 首次分析中占位（避免闪现空态） -->
      <div
        v-if="analyzing && !analyzed"
        class="gp-loading"
      >
        <Loader />
        <!-- 加载中文案："分析中…" -->
        <span class="gp-loading-text">{{ i18n.auditing }}</span>
      </div>

      <!-- 未分析提示（自动分析被 gitOpsPaused 跳过或尚未触发的瞬间） -->
      <div
        v-else-if="!analyzed"
        class="gp-empty"
      >
        <div class="gp-empty-icon">
          <Icon
            icon="mdi:chart-timeline-variant"
            width="48"
            height="48"
          />
        </div>
        <!-- 空状态文案："点击「开始分析」聚合所有项目的提交记录" -->
        <div class="gp-empty-text">
          {{ i18n.analysisNotRun }}
        </div>
      </div>

      <template v-else>
        <!-- 总览卡片：总提交次数 / 已分析项目数 -->
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

        <!-- 失败提示："{0} 个项目获取提交失败" -->
        <div
          v-if="stats.failedCount > 0"
          class="gpa-fail-hint"
        >
          {{ i18n.analysisFailedCount.replace("{0}", String(stats.failedCount)) }}
        </div>

        <!-- 空状态：分析完成但无提交数据 -->
        <div
          v-if="stats.totalCommits === 0"
          class="gp-empty"
        >
          <div class="gp-empty-icon">
            <Icon
              icon="mdi:source-commit"
              width="48"
              height="48"
            />
          </div>
          <!-- 空状态文案："暂无提交数据" -->
          <div class="gp-empty-text">
            {{ i18n.analysisNoData }}
          </div>
        </div>

        <template v-else>
          <!-- 项目提交排行（点击行跳转项目） -->
          <div class="gpa-section">
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
                <span class="gpa-bar-num">{{ row.count }}</span>
              </div>
            </div>
          </div>

          <!-- 最近 30 天提交趋势（每日纵向条形图） -->
          <div class="gpa-section">
            <!-- 区块标题："最近 30 天提交趋势" -->
            <div class="gpa-section-title">
              {{ i18n.analysisDailyTitle }}
            </div>
            <div class="gpa-daily">
              <!-- 每日柱（hover 显示 "日期: 次数"） -->
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

          <!-- 提交内容类型（Conventional Commits 前缀分类条形） -->
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

          <!-- 最近提交记录（跨项目合并按日期降序） -->
          <div class="gpa-section">
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
            <!-- 加载更多（本地分页，每次 +50，文案："加载更多 (可见/总数)"） -->
            <div
              v-if="visibleCount < sortedEntries.length"
              class="gpa-load-more"
            >
              <button
                class="vp-btn vp-btn--ghost vp-btn--sm"
                @click="visibleCount += 50"
              >
                {{ i18n.loadMoreLogs }} ({{ visibleCount }} / {{ sortedEntries.length }})
              </button>
            </div>
          </div>
        </template>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { CommitAnalysisStats } from "../types"
import { Icon } from "@iconify/vue"
import { computed, ref } from "vue"
import { COMMIT_COUNT_OPTIONS } from "../composables/useCommitAnalysis"
import { COMMIT_ANALYSIS_TYPE_META } from "../types"
import { relativeTime } from "../utils"
import Loader from "@/components/Loader.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 分析聚合视图（单对象 prop，由 useCommitAnalysis.analysisStats 产出） */
  stats: CommitAnalysisStats
  analyzing: boolean
  analyzed: boolean
  commitCount: number
}>()

const emit = defineEmits<{
  runAnalysis: []
  updateCount: [n: number]
  viewProject: [projectId: string]
}>()

/** 提交记录本地分页：默认 50 条，加载更多逐次 +50（仿 LogPanel） */
const visibleCount = ref(50)

/** 跨项目合并、按日期降序的提交流 */
const sortedEntries = computed(() =>
  [...props.stats.entries].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)),
)

const pagedEntries = computed(() => sortedEntries.value.slice(0, visibleCount.value))

/** 条形宽度百分比（相对最大值） */
function barPct(count: number, max: number): string {
  return `${Math.round((count / max) * 100)}%`
}

/** 项目排行行视图：宽度百分比预计算，避免模板中重复求最大值 */
const projectRows = computed(() => {
  const max = props.stats.projectRanking[0]?.count || 1
  return props.stats.projectRanking.map((r) => ({ ...r, pct: barPct(r.count, max) }))
})

/** 每日趋势行视图：高度百分比预计算（0 次日留空柱） */
const dailyRows = computed(() => {
  const max = Math.max(...props.stats.dailyCommits.map((d) => d.count), 1)
  return props.stats.dailyCommits.map((d) => ({ ...d, pct: d.count === 0 ? "0%" : barPct(d.count, max) }))
})

/** 提交类型行视图：标签与颜色来自 COMMIT_ANALYSIS_TYPE_META */
const typeRows = computed(() => {
  const max = props.stats.typeDistribution[0]?.count || 1
  return props.stats.typeDistribution.map((t) => ({ ...t, pct: barPct(t.count, max) }))
})

/** 作者排行行视图 */
const authorRows = computed(() => {
  const max = props.stats.authorRanking[0]?.count || 1
  return props.stats.authorRanking.map((a) => ({ ...a, pct: barPct(a.count, max) }))
})

function onCountChange(e: Event) {
  emit("updateCount", Number((e.target as HTMLSelectElement).value))
}
</script>

<style lang="scss">
@use "../styles/CommitAnalysisPanel.scss";
@use "../styles/index.scss";
</style>
