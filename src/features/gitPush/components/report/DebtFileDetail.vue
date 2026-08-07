<!-- gitPush 技术债务文件详情面板：展开行时加载 LOC（懒读取）+ 趋势推断解释 + 近期共变文件列表 -->
<template>
  <div class="gpr-debt-detail">
    <!-- 指标网格：代码行数（懒加载）/ 修改次数 / 参与人数 / 最后修改 -->
    <div class="gpr-debt-detail-grid">
      <!-- 代码行数（展开时按需读取；读取失败或不可读显示占位符 -） -->
      <div class="gpr-debt-detail-cell">
        <span class="gpr-debt-detail-label">{{ i18n.reportLinesCol }}</span>
        <span class="gpr-debt-detail-value">{{ locText }}</span>
      </div>
      <div class="gpr-debt-detail-cell">
        <span class="gpr-debt-detail-label">{{ i18n.reportModsCol }}</span>
        <span class="gpr-debt-detail-value">{{ row.modCount }}</span>
      </div>
      <div class="gpr-debt-detail-cell">
        <span class="gpr-debt-detail-label">{{ i18n.reportAuthorsCol }}</span>
        <span class="gpr-debt-detail-value">{{ row.authorCount }}</span>
      </div>
      <div class="gpr-debt-detail-cell">
        <span class="gpr-debt-detail-label">{{ i18n.reportLastModifiedCol }}</span>
        <span class="gpr-debt-detail-value">{{ row.lastModified ? relativeTime(row.lastModified, i18n) : "-" }}</span>
      </div>
    </div>

    <!-- 趋势推断区（颜色 = 趋势方向，箭头 + 文案；悬停提示推断依据） -->
    <div
      class="gpr-debt-trend"
      :style="{ borderColor: DEBT_TREND_META[trend].color }"
      :title="i18n.reportDebtTrendHint"
    >
      <span
        class="gpr-debt-trend-arrow"
        :style="{ color: DEBT_TREND_META[trend].color }"
      >{{ DEBT_TREND_META[trend].arrow }}</span>
      <span
        class="gpr-debt-trend-text"
        :style="{ color: DEBT_TREND_META[trend].color }"
      >{{ i18n[DEBT_TREND_META[trend].labelKey] }}</span>
    </div>

    <!-- 近期共变文件区块 -->
    <div class="gpr-debt-coupling">
      <!-- 区块标题 + 启发式说明 -->
      <div class="gpr-debt-coupling-title">
        {{ i18n.reportDebtCouplingTitle }}
        <span class="gpr-debt-coupling-hint">{{ i18n.reportDebtCouplingHint }}</span>
      </div>
      <!-- 空态：无共变文件 -->
      <div
        v-if="coupled.length === 0"
        class="gpr-debt-coupling-empty"
      >{{ i18n.reportDebtCouplingEmpty }}</div>
      <!-- 共变文件列表（路径 + 修改次数 + 严重度色点） -->
      <div
        v-for="c in coupled"
        :key="c.path"
        class="gpr-debt-coupling-item"
        :title="c.path"
      >
        <span
          class="gpr-debt-coupling-dot"
          :style="{ background: DEBT_SEVERITY_META[c.severity].color }"
        />
        <span class="gpr-debt-coupling-path">{{ c.path }}</span>
        <span class="gpr-debt-coupling-mods">{{ c.modCount }}</span>
        <span class="gpr-debt-coupling-score">{{ c.riskScore }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 技术债务文件详情面板：LOC 懒加载 + 趋势解释 + 近期共变列表（展开行时挂载，onMounted 触发懒读取）
import type { DebtFileRow, GitProject } from "../../types"
import { computed, onMounted, ref } from "vue"
import { DEBT_SEVERITY_META } from "../../types"
import { countFileLines } from "../../reportMetrics"
import { DEBT_TREND_META, inferDebtTrend } from "../../composables/useDebtInsights"
import type { CoupledFile } from "../../composables/useDebtInsights"
import { relativeTime } from "../../utils"

const props = defineProps<{
  i18n: Record<string, any>
  /** 当前项目实例（LOC 懒加载需要 resolveValidPath） */
  project: GitProject | null
  /** 当前债务文件行 */
  row: DebtFileRow
  /** 近期共变文件列表（父组件预计算的耦合映射） */
  coupled: CoupledFile[]
}>()

/** 代码行数：初始取报告预加载值，为 null 时展开行内懒读取（不可读/超限保持 null → 占位符 -） */
const loc = ref<number | null>(props.row.loc)

// 展开行挂载后懒加载 LOC（仅当报告未预读且项目可用时；countFileLines 为同步 fs 读取，2MB 上限）
onMounted(() => {
  if (loc.value === null && props.project) {
    loc.value = countFileLines(props.project, props.row.path)
  }
})

/** LOC 展示文本（null → 占位符 -） */
const locText = computed(() => (loc.value === null ? "-" : String(loc.value)))

/** 趋势方向（由 lastModified 距今天数 + 修改次数推断） */
const trend = computed(() => inferDebtTrend(props.row))
</script>

<style lang="scss">
@use "../../styles/DebtFileDetail.scss";
@use "../../styles/index.scss";
</style>
