<!-- Git 操作日志面板（推送/拉取/提交历史记录） -->
<template>
  <div class="gp-log-panel">
    <!-- 空状态 -->
    <div
      v-if="logs.length === 0"
      class="gp-empty"
    >
      <div class="gp-empty-icon">
        <Icon
          icon="mdi:history"
          width="48"
          height="48"
        />
      </div>
      <!-- 空状态文案："暂无操作记录" -->
      <div class="gp-empty-text">
        {{ i18n.noOpLogs }}
      </div>
    </div>

    <template v-else>
      <!-- 顶部工具条 -->
      <div class="gp-log-toolbar">
        <!-- 日志条数："{0} 条记录" -->
        <span class="gp-log-count">{{ i18n.logCount.replace("{0}", logs.length) }}</span>
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

      <!-- 日志列表 -->
      <div class="gp-log-list">
        <div
          v-for="entry in pagedLogs"
          :key="entry.id"
          class="gp-log-item"
        >
          <div class="gp-log-item-head">
            <!-- 操作类型徽章 -->
            <span
              class="gp-log-badge"
              :class="`gp-log-badge--${entry.action}`"
            >{{ actionLabel(entry.action) }}</span>
            <!-- 状态点 -->
            <span
              class="gp-log-dot"
              :class="entry.ok ? 'gp-log-dot--ok' : 'gp-log-dot--fail'"
            />
            <!-- 项目名（可点击跳转） -->
            <span
              class="gp-log-project-name"
              :title="entry.summary"
              @click="emit('viewProject', entry.projectId)"
            >
              {{ entry.projectName }}
            </span>
            <!-- 摘要 -->
            <span class="gp-log-summary">{{ entry.summary }}</span>
            <!-- 时间 -->
            <span class="gp-log-time">{{ formatTime(entry.time) }}</span>
          </div>
          <!-- 平台明细（push/pull 可展开） -->
          <div
            v-if="hasPlatforms(entry) && expandedIds.has(entry.id)"
            class="gp-log-platforms"
          >
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
          <!-- 展开/收起按钮 -->
          <button
            v-if="hasPlatforms(entry)"
            class="gp-log-expand-btn"
            @click="toggleExpand(entry.id)"
          >
            {{ expandedIds.has(entry.id) ? (i18n.collapsePlatforms) : (i18n.expandPlatforms) }}
          </button>
          <!-- commit 信息 -->
          <div
            v-if="entry.action === 'commit' && entry.message"
            class="gp-log-commit-msg"
          >
            {{ entry.message }}
          </div>
        </div>
      </div>

      <!-- 加载更多 -->
      <div
        v-if="visibleCount < filteredLogs.length"
        class="gp-log-load-more"
      >
        <!-- 按钮文案："加载更多" -->
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          @click="visibleCount = Math.min(visibleCount + 50, filteredLogs.length)"
        >
          {{ i18n.loadMoreLogs }} ({{ visibleCount }} / {{ filteredLogs.length }})
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import { Icon } from "@iconify/vue"
import type { GitOpLogEntry } from "../types"

const props = defineProps<{
  i18n: Record<string, any>
  logs: GitOpLogEntry[]
}>()

const emit = defineEmits<{
  clear: []
  viewProject: [projectId: string]
}>()

// ── 本地分页：默认 50 条，加载更多逐次增加 ──
const visibleCount = ref(50)

// ── 操作类型筛选 ──
const activeFilter = ref("all")
const filters = computed(() => [
  { key: "all", label: props.i18n.logFilterAll },
  { key: "push", label: props.i18n.opPush },
  { key: "pull", label: props.i18n.opPull },
  { key: "commit", label: props.i18n.opCommit },
])

const filteredLogs = computed(() => {
  if (activeFilter.value === "all") return props.logs
  return props.logs.filter((e) => e.action === activeFilter.value)
})

const pagedLogs = computed(() => filteredLogs.value.slice(0, visibleCount.value))

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
</script>

<style lang="scss">
@use "../styles/LogPanel.scss";
@use "../styles/index.scss";
</style>
