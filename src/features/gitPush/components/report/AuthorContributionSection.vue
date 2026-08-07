<!-- gitPush 代码统计报告：代码贡献度分区（作者排行表：提交/行数/净增/平均大小/频率/文件/质量评分/活跃天数） -->
<template>
  <div class="gpr-section">
    <!-- 区块标题："代码贡献度" + 行数徽章 -->
    <div class="gpr-section-title">
      {{ i18n.reportAuthorsTitle }}
      <span class="gpr-section-count">{{ authors.length }}</span>
    </div>

    <!-- 空状态：范围内无提交 -->
    <EmptyState
      v-if="authors.length === 0"
      icon="mdi:account-details"
      :text="i18n.reportNoData"
    />

    <!-- 作者排行表 -->
    <div
      v-else
      class="gpr-table-wrap"
    >
      <div class="gpr-row gpr-row--head">
        <span class="gpr-cell gpr-cell--name">{{ i18n.projectName }}</span>
        <span class="gpr-cell gpr-cell--num">{{ i18n.reportCommitsCol }}</span>
        <span class="gpr-cell gpr-cell--num">{{ i18n.reportLinesCol }}</span>
        <span class="gpr-cell gpr-cell--num">{{ i18n.reportNetCol }}</span>
        <span class="gpr-cell gpr-cell--num">{{ i18n.reportAvgSizeCol }}</span>
        <span class="gpr-cell gpr-cell--num">{{ i18n.reportFrequencyCol }}</span>
        <span class="gpr-cell gpr-cell--num">{{ i18n.reportFilesCol }}</span>
        <span class="gpr-cell gpr-cell--num gpr-cell--wider">{{ i18n.reportQualityCol }}</span>
        <span class="gpr-cell gpr-cell--num">{{ i18n.reportActiveDaysCol }}</span>
      </div>
      <div
        v-for="a in authors"
        :key="a.author"
        class="gpr-row"
      >
        <span
          class="gpr-cell gpr-cell--name"
          :title="a.author"
        >{{ a.author }}</span>
        <span class="gpr-cell gpr-cell--num">{{ a.commits }}</span>
        <span class="gpr-cell gpr-cell--num">{{ a.linesAdded }}</span>
        <!-- 净增列：正负着色（+ 绿色 / - 红色） -->
        <span
          class="gpr-cell gpr-cell--num gpr-cell--net"
          :class="netClass(a.netLines)"
        >{{ formatNet(a.netLines) }}</span>
        <span class="gpr-cell gpr-cell--num">{{ a.avgCommitSize }}</span>
        <span class="gpr-cell gpr-cell--num">{{ a.frequency }}</span>
        <span class="gpr-cell gpr-cell--num">{{ a.filesTouched }}</span>
        <!-- 质量评分列：分数 + 等级徽章 + 星级 -->
        <span class="gpr-cell gpr-cell--num gpr-cell--wider">
          <span
            class="gpr-grade-chip"
            :style="{ color: GRADE_META[a.grade].color }"
          >{{ a.quality }}/100 [{{ i18n[GRADE_META[a.grade].labelKey] }}级]</span>
          <span
            class="gpr-stars"
            :title="String(a.quality)"
          >{{ "★".repeat(GRADE_META[a.grade].stars) }}</span>
        </span>
        <span class="gpr-cell gpr-cell--num">{{ a.activeDays }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 代码贡献度分区：作者排行表（按提交次数降序，质量列含等级徽章 + 星级）
import type { AuthorReportRow } from "../../types"
import { GRADE_META } from "../../types"
import EmptyState from "../common/EmptyState.vue"

defineProps<{
  i18n: Record<string, any>
  /** 作者排行（按提交次数降序） */
  authors: AuthorReportRow[]
}>()

/** 净增列正负着色：正数绿色 / 负数红色 / 零中性 */
function netClass(n: number): string {
  if (n > 0) return "gpr-cell--pos"
  if (n < 0) return "gpr-cell--neg"
  return ""
}

/** 净增格式化：正数带 + 前缀便于视觉区分 */
function formatNet(n: number): string {
  return n > 0 ? `+${n}` : String(n)
}
</script>

<style lang="scss">
@use "../../styles/AuthorContributionSection.scss";
@use "../../styles/index.scss";
</style>
