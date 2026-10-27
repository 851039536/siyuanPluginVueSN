<!-- gitPush 提交分析区间统计（框选一段日期后就地展开：总量 / 活跃天数 / 最活跃一天 / 项目与作者分布） -->
<template>
  <div class="gpa-range">
    <div class="gpa-range-head">
      <!-- 区间起止 + 跨度（"14 天" 含无提交日，与条数口径区分开） -->
      <span class="gpa-range-span">{{ selStart }} → {{ selEnd }}</span>
      <span class="gpa-range-days">{{ spanText }}</span>
      <!-- 关闭入口（ghost 图标按钮，title 兼作可访问名） -->
      <Button
        class="gpa-range-close"
        variant="ghost"
        size="xsmall"
        dense
        icon="close"
        :title="i18n.analysisRangeDetailClose"
        @click="emit('close')"
      />
    </div>

    <!-- 空态：区间内一次提交都没有（仍展示区间本身，用户才能确认框对了范围） -->
    <p
      v-if="summary.total === 0"
      class="gpa-range-empty"
    >{{ i18n.analysisRangeDetailEmpty }}</p>

    <template v-else>
      <!-- 汇总行：提交数 / 活跃天数 / 日均 / 项目数 / 作者数 -->
      <div class="gpa-range-stats">
        <span
          v-for="s in statItems"
          :key="s.label"
          class="gpa-range-stat"
        >
          <span class="gpa-range-stat-val">{{ s.value }}</span>
          <span class="gpa-range-stat-key">{{ s.label }}</span>
        </span>
      </div>

      <!-- 最活跃一天：点击可直接钻到该日明细 -->
      <button
        v-if="summary.busiest"
        type="button"
        class="gpa-range-busiest"
        :title="i18n.analysisRangeBusiestHint"
        @click="emit('pickDay', summary.busiest.date)"
      >
        {{ busiestText }}
      </button>

      <!-- 双列分布（窄面板自动降为单列）：项目 / 作者 各取前三 -->
      <div class="gpa-range-cols">
        <div class="gpa-range-col">
          <span class="gpa-range-col-title">{{ i18n.analysisRangeDetailProjects }}</span>
          <div
            v-for="r in projectRows"
            :key="r.key"
            class="gpa-range-row"
            :title="r.name"
          >
            <span class="gpa-range-row-name">{{ r.name }}</span>
            <span class="gpa-range-row-num">{{ r.count }}</span>
          </div>
        </div>
        <div class="gpa-range-col">
          <span class="gpa-range-col-title">{{ i18n.analysisRangeDetailAuthors }}</span>
          <div
            v-for="r in authorRows"
            :key="r.key"
            class="gpa-range-row"
            :title="r.name"
          >
            <span class="gpa-range-row-name">{{ r.name }}</span>
            <span class="gpa-range-row-num">{{ r.count }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
// gitPush 提交分析区间统计：只做展示——区间与条目由 HeatmapCalendarSection 计算后传入
import type { CommitAnalysisEntry } from "../../types"
import type { CommitRangeSummary } from "../../utils"
import { computed } from "vue"
import Button from "@/components/Button.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 区间起止（YYYY-MM-DD，已归一化为 start ≤ end） */
  selStart: string
  selEnd: string
  /** 区间聚合结果（utils.summarizeCommitRange 产出） */
  summary: CommitRangeSummary
  /** 区间内条目（仅用于把 projectId 解析成项目名） */
  entries: CommitAnalysisEntry[]
}>()

const emit = defineEmits<{
  close: []
  /** 点击「最活跃一天」：父级把选中收缩到该日（切回当日明细） */
  pickDay: [date: string]
}>()

/** 区间跨度文案（"14 天"；含无提交日，与"活跃天数"并列才能看出摸鱼比例） */
const spanText = computed(() =>
  String(props.i18n.analysisRangeDetailSpan || "").replace("{0}", String(props.summary.daySpan)),
)

/** 汇总项：值的单位放在标签里（"次提交"），避免每格再拼一次量词 */
const statItems = computed(() => {
  const s = props.summary
  const t = props.i18n
  const daily = s.daySpan > 0 ? (s.total / s.daySpan).toFixed(1) : "0"
  return [
    { key: "commits", value: s.total.toLocaleString(), label: t.analysisRangeStatCommits || "" },
    { key: "active", value: String(s.activeDays), label: t.analysisRangeStatActiveDays || "" },
    { key: "daily", value: daily, label: t.analysisRangeStatDaily || "" },
    { key: "projects", value: String(s.projectCount), label: t.analysisRangeStatProjects || "" },
    { key: "authors", value: String(s.authorCount), label: t.analysisRangeStatAuthors || "" },
  ]
})

/** 最活跃一天文案："最活跃 2026-08-05（9 次）" */
const busiestText = computed(() => {
  const b = props.summary.busiest
  if (!b) return ""
  return String(props.i18n.analysisRangeDetailBusiest || "")
    .replace("{0}", b.date)
    .replace("{1}", String(b.count))
})

/** projectId → 项目名（项目可能已删除，回退 id 本身，与项目排行同口径） */
const nameById = computed(() => {
  const map = new Map<string, string>()
  for (const e of props.entries) map.set(e.projectId, e.projectName || e.projectId)
  return map
})

const projectRows = computed(() =>
  props.summary.topProjects.map((r) => ({ key: r.key, count: r.count, name: nameById.value.get(r.key) || r.key })),
)

/** 作者名：git 的 author 已是"姓名"，直接用（不额外截邮箱，与当日明细列表一致） */
const authorRows = computed(() =>
  props.summary.topAuthors.map((r) => ({ key: r.key, count: r.count, name: r.key })),
)
</script>

<style lang="scss">
@use "../../styles/RangeCommitDetail.scss";
@use "../../styles/index.scss";
</style>
