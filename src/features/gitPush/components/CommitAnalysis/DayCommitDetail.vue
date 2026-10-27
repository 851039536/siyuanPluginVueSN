<!-- gitPush 提交分析当日明细（点击热力图/日历格子后就地展开：当日提交列表 + 计数摘要，行可跳转列表视图） -->
<template>
  <div class="gpa-day">
    <div class="gpa-day-head">
      <!-- 日期 + 星期（与格子的 hover 文案同源口径） -->
      <span class="gpa-day-date">{{ date }} · {{ weekdayText }}</span>
      <span class="gpa-day-summary">{{ summaryText }}</span>
      <!-- 关闭入口（ghost 图标按钮，title 兼作可访问名） -->
      <Button
        class="gpa-day-close"
        variant="ghost"
        size="xsmall"
        dense
        icon="close"
        :title="i18n.analysisDayDetailClose"
        @click="emit('close')"
      />
    </div>

    <!-- 空态：该日无提交（允许选中「空白日」，用户才能确认「这天确实没干活」） -->
    <p
      v-if="rows.length === 0"
      class="gpa-day-empty"
    >{{ i18n.analysisDayDetailEmpty }}</p>

    <!-- 当日提交列表（按时间正序；整行可点击跳转对应项目的列表视图） -->
    <div
      v-else
      class="gpa-day-list"
    >
      <button
        v-for="r in rows"
        :key="r.hash"
        type="button"
        class="gpa-day-row"
        :title="`${r.message}\n\n${i18n.analysisDayDetailAction}`"
        @click="emit('viewProject', r.projectId)"
      >
        <span class="gpa-day-time">{{ r.time }}</span>
        <span class="gpa-day-proj">{{ r.projectName }}</span>
        <span class="gpa-day-msg">{{ r.message }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
// gitPush 提交分析当日明细：只做「按日过滤结果的展示」——过滤与选中状态由 HeatmapCalendarSection 持有
import type { CommitAnalysisEntry } from "../../types"
import { computed } from "vue"
import Button from "@/components/Button.vue"
import { ANALYSIS_WEEKDAY_KEYS } from "../../types"

const props = defineProps<{
  i18n: Record<string, any>
  /** 选中日期（YYYY-MM-DD） */
  date: string
  /** 该日的提交条目（父级已按日过滤，本组件只排序与格式化） */
  entries: CommitAnalysisEntry[]
}>()

const emit = defineEmits<{
  close: []
  /** 行点击：跳转该条目所属项目的列表视图 */
  viewProject: [projectId: string]
}>()

interface DayCommitRow {
  hash: string
  projectId: string
  projectName: string
  /** 本地时间 HH:mm（git %aI 是带时区的 ISO，new Date 解析后取本地时分） */
  time: string
  /** 提交信息首行（多行 body 不进列表，hover 也不展示以避免长文撑爆 tooltip） */
  message: string
}

/** 列表行：按提交时间正序（同一天内自上而下＝时间推进），message 只取首行 */
const rows = computed<DayCommitRow[]>(() =>
  [...props.entries]
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
    .map((e) => {
      const t = new Date(e.date)
      const time = Number.isNaN(t.getTime())
        ? "—"
        : `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`
      return {
        hash: e.hash,
        projectId: e.projectId,
        projectName: e.projectName,
        time,
        message: (e.message || "").split("\n")[0],
      }
    }),
)

/** 星期文案（按日期文本解析，避免 UTC 解析在西半球时区跨日偏移） */
const weekdayText = computed(() => {
  const [y, m, d] = props.date.split("-").map(Number)
  if (!y || !m || !d) return ""
  return props.i18n[ANALYSIS_WEEKDAY_KEYS[new Date(y, m - 1, d).getDay()]] || ""
})

/** 摘要："7 次提交 · 2 个项目 · 2 位作者"（作者按邮箱前的姓名去重，与列表展示口径一致） */
const summaryText = computed(() => {
  const projects = new Set(props.entries.map((e) => e.projectId))
  const authors = new Set(props.entries.map((e) => e.author))
  return String(props.i18n.analysisDayDetailSummary || "")
    .replace("{0}", String(props.entries.length))
    .replace("{1}", String(projects.size))
    .replace("{2}", String(authors.size))
})
</script>

<style lang="scss">
@use "../../styles/DayCommitDetail.scss";
@use "../../styles/index.scss";
</style>
