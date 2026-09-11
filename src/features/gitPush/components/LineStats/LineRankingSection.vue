<!-- gitPush 行数统计项目代码行数排行区块（吸顶表头 + 共享排行行，行可键盘激活打开详情） -->
<template>
  <div class="gls-section">
    <!-- 区块标题："项目代码行数排行" -->
    <div class="gls-section-title">
      {{ i18n.analysisLineProjectRanking }}
    </div>
    <div class="lrr-list">
      <!-- 吸顶表头行："新增 / 删除 / 净增 / 占比 / 总行数"（净增加粗主题色 = 实际行数，悬停见说明）；
           列模板与数据行共用 styles/LineRankRow.scss 的 $_lrr-cols（跨行条形对齐硬约束） -->
      <div class="lrr-head">
        <span class="lrr-rank"></span>
        <span class="lrr-label"></span>
        <span class="lrr-track"></span>
        <span class="lrr-nums">
          <!-- 表头列："新增"（绿色） -->
          <span class="lrr-num lrr-num--add">{{ i18n.analysisLineAdded }}</span>
          <!-- 表头列："删除"（红色） -->
          <span class="lrr-num lrr-num--del">{{ i18n.analysisLineDeleted }}</span>
          <!-- 表头列："净增"（主题色强调，tooltip："净增 = 实际行数（新增 − 删除）"） -->
          <span
            class="lrr-num lrr-num--net lrr-head-net"
            :title="i18n.lineStatsNetHint"
          >{{ i18n.analysisLineNet }}</span>
        </span>
        <!-- 表头列："占比"（总行数占比，tooltip 说明口径） -->
        <span
          class="lrr-share"
          :title="i18n.lineStatsTotalShareHint"
        >{{ i18n.lineDetailShare }}</span>
        <!-- 表头列："总行数"（存量，等宽右对齐，tooltip 说明口径） -->
        <span
          class="lrr-total"
          :title="i18n.lineStatsTotalHint"
        >{{ i18n.analysisLineTotal }}</span>
      </div>
      <!-- 数据行：共享 LineRankRow（clickable 时根为原生 button，Tab 聚焦 + Enter/Space 打开详情） -->
      <LineRankRow
        v-for="(row, idx) in rows"
        :key="row.id"
        :rank="idx + 1"
        :label="row.name"
        :pct="row.pct"
        :share="row.share"
        :added="row.added"
        :deleted="row.deleted"
        :net="row.net"
        :total-lines="row.totalLines"
        clickable
        :i18n="i18n"
        @select="emit('viewProject', row.id)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
// gitPush 行数统计项目代码行数排行区块（吸顶表头 + 共享排行行）
import type { ProjectLineRankItem } from "../../types"
import { computed } from "vue"
import LineRankRow from "../common/LineRankRow.vue"
import { withLineBarPct } from "../../utils"

const props = defineProps<{
  i18n: Record<string, any>
  /** 项目代码行数排行（按总行数存量降序） */
  projectRanking: ProjectLineRankItem[]
}>()

const emit = defineEmits<{
  viewProject: [projectId: string]
}>()

/** 行视图（pct=相对最大总行数的条形宽度，share=总行数占比，与「按总行数降序」排序同口径） */
const rows = computed(() => withLineBarPct(props.projectRanking, (r) => r.totalLines ?? 0))
</script>

<style lang="scss">
@use "../../styles/LineStatsPanel.scss";
@use "../../styles/LineRankRow.scss";
@use "../../styles/index.scss";
</style>
