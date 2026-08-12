<!-- Git 操作日志面板（推送/拉取/提交历史记录） -->
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
      <!-- 状态统计条：按操作类型聚合成功/失败计数（基于全量日志，与筛选解耦） -->
      <div
        v-if="stats.length"
        class="gp-log-stats"
      >
        <template
          v-for="(s, i) in stats"
          :key="s.key"
        >
          <!-- 单个操作类型统计："推送 12✓/2✗" -->
          <span class="gp-log-stat">
            <span class="gp-log-stat-label">{{ s.label }}</span>
            <span class="gp-log-stat-ok">{{ s.ok }}✓</span>
            <span
              v-if="s.fail > 0"
              class="gp-log-stat-fail"
            >{{ s.fail }}✗</span>
          </span>
          <!-- 类型间分隔圆点 -->
          <span
            v-if="i < stats.length - 1"
            class="gp-log-stat-sep"
          >·</span>
        </template>
      </div>

      <!-- 顶部工具条 -->
      <div class="gp-log-toolbar">
        <!-- 项目搜索框："搜索项目..." -->
        <div class="gp-log-search">
          <Icon
            icon="mdi:magnify"
            height="12"
          />
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="i18n.logSearchPlaceholder"
          />
        </div>
        <!-- 当前筛选结果条数："{0} 条记录" -->
        <span class="gp-log-count">{{ i18n.logCount.replace("{0}", filteredLogs.length) }}</span>
        <!-- 操作类型筛选 -->
        <div class="gp-log-filters">
          <button
            v-for="f in filters"
            :key="f.key"
            class="gp-log-filter-btn"
            :class="{ active: activeFilter === f.key }"
            @click="activeFilter = f.key"
          >
            {{ f.label }}
          </button>
          <!-- 仅失败快捷筛选（active 红色高亮） -->
          <button
            class="gp-log-filter-btn gp-log-filter-btn--fail"
            :class="{ active: failOnly }"
            :title="i18n.logFailOnlyTip"
            @click="failOnly = !failOnly"
          >
            <Icon
              icon="mdi:alert-circle-outline"
              height="12"
            />
            {{ i18n.logFailOnly }}
          </button>
        </div>
        <!-- 清空按钮 -->
        <button
          class="gp-log-clear-btn"
          :title="i18n.clearLogs"
          @click="emit('clear')"
        >
          <Icon
            icon="mdi:delete-outline"
            height="12"
          />
        </button>
      </div>

      <!-- 筛选后无匹配结果 -->
      <EmptyState
        v-if="filteredLogs.length === 0"
        icon="mdi:filter"
        :text="i18n.logNoMatch"
      />

      <!-- 日志表格 -->
      <div
        v-else
        class="gp-log-list"
      >
        <!-- 表头（滚动时 sticky 置顶） -->
        <div class="gp-log-thead">
          <!-- 表头："类型" -->
          <span class="gp-log-th gp-log-tcol--action">{{ i18n.logColType }}</span>
          <!-- 表头："状态" -->
          <span class="gp-log-th gp-log-tcol--status">{{ i18n.logColStatus }}</span>
          <!-- 表头："项目" -->
          <span class="gp-log-th gp-log-tcol--project">{{ i18n.logColProject }}</span>
          <!-- 表头："摘要" -->
          <span class="gp-log-th gp-log-tcol--summary">{{ i18n.logColSummary }}</span>
          <!-- 表头："时间" -->
          <span class="gp-log-th gp-log-tcol--time">{{ i18n.logColTime }}</span>
          <!-- 表头："操作" -->
          <span class="gp-log-th gp-log-tcol--ops">{{ i18n.logColOps }}</span>
        </div>

        <template
          v-for="group in groupedLogs"
          :key="group.dateKey"
        >
          <!-- 日期分组标题（分隔行）："今天"/"昨天"/"2026-08-10" -->
          <div class="gp-log-group-title">{{ group.dateLabel }}</div>
          <template
            v-for="entry in group.entries"
            :key="entry.id"
          >
            <!-- 数据行（点击打开详情弹窗） -->
            <div
              class="gp-log-trow"
              @click="openDetail(entry)"
            >
              <!-- 操作类型徽章 -->
              <span class="gp-log-tcol gp-log-tcol--action">
                <span
                  class="gp-log-badge"
                  :class="`gp-log-badge--${entry.action}`"
                >{{ actionLabel(entry.action) }}</span>
              </span>
              <!-- 状态点 -->
              <span class="gp-log-tcol gp-log-tcol--status">
                <span
                  class="gp-log-dot"
                  :class="entry.ok ? 'gp-log-dot--ok' : 'gp-log-dot--fail'"
                />
              </span>
              <!-- 项目名（可点击跳转列表视图） -->
              <span class="gp-log-tcol gp-log-tcol--project">
                <span
                  class="gp-log-project-name"
                  :title="entry.summary"
                  @click.stop="emit('viewProject', entry.projectId)"
                >{{ entry.projectName }}</span>
              </span>
              <!-- 摘要 -->
              <span class="gp-log-tcol gp-log-tcol--summary">
                <span class="gp-log-summary">{{ entry.summary }}</span>
              </span>
              <!-- 时间 -->
              <span class="gp-log-tcol gp-log-tcol--time">
                <span class="gp-log-time">{{ formatTime(entry.time) }}</span>
              </span>
              <!-- 操作列：展开平台明细 + 复制 -->
              <span class="gp-log-tcol gp-log-tcol--ops">
                <button
                  v-if="hasPlatforms(entry)"
                  class="gp-log-expand-btn"
                  :title="expandedIds.has(entry.id) ? i18n.collapsePlatforms : i18n.expandPlatforms"
                  @click.stop="toggleExpand(entry.id)"
                >
                  <Icon
                    :icon="expandedIds.has(entry.id) ? 'mdi:chevron-up' : 'mdi:chevron-down'"
                    height="12"
                  />
                </button>
                <!-- 复制条目（点击写入剪贴板，成功后切换勾选 2s） -->
                <button
                  class="gp-log-copy-btn"
                  :title="i18n.logCopyEntry"
                  @click.stop="handleCopy(entry)"
                >
                  <Icon
                    :icon="copiedIds.has(entry.id) ? 'mdi:check' : 'mdi:content-copy'"
                    height="12"
                  />
                </button>
              </span>
            </div>
            <!-- 平台明细子行（占位列对齐摘要列） -->
            <div
              v-if="hasPlatforms(entry) && expandedIds.has(entry.id)"
              class="gp-log-trow gp-log-trow--sub"
            >
              <span class="gp-log-tcol gp-log-tcol--action" />
              <span class="gp-log-tcol gp-log-tcol--status" />
              <span class="gp-log-tcol gp-log-tcol--project" />
              <div class="gp-log-tcol gp-log-tcol--summary">
                <div class="gp-log-platforms">
                  <div
                    v-for="p in entry.platforms!"
                    :key="p.key"
                    class="gp-log-platform-item"
                  >
                    <span
                      class="gp-log-platform-ok"
                      :class="p.ok ? 'gp-log-dot--ok' : p.skipped ? 'gp-log-dot--skip' : 'gp-log-dot--fail'"
                    >{{ p.ok ? '✓' : p.skipped ? '—' : '✗' }}</span>
                    <span class="gp-log-platform-label">{{ p.label }}</span>
                    <span
                      v-if="p.skipped"
                      class="gp-log-platform-skip"
                    >{{ i18n.opSkipped }}</span>
                    <span class="gp-log-platform-summary">{{ p.summary }}</span>
                  </div>
                </div>
              </div>
            </div>
            <!-- commit 信息子行 -->
            <div
              v-if="entry.action === 'commit' && entry.message"
              class="gp-log-trow gp-log-trow--sub"
            >
              <span class="gp-log-tcol gp-log-tcol--action" />
              <span class="gp-log-tcol gp-log-tcol--status" />
              <span class="gp-log-tcol gp-log-tcol--project" />
              <div class="gp-log-tcol gp-log-tcol--summary gp-log-commit-msg">
                {{ entry.message }}
              </div>
            </div>
          </template>
        </template>
      </div>

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
        @view-project="handleViewProject"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  onUnmounted,
  ref,
  watch,
} from "vue"
import { Icon } from "@iconify/vue"
import type { GitOpAction, GitOpLogEntry } from "../../types"
import { usePagedList } from "../../composables/usePagedList"
import { copyToClipboard } from "@/utils/domUtils"
import EmptyState from "../common/EmptyState.vue"
import LoadMoreButton from "../common/LoadMoreButton.vue"
import LogDetailDialog from "./LogDetailDialog.vue"

const props = defineProps<{
  i18n: Record<string, any>
  logs: GitOpLogEntry[]
  loading?: boolean
}>()

const emit = defineEmits<{
  clear: []
  viewProject: [projectId: string]
}>()

// ── 操作类型筛选 ──
const activeFilter = ref("all")
const filters = computed(() => [
  { key: "all", label: props.i18n.logFilterAll },
  { key: "push", label: props.i18n.opPush },
  { key: "pull", label: props.i18n.opPull },
  { key: "commit", label: props.i18n.opCommit },
])

/** 仅失败快捷筛选（与类型筛选 AND 叠加） */
const failOnly = ref(false)

/** 项目名搜索（大小写不敏感，实时过滤） */
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

/** 状态统计条：按操作类型聚合成功/失败数（基于全量日志，与筛选解耦） */
const stats = computed(() => {
  const types: GitOpAction[] = ["push", "pull", "commit"]
  return types
    .map((t) => {
      const items = props.logs.filter((e) => e.action === t)
      const ok = items.filter((e) => e.ok).length
      return { key: t, label: actionLabel(t), ok, fail: items.length - ok }
    })
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

/** 点击日志条目打开详情弹窗 */
function openDetail(entry: GitOpLogEntry) {
  selectedEntry.value = entry
}

/** 详情弹窗内跳转列表视图（转发给主面板） */
function handleViewProject(projectId: string) {
  emit("viewProject", projectId)
}

/** 已展开平台明细的条目 id 集合 */
const expandedIds = ref(new Set<string>())

function toggleExpand(id: string) {
  const next = new Set(expandedIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  expandedIds.value = next
}

/** 已复制反馈中的条目 id 集合（2s 后自动清除） */
const copiedIds = ref(new Set<string>())

/** 复制反馈定时器 map（id → timer，卸载时统一清理防泄漏） */
const copyTimers = new Map<string, ReturnType<typeof setTimeout>>()

/** 复制条目为 "[HH:mm] 项目名 — 摘要"（成功切换勾选图标 2s 后还原） */
async function handleCopy(entry: GitOpLogEntry) {
  const time = formatTime(entry.time).slice(11)
  const ok = await copyToClipboard(`[${time}] ${entry.projectName} — ${entry.summary}`)
  if (!ok) return
  const next = new Set(copiedIds.value)
  next.add(entry.id)
  copiedIds.value = next
  const prev = copyTimers.get(entry.id)
  if (prev) clearTimeout(prev)
  copyTimers.set(entry.id, setTimeout(() => {
    copyTimers.delete(entry.id)
    const cur = new Set(copiedIds.value)
    cur.delete(entry.id)
    copiedIds.value = cur
  }, 2000))
}

onUnmounted(() => {
  for (const t of copyTimers.values()) clearTimeout(t)
  copyTimers.clear()
})

function hasPlatforms(entry: GitOpLogEntry): boolean {
  return (entry.action === "push" || entry.action === "pull") && !!entry.platforms?.length
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    push: props.i18n.opPush,
    pull: props.i18n.opPull,
    commit: props.i18n.opCommit,
  }
  return map[action] ?? action
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return iso
  }
}

/** 日志日期分组项（组件内部使用，不导出） */
interface LogDateGroup {
  /** "2026-08-12"，用于 v-for key 唯一标识 */
  dateKey: string
  /** "今天" / "昨天" / "2026-08-12" */
  dateLabel: string
  entries: GitOpLogEntry[]
}

/** 将 ISO 时间戳格式化为自然日键 YYYY-MM-DD */
function dateKeyOf(iso: string): string {
  try {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  } catch {
    return iso
  }
}

/** 分组标题：今天 / 昨天 / 完整日期 */
function dateLabelOf(iso: string): string {
  const key = dateKeyOf(iso)
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  if (key === todayKey) return props.i18n.logDateToday
  const yesterday = new Date(now.getTime() - 86400000)
  const yesterdayKey = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`
  if (key === yesterdayKey) return props.i18n.logDateYesterday
  return key
}
</script>

<style lang="scss">
@use "../../styles/LogPanel.scss";
@use "../../styles/index.scss";
</style>
