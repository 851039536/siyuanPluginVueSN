<!-- gitPush 项目提交排行（横向进度条行：长度=相对榜首，颜色=项目色；点击跳转列表视图） -->
<template>
  <div class="gpa-section gpa-section--scroll">
    <!-- 区块标题："项目提交排行"（数据层截断时补一行「仅显示前 N 名」） -->
    <div class="gpa-section-title">
      {{ i18n.analysisProjectRanking }}
      <!-- 截断提示：不加会让各行次数之和小于顶部「总提交次数」，看起来像统计出错 -->
      <span
        v-if="truncatedHint"
        class="gpa-rank-hint"
        :title="truncatedHint"
      >{{ truncatedHint }}</span>
    </div>
    <div class="gpa-rank-list">
      <Button
        v-for="(row, i) in rows"
        :key="row.id"
        class="gpa-rank-row"
        variant="ghost"
        size="xsmall"
        dense
        :title="row.title"
        :style="{
          '--gpa-rank-pct': row.pct,
          '--gpa-rank-color': row.color,
        }"
        @click="emit('viewProject', row.id)"
      >
        <!-- 底纹进度条：宽度=该项目次数 / 榜首次数（榜首满格，量级差异一眼可辨） -->
        <span
          class="gpa-rank-bar"
          aria-hidden="true"
        />
        <!-- 名次（前三名用项目色强调，其余弱化） -->
        <span
          class="gpa-rank-no"
          :class="{ 'gpa-rank-no--top': i < 3 }"
        >{{ i + 1 }}</span>
        <!-- 项目色点：与每日堆叠柱的图例同色，跨区块可对照 -->
        <span
          class="gpa-rank-dot"
          aria-hidden="true"
        />
        <!-- 项目名（自适应列宽，超长省略；完整名称与路径见 hover） -->
        <span class="gpa-rank-name">{{ row.name }}</span>
        <!-- 提交次数（等宽数字，纵向可比） -->
        <span class="gpa-rank-count">{{ row.count }}</span>
        <!-- 占比（等宽右对齐；tooltip 保留原始次数） -->
        <span class="gpa-rank-share">{{ row.shareText }}</span>
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
// gitPush 项目提交排行：范围内条目 → 横向进度条行（条宽按榜首归一，颜色按名次分配，与趋势图同序同色）。
// 刻意不用饼图（20 项不可读）与竖向柱（占高度且项目名要旋转）；条宽写百分比变量，不做 calc 乘法。
import type { CommitAnalysisEntry } from "../../types"
import { computed } from "vue"
import Button from "@/components/Button.vue"
import {
  PROJECT_RANK_LIMIT,
  rankProjectsWithColors,
} from "../../utils"

const props = defineProps<{
  i18n: Record<string, any>
  /** 已按显示范围裁剪的提交条目（排行与趋势图同源） */
  entries: CommitAnalysisEntry[]
}>()

const emit = defineEmits<{
  viewProject: [projectId: string]
}>()

/** 百分比格式化：保留 1 位小数并去掉尾零；极小占比显示 <0.1% 避免误导 */
function formatShare(share: number): string {
  if (share > 0 && share < 0.1) return "<0.1%"
  return `${share.toFixed(1).replace(/\.0$/, "")}%`
}

/** 排行结果：次数 + 占总提交百分比 + 相对榜首条宽 + 按名次分配的色板 */
const ranking = computed(() => {
  const {
    rows,
    totalGroups,
  } = rankProjectsWithColors(props.entries, PROJECT_RANK_LIMIT)
  const total = props.entries.length || 1
  const max = rows[0]?.count || 1
  return {
    totalGroups,
    rows: rows.map((r) => {
      const shareText = formatShare((r.count / total) * 100)
      return {
        ...r,
        pct: `${(r.count / max) * 100}%`,
        shareText,
        title: String(props.i18n.analysisShareTooltip || "")
          .replace("{0}", String(r.count))
          .replace("{1}", shareText),
      }
    }),
  }
})

const rows = computed(() => ranking.value.rows)

/**
 * 截断提示文案（未截断时为空串不渲染）。
 * 数据层按 PROJECT_RANK_LIMIT 截断，若此处不交代，用户会看到「各行次数之和 < 总提交次数」而误以为统计错误。
 */
const truncatedHint = computed(() => {
  const shown = ranking.value.rows.length
  const total = ranking.value.totalGroups
  if (total <= shown) return ""
  return String(props.i18n.analysisRankTruncated || "")
    .replace("{0}", String(shown))
    .replace("{1}", String(total))
})
</script>

<style lang="scss">
@use "../../styles/CommitAnalysisPanel.scss";
@use "../../styles/index.scss";
</style>
