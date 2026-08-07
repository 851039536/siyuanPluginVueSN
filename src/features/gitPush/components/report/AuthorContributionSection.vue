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

    <!-- 作者排行表（HTML table 布局：跨行列宽强制一致，数字列按内容自适应） -->
    <div
      v-else
      class="gpr-table-wrap"
    >
      <table class="gpr-author-table">
        <thead>
          <tr>
            <!-- 表头："作者" -->
            <th class="gpr-author-th">{{ i18n.projectName }}</th>
            <!-- 表头："提交次数" -->
            <th class="gpr-author-th gpr-author-th--num">{{ i18n.reportCommitsCol }}</th>
            <!-- 表头："新增行数" -->
            <th class="gpr-author-th gpr-author-th--num">{{ i18n.reportLinesCol }}</th>
            <!-- 表头："净增行数" -->
            <th class="gpr-author-th gpr-author-th--num">{{ i18n.reportNetCol }}</th>
            <!-- 表头："平均提交大小" -->
            <th class="gpr-author-th gpr-author-th--num">{{ i18n.reportAvgSizeCol }}</th>
            <!-- 表头："提交频率" -->
            <th class="gpr-author-th gpr-author-th--num">{{ i18n.reportFrequencyCol }}</th>
            <!-- 表头："涉及文件数" -->
            <th class="gpr-author-th gpr-author-th--num">{{ i18n.reportFilesCol }}</th>
            <!-- 表头："质量评分" -->
            <th class="gpr-author-th gpr-author-th--num">{{ i18n.reportQualityCol }}</th>
            <!-- 表头："活跃天数" -->
            <th class="gpr-author-th gpr-author-th--num">{{ i18n.reportActiveDaysCol }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="a in authors"
            :key="a.author"
            class="gpr-author-row"
          >
            <!-- 作者名（超长省略，完整名悬停可见） -->
            <td
              class="gpr-author-cell gpr-author-cell--name"
              :title="a.author"
            >{{ a.author }}</td>
            <!-- 提交次数 -->
            <td class="gpr-author-cell gpr-author-cell--num">{{ a.commits }}</td>
            <!-- 新增行数 -->
            <td class="gpr-author-cell gpr-author-cell--num">{{ a.linesAdded }}</td>
            <!-- 净增行数（正负着色：+ 绿色 / - 红色） -->
            <td
              class="gpr-author-cell gpr-author-cell--num"
              :class="netClass(a.netLines)"
            >{{ formatNet(a.netLines) }}</td>
            <!-- 平均提交大小 -->
            <td class="gpr-author-cell gpr-author-cell--num">{{ a.avgCommitSize }}</td>
            <!-- 提交频率 -->
            <td class="gpr-author-cell gpr-author-cell--num">{{ a.frequency }}</td>
            <!-- 涉及文件数 -->
            <td class="gpr-author-cell gpr-author-cell--num">{{ a.filesTouched }}</td>
            <!-- 质量评分：分数 + 等级徽章 + 星级 -->
            <td class="gpr-author-cell gpr-author-cell--num">
              <span
                class="gpr-grade-chip"
                :style="{ color: GRADE_META[a.grade].color }"
              >{{ a.quality }}/100 [{{ i18n[GRADE_META[a.grade].labelKey] }}级]</span>
              <span
                class="gpr-stars"
                :title="String(a.quality)"
              >{{ "★".repeat(GRADE_META[a.grade].stars) }}</span>
            </td>
            <!-- 活跃天数 -->
            <td class="gpr-author-cell gpr-author-cell--num">{{ a.activeDays }}</td>
          </tr>
        </tbody>
      </table>
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
