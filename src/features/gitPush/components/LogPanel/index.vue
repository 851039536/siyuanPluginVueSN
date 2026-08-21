<!-- gitPush 操作日志视图入口容器（筛选/分页/日期分组状态编排 + 区块组合，纯编排无领域状态） -->
<template>
  <div class="gp-log-panel">
    <!-- 加载中占位 -->
    <EmptyState
      v-if="loading && logs.length === 0"
      icon="mdi:loading"
      :text="i18n.loading"
      spin
    />

    <!-- 空状态 -->
    <EmptyState
      v-else-if="logs.length === 0"
      icon="mdi:history"
      :text="i18n.noOpLogs"
    />

    <template v-else>
      <!-- 状态统计条（基于全量日志，与筛选解耦） -->
      <LogStatsBar :stats="stats" />

      <!-- 顶部工具条（搜索 + 类型筛选 + 仅失败 + 清空） -->
      <LogToolbar
        v-model:search-query="searchQuery"
        v-model:active-filter="activeFilter"
        v-model:fail-only="failOnly"
        :i18n="i18n"
        :filtered-count="filteredLogs.length"
        @clear="emit('clear')"
      />

      <!-- 筛选后无匹配结果 -->
      <EmptyState
        v-if="filteredLogs.length === 0"
        icon="mdi:filter"
        :text="i18n.logNoMatch"
      />

      <!-- 日志表格（日期分组） -->
      <LogTable
        v-else
        :i18n="i18n"
        :groups="groupedLogs"
        @open-detail="selectedEntry = $event"
        @view-project="emit('viewProject', $event)"
      />

      <!-- 加载更多 -->
      <LoadMoreButton
        v-if="pagedHasMore"
        :i18n="i18n"
        :visible="pagedVisibleCount"
        :total="filteredLogs.length"
        @load-more="pagedLoadMore"
      />

      <!-- 条目详情弹窗（点击日志条目打开） -->
      <LogDetailDialog
        :i18n="i18n"
        :entry="selectedEntry"
        @close="selectedEntry = null"
        @view-project="emit('viewProject', $event)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
// gitPush 操作日志视图入口容器（筛选/分页/日期分组状态编排 + 区块组合）
import type { GitOpLogEntry } from "../../types"
import { computed, ref, watch } from "vue"
import { usePagedList } from "../../composables/usePagedList"
import { formatLocalDate, logActionLabel } from "../../utils"
import EmptyState from "../common/EmptyState.vue"
import LoadMoreButton from "../common/LoadMoreButton.vue"
import LogDetailDialog from "./LogDetailDialog.vue"
import LogStatsBar, { type LogStatItem } from "./LogStatsBar.vue"
import LogTable, { type LogDateGroup } from "./LogTable.vue"
import LogToolbar from "./LogToolbar.vue"

const props = defineProps<{
  i18n: Record<string, any>
  logs: GitOpLogEntry[]
  loading?: boolean
}>()

const emit = defineEmits<{
  clear: []
  viewProject: [projectId: string]
}>()

// ── 筛选状态（工具条 defineModel 双向绑定）──
const activeFilter = ref("all")
const failOnly = ref(false)
const searchQuery = ref("")

/**
 * 三层过滤链：项目搜索 → 操作类型 → 仅失败（AND 叠加）
 * 全部在 computed 惰性求值，300 条上限下无性能瓶颈
 */
const filteredLogs = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return props.logs.filter((e) => {
    if (q && !e.projectName.toLowerCase().includes(q)) return false
    if (activeFilter.value !== "all" && e.action !== activeFilter.value) return false
    if (failOnly.value && e.ok) return false
    return true
  })
})

/** 状态统计条：按操作类型聚合成功/失败数（基于全量日志，一次遍历完成） */
const stats = computed<LogStatItem[]>(() => {
  const acc: Record<string, { ok: number; fail: number }> = {
    push: { ok: 0, fail: 0 },
    pull: { ok: 0, fail: 0 },
    commit: { ok: 0, fail: 0 },
  }
  for (const e of props.logs) {
    const r = acc[e.action]
    if (r) { e.ok ? r.ok++ : r.fail++ }
  }
  return Object.entries(acc)
    .map(([key, { ok, fail }]) => ({ key, label: logActionLabel(key, props.i18n), ok, fail }))
    .filter((s) => s.ok + s.fail > 0)
})

/** 本地分页（usePagedList 消除与 CommitAnalysisPanel 的 visibleCount/slice 重复） */
const {
  visibleCount: pagedVisibleCount,
  paged: pagedLogs,
  hasMore: pagedHasMore,
  loadMore: pagedLoadMore,
  reset: pagedReset,
} = usePagedList(filteredLogs, 50)

/** 筛选/搜索条件变化时重置分页到首页，防止新结果集仍停留在旧页码 */
watch([activeFilter, failOnly, searchQuery], () => pagedReset())

/**
 * 日期分组：在分页结果之上按自然日聚合（pagedLogs 已按时间倒序，
 * 同一天条目必然连续，故单次遍历合并即可）
 */
const groupedLogs = computed<LogDateGroup[]>(() => {
  const groups: LogDateGroup[] = []
  for (const e of pagedLogs.value) {
    const key = dateKeyOf(e.time)
    const last = groups[groups.length - 1]
    if (last && last.dateKey === key) {
      last.entries.push(e)
    } else {
      groups.push({ dateKey: key, dateLabel: dateLabelOf(e.time), entries: [e] })
    }
  }
  return groups
})

/** 当前选中查看详情的日志条目（null 表示弹窗关闭） */
const selectedEntry = ref<GitOpLogEntry | null>(null)

/** 将 ISO 时间戳格式化为自然日键 YYYY-MM-DD */
function dateKeyOf(iso: string): string {
  try {
    return formatLocalDate(new Date(iso))
  } catch {
    return iso
  }
}

/** 分组标题：今天 / 昨天 / 完整日期（Date 对象比较，避免手动 pad 拼接） */
function dateLabelOf(iso: string): string {
  try {
    const d = new Date(iso)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const diff = Math.round((today.getTime() - target.getTime()) / 86400000)
    if (diff === 0) return props.i18n.logDateToday
    if (diff === 1) return props.i18n.logDateYesterday
    return dateKeyOf(iso)
  } catch {
    return iso
  }
}
</script>

<style lang="scss">
@use "../../styles/LogPanel.scss";
@use "../../styles/index.scss";
</style>
