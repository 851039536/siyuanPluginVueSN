<!-- gitPush 项目/作者提交排行（横向进度条行：长度=相对榜首，颜色=名次色；项目行点击跳转列表视图） -->
<template>
  <div class="gpa-section gpa-section--scroll">
    <!-- 区块标题：项目/作者内联切换（同一区块共享限高滚动区，不新增页面高度） -->
    <div class="gpa-section-title">
      {{ title }}
      <SectionTabs
        v-model="mode"
        class="gpa-rank-mode"
        :items="modeItems"
        :aria-label="title"
      />
      <!-- 截断提示：不加会让各行次数之和小于顶部「总提交次数」，看起来像统计出错 -->
      <span
        v-if="truncatedHint"
        class="gpa-rank-hint"
        :title="truncatedHint"
      >{{ truncatedHint }}</span>
    </div>
    <div class="gpa-rank-list">
      <!-- 项目模式：行即按钮（点击跳列表视图）；作者模式：静态行（本轮不做作者筛选） -->
      <template v-if="mode === 'project'">
        <Button
          v-for="(row, i) in rows"
          :key="row.id"
          class="gpa-rank-row"
          variant="ghost"
          size="xsmall"
          dense
          :title="row.title"
          :style="rowStyle(row)"
          @click="emit('viewProject', row.id)"
        >
          <span
            class="gpa-rank-bar"
            aria-hidden="true"
          />
          <span
            class="gpa-rank-no"
            :class="{ 'gpa-rank-no--top': i < 3 }"
          >{{ i + 1 }}</span>
          <span
            class="gpa-rank-dot"
            aria-hidden="true"
          />
          <span class="gpa-rank-name">{{ row.name }}</span>
          <span class="gpa-rank-count">{{ row.count }}</span>
          <span class="gpa-rank-share">{{ row.shareText }}</span>
        </Button>
      </template>
      <template v-else>
        <div
          v-for="(row, i) in rows"
          :key="row.id"
          class="gpa-rank-row gpa-rank-row--static"
          :title="row.title"
          :style="rowStyle(row)"
        >
          <span
            class="gpa-rank-bar"
            aria-hidden="true"
          />
          <span
            class="gpa-rank-no"
            :class="{ 'gpa-rank-no--top': i < 3 }"
          >{{ i + 1 }}</span>
          <span
            class="gpa-rank-dot"
            aria-hidden="true"
          />
          <span class="gpa-rank-name">{{ row.name }}</span>
          <span class="gpa-rank-count">{{ row.count }}</span>
          <span class="gpa-rank-share">{{ row.shareText }}</span>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
// gitPush 提交排行（项目/作者双模式）：范围内条目 → 横向进度条行（条宽按榜首归一，颜色按名次分配）。
// 作者模式复用 rankByCountWithTotal（同名作者跨项目合并计数），口径与 KPI/趋势/热力图同源。
// 刻意不用饼图（20 项不可读）与竖向柱（占高度且项目名要旋转）；条宽写百分比变量，不做 calc 乘法。
import type { CommitAnalysisEntry } from "../../types"
import type { SectionTabItem } from "../common/sectionTabs"
import { computed, ref } from "vue"
import Button from "@/components/Button.vue"
import SectionTabs from "../common/SectionTabs.vue"
import {
  PROJECT_COMMIT_COLORS,
  PROJECT_RANK_LIMIT,
  rankByCountWithTotal,
  rankProjectsWithColors,
} from "../../utils"

/** 排行维度（项目 / 作者） */
type RankMode = "project" | "author"

const props = defineProps<{
  i18n: Record<string, any>
  /** 已按显示范围裁剪的提交条目（排行与趋势图同源） */
  entries: CommitAnalysisEntry[]
}>()

const emit = defineEmits<{
  viewProject: [projectId: string]
}>()

/** 当前排行维度（组件内状态，不持久化：默认项目维度） */
const mode = ref<RankMode>("project")

const modeItems = computed<SectionTabItem<RankMode>[]>(() => [
  { id: "project", label: props.i18n.analysisRankModeProject, icon: "folderOutline" },
  { id: "author", label: props.i18n.analysisRankModeAuthor, icon: "accountGroup" },
])

const title = computed(() =>
  mode.value === "project" ? props.i18n.analysisProjectRanking : props.i18n.analysisAuthorRanking,
)

/** 百分比格式化：保留 1 位小数并去掉尾零；极小占比显示 <0.1% 避免误导 */
function formatShare(share: number): string {
  if (share > 0 && share < 0.1) return "<0.1%"
  return `${share.toFixed(1).replace(/\.0$/, "")}%`
}

/** 排行行（两种维度同形；id 兼作键与跳转目标——作者模式不跳转） */
interface RankRow {
  id: string
  name: string
  count: number
  color: string
  pct: string
  shareText: string
  title: string
}

/** 排行结果：次数 + 占总提交百分比 + 相对榜首条宽 + 按名次分配的色板 */
const ranking = computed<{ totalGroups: number, rows: RankRow[] }>(() => {
  const total = props.entries.length || 1
  let raw: { id: string, name: string, count: number, color: string }[]
  let totalGroups: number
  if (mode.value === "project") {
    const ranked = rankProjectsWithColors(props.entries, PROJECT_RANK_LIMIT)
    raw = ranked.rows
    totalGroups = ranked.totalGroups
  } else {
    const ranked = rankByCountWithTotal(props.entries, (e) => e.author, PROJECT_RANK_LIMIT)
    // 与项目模式一致：色板按名次分配，保证 Top 10 异色
    raw = ranked.rows.map((r, i) => ({
      id: r.key,
      name: r.key,
      count: r.count,
      color: PROJECT_COMMIT_COLORS[i % PROJECT_COMMIT_COLORS.length],
    }))
    totalGroups = ranked.totalGroups
  }
  const max = raw[0]?.count || 1
  return {
    totalGroups,
    rows: raw.map((r) => {
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

/** 行样式：条宽百分比与名次色通过 CSS 变量传给行内进度条 */
function rowStyle(row: RankRow): Record<string, string> {
  return {
    "--gpa-rank-pct": row.pct,
    "--gpa-rank-color": row.color,
  }
}

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
