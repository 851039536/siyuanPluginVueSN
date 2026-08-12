<!-- gitPush 行数统计面板：顶部汇总卡片（总新增/删除/净增）+ 单栏堆叠的项目/作者代码行数排行 -->
<template>
  <div class="gls-panel">
    <!-- 空状态：无项目 -->
    <EmptyState
      v-if="projectCount === 0"
      icon="mdi:code-tags"
      :text="i18n.noProjectsStats"
    />

    <template v-else>
      <!-- 顶部工具条：分析状态 + 条数选择 + 分析按钮 -->
      <div class="gls-toolbar">
        <!-- 分析状态："分析中…/上次分析 xx/未分析" -->
        <span class="gls-status">{{ analyzing ? i18n.auditing : (analyzed ? i18n.analysisLastRun.replace("{0}", relativeTime(analyzedAt, i18n)) : i18n.lineStatsNotRun) }}</span>
        <div class="gls-toolbar-right">
          <!-- 条数选择（tooltip："每项目 {0} 条"） -->
          <select
            class="gls-count-select"
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
          <!-- 按钮文案："开始行数分析"/"重新分析"（分析中切换为环形 loading 图标并旋转，业务图标不参与旋转） -->
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm"
            :disabled="analyzing"
            @click="emit('runAnalysis')"
          >
            <Icon
              :icon="analyzing ? 'mdi:loading' : 'mdi:code-tags'"
              height="12"
              :class="{ 'gp-spin': analyzing }"
            />
            {{ analyzed ? i18n.auditRerun : i18n.lineStatsRun }}
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
        icon="mdi:code-tags"
        :text="i18n.lineStatsNotRun"
      />

      <template v-else>
        <!-- 失败提示 -->
        <div
          v-if="failedCount > 0"
          class="gls-fail-hint"
        >
          {{ i18n.analysisFailedCount.replace("{0}", String(failedCount)) }}
        </div>

        <!-- 空状态：分析完成但无行数数据 -->
        <EmptyState
          v-if="projectRanking.length === 0 && authorRanking.length === 0"
          icon="mdi:source-commit"
          :text="i18n.lineStatsNoData"
        />

        <!-- 单栏堆叠：汇总卡片 + 项目代码行数排行 + 作者代码行数排行 -->
        <div
          v-else
          class="gls-pair"
        >
          <!-- 顶部汇总卡片：总新增 / 总删除 / 总净增（总净增随正负变色） -->
          <div class="gls-cards">
            <!-- 卡片：总新增（绿色） -->
            <div class="gls-card">
              <div class="gls-card-value gls-card-value--add">{{ summary.added.toLocaleString() }}</div>
              <div class="gls-card-label">{{ i18n.lineStatsTotalAdded }}</div>
            </div>
            <!-- 卡片：总删除（红色） -->
            <div class="gls-card">
              <div class="gls-card-value gls-card-value--del">{{ summary.deleted.toLocaleString() }}</div>
              <div class="gls-card-label">{{ i18n.lineStatsTotalDeleted }}</div>
            </div>
            <!-- 卡片：总净增（正绿负红，与行内净增语义一致） -->
            <div class="gls-card">
              <div
                class="gls-card-value"
                :class="netClass(summary.net)"
              >{{ summary.net.toLocaleString() }}</div>
              <div class="gls-card-label">{{ i18n.lineStatsTotalNet }}</div>
            </div>
          </div>

          <!-- 项目代码行数排行（+新增 / -删除 / 净增，按新增行降序） -->
          <div class="gls-section">
            <!-- 区块标题："项目代码行数排行" -->
            <div class="gls-section-title">
              {{ i18n.analysisLineProjectRanking }}
            </div>
            <div class="gls-bar-list">
              <div
                v-for="(row, idx) in projectRows"
                :key="row.id"
                class="gls-bar-row"
              >
                <!-- 排名序号：从 1 开始 -->
                <span class="gls-bar-rank">{{ idx + 1 }}</span>
                <span
                  class="gls-bar-label"
                  :title="row.name"
                >{{ row.name }}</span>
                <span class="gls-bar-track">
                  <span
                    class="gls-bar-fill"
                    :class="netClass(row.net)"
                    :style="{ width: row.pct }"
                  />
                </span>
                <!-- 数字列：+新增 / -删除 / 净增（千位分隔，正绿负红） -->
                <span class="gls-line-nums">
                  <span
                    class="gls-line-num gls-line-num--add"
                    :title="`${i18n.analysisLineAdded} ${row.added}`"
                  >+{{ row.added.toLocaleString() }}</span>
                  <span
                    class="gls-line-num gls-line-num--del"
                    :title="`${i18n.analysisLineDeleted} ${row.deleted}`"
                  >−{{ row.deleted.toLocaleString() }}</span>
                  <span
                    class="gls-line-num gls-line-num--net"
                    :class="netClass(row.net)"
                    :title="`${i18n.analysisLineNet} ${row.net}`"
                  >{{ row.net.toLocaleString() }}</span>
                </span>
                <!-- 占比列：新增行占总新增的百分比 -->
                <span class="gls-bar-share">{{ row.share }}</span>
              </div>
            </div>
          </div>

          <!-- 作者代码行数排行（+新增 / -删除 / 净增，按新增行降序） -->
          <div class="gls-section">
            <!-- 区块标题："作者代码行数排行" -->
            <div class="gls-section-title">
              {{ i18n.analysisLineAuthorRanking }}
            </div>
            <div class="gls-bar-list">
              <div
                v-for="(row, idx) in authorRows"
                :key="row.author"
                class="gls-bar-row"
              >
                <!-- 排名序号：从 1 开始 -->
                <span class="gls-bar-rank">{{ idx + 1 }}</span>
                <span
                  class="gls-bar-label"
                  :title="row.author"
                >{{ row.author }}</span>
                <span class="gls-bar-track">
                  <span
                    class="gls-bar-fill"
                    :class="netClass(row.net)"
                    :style="{ width: row.pct }"
                  />
                </span>
                <!-- 数字列：+新增 / -删除 / 净增（千位分隔，正绿负红） -->
                <span class="gls-line-nums">
                  <span
                    class="gls-line-num gls-line-num--add"
                    :title="`${i18n.analysisLineAdded} ${row.added}`"
                  >+{{ row.added.toLocaleString() }}</span>
                  <span
                    class="gls-line-num gls-line-num--del"
                    :title="`${i18n.analysisLineDeleted} ${row.deleted}`"
                  >−{{ row.deleted.toLocaleString() }}</span>
                  <span
                    class="gls-line-num gls-line-num--net"
                    :class="netClass(row.net)"
                    :title="`${i18n.analysisLineNet} ${row.net}`"
                  >{{ row.net.toLocaleString() }}</span>
                </span>
                <!-- 占比列：新增行占总新增的百分比 -->
                <span class="gls-bar-share">{{ row.share }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { AuthorLineRankItem, ProjectLineRankItem } from "../../types"
import { Icon } from "@iconify/vue"
import { computed } from "vue"
import { COMMIT_COUNT_OPTIONS } from "../../composables/useCommitAnalysis"
import { relativeTime } from "../../utils"
import EmptyState from "../common/EmptyState.vue"
import Loader from "@/components/Loader.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 全部项目数（空状态判断） */
  projectCount: number
  /** 项目代码行数排行（按新增行降序） */
  projectRanking: ProjectLineRankItem[]
  /** 作者代码行数排行（按新增行降序） */
  authorRanking: AuthorLineRankItem[]
  analyzing: boolean
  analyzed: boolean
  /** 上次分析完成时间（ISO） */
  analyzedAt: string
  /** 抓取失败的项目数 */
  failedCount: number
  commitCount: number
}>()

const emit = defineEmits<{
  runAnalysis: []
  updateCount: [n: number]
}>()

/** 行数排行行视图：条形宽度按新增行相对最大值（0 时退化为全空轨道）+ 新增行占总新增的百分比（保留 1 位小数，总 0 时兜底 1 防除零） */
function withLineBarPct<T extends { added: number }>(rows: T[]): (T & { pct: string, share: string })[] {
  const max = Math.max(...rows.map((r) => r.added), 1)
  const total = rows.reduce((s, r) => s + r.added, 0) || 1
  return rows.map((r) => ({
    ...r,
    pct: `${Math.round((r.added / max) * 100)}%`,
    share: `${((r.added / total) * 100).toFixed(1)}%`,
  }))
}

/** 项目代码行数排行行视图 */
const projectRows = computed(() => withLineBarPct(props.projectRanking))

/** 作者代码行数排行行视图 */
const authorRows = computed(() => withLineBarPct(props.authorRanking))

/** 顶部汇总：对项目排行累加总新增/总删除，净增 = 新增 − 删除 */
const summary = computed(() => {
  const added = props.projectRanking.reduce((s, r) => s + r.added, 0)
  const deleted = props.projectRanking.reduce((s, r) => s + r.deleted, 0)
  return { added, deleted, net: added - deleted }
})

/** 净增行语义色：正→success(绿)，负→error(红)，零→中性（灰） */
function netClass(net: number): string {
  if (net > 0) return "gls-net--pos"
  if (net < 0) return "gls-net--neg"
  return "gls-net--zero"
}

function onCountChange(e: Event) {
  emit("updateCount", Number((e.target as HTMLSelectElement).value))
}
</script>

<style lang="scss">
@use "../../styles/LineStatsPanel.scss";
@use "../../styles/index.scss";
</style>
