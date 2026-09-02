<!-- gitPush 行数统计项目代码行数排行区块（表头 + 条形 + 数字列 + 总行数列，行可点击打开详情弹窗） -->
<template>
  <div class="gls-section">
    <!-- 区块标题："项目代码行数排行" -->
    <div class="gls-section-title">
      {{ i18n.analysisLineProjectRanking }}
    </div>
    <div class="gls-bar-list">
      <!-- 表头行："新增 / 删除 / 净增 / 占比 / 总行数"（净增加粗主题色 = 实际行数，悬停见说明） -->
      <div class="gls-bar-head">
        <span class="gls-bar-rank"></span>
        <span class="gls-bar-label"></span>
        <span class="gls-bar-track"></span>
        <span class="gls-line-nums">
          <!-- 表头列："新增"（绿色） -->
          <span class="gls-line-num gls-line-num--add">{{ i18n.analysisLineAdded }}</span>
          <!-- 表头列："删除"（红色） -->
          <span class="gls-line-num gls-line-num--del">{{ i18n.analysisLineDeleted }}</span>
          <!-- 表头列："净增"（主题色强调，tooltip："净增 = 实际行数（新增 − 删除）"） -->
          <span
            class="gls-line-num gls-line-num--net gls-bar-head-net"
            :title="i18n.lineStatsNetHint"
          >{{ i18n.analysisLineNet }}</span>
        </span>
        <!-- 表头列："占比"（净增绝对值占比，tooltip 说明口径） -->
        <span
          class="gls-bar-share"
          :title="i18n.lineStatsShareHint"
        >{{ i18n.lineDetailShare }}</span>
        <!-- 表头列："总行数"（存量，等宽右对齐，tooltip 说明口径） -->
        <span
          class="gls-line-total"
          :title="i18n.lineStatsTotalHint"
        >{{ i18n.analysisLineTotal }}</span>
      </div>
      <div
        v-for="(row, idx) in rows"
        :key="row.id"
        class="gls-bar-row gls-bar-row--clickable"
        :title="i18n.lineDetailClickHint"
        @click="emit('viewProject', row.id)"
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
        <!-- 占比列：净增绝对值占总净增绝对值的百分比（与排序同口径） -->
        <span class="gls-bar-share">{{ row.share }}</span>
        <!-- 总行数列：当前实际行数（存量，等宽右对齐中性色；旧缓存缺失时显示 —） -->
        <span class="gls-line-total">{{ row.totalLines?.toLocaleString() ?? "—" }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// gitPush 行数统计项目代码行数排行区块（表头 + 条形 + 数字列，行点击打开详情弹窗）
import type { ProjectLineRankItem } from "../../types"
import { computed } from "vue"
import { netClass as sharedNetClass, withLineBarPct } from "../../utils"

const props = defineProps<{
  i18n: Record<string, any>
  /** 项目代码行数排行（按净增降序） */
  projectRanking: ProjectLineRankItem[]
}>()

const emit = defineEmits<{
  viewProject: [projectId: string]
}>()

/** 行视图（pct=相对最大净增绝对值的条形宽度，share=净增绝对值占比，与净增排序同口径） */
const rows = computed(() => withLineBarPct(props.projectRanking))

/** 净增行语义色（薄委托共享 netClass，前缀 gls-net，保持模板调用点零改动） */
function netClass(net: number): string {
  return sharedNetClass(net, "gls-net")
}
</script>

<style lang="scss">
@use "../../styles/LineStatsPanel.scss";
@use "../../styles/index.scss";
</style>
