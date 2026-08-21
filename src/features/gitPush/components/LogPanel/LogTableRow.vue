<!-- gitPush 操作日志表格行（数据行 + 平台/commit 子行，展开与复制反馈状态自持） -->
<template>
  <div>
    <!-- 数据行（点击打开详情弹窗） -->
    <div
      class="gp-log-trow"
      @click="emit('openDetail', entry)"
    >
      <!-- 操作类型徽章 -->
      <span class="gp-log-tcol gp-log-tcol--action">
        <span
          class="gp-log-badge"
          :class="`gp-log-badge--${entry.action}`"
        >{{ logActionLabel(entry.action, i18n) }}</span>
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
        <span class="gp-log-time">{{ formatLogTime(entry.time) }}</span>
      </span>
      <!-- 操作列：展开平台明细 + 复制 -->
      <span class="gp-log-tcol gp-log-tcol--ops">
        <button
          v-if="hasLogPlatforms(entry)"
          class="gp-log-expand-btn"
          :title="expanded ? i18n.collapsePlatforms : i18n.expandPlatforms"
          @click.stop="expanded = !expanded"
        >
          <Icon
            :icon="expanded ? 'mdi:chevron-up' : 'mdi:chevron-down'"
            height="12"
          />
        </button>
        <!-- 复制条目（点击写入剪贴板，成功后切换勾选 2s） -->
        <button
          class="gp-log-copy-btn"
          :title="i18n.logCopyEntry"
          @click.stop="handleCopy"
        >
          <Icon
            :icon="copied ? 'mdi:check' : 'mdi:content-copy'"
            height="12"
          />
        </button>
      </span>
    </div>

    <!-- 平台明细子行（占位列对齐摘要列） -->
    <div
      v-if="hasLogPlatforms(entry) && expanded"
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
  </div>
</template>

<script setup lang="ts">
// gitPush 操作日志表格行（数据行 + 平台/commit 子行，展开与复制状态自持）
import type { GitOpLogEntry } from "../../types"
import { Icon } from "@iconify/vue"
import { onUnmounted, ref } from "vue"
import { copyToClipboard } from "@/utils/domUtils"
import { formatLogTime, hasLogPlatforms, logActionLabel } from "../../utils"

const props = defineProps<{
  i18n: Record<string, any>
  entry: GitOpLogEntry
}>()

const emit = defineEmits<{
  openDetail: [entry: GitOpLogEntry]
  viewProject: [projectId: string]
}>()

/** 平台明细子行是否展开（行内自持状态，互不影响） */
const expanded = ref(false)

/** 复制反馈（成功 2s 后还原） */
const copied = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | undefined

/** 复制条目为 "[HH:mm] 项目名 — 摘要"（成功切换勾选图标 2s 后还原） */
async function handleCopy() {
  const time = formatLogTime(props.entry.time).slice(11)
  const ok = await copyToClipboard(`[${time}] ${props.entry.projectName} — ${props.entry.summary}`)
  if (!ok) return
  if (copyTimer) clearTimeout(copyTimer)
  copied.value = true
  copyTimer = setTimeout(() => { copied.value = false }, 2000)
}

onUnmounted(() => {
  if (copyTimer) clearTimeout(copyTimer)
})
</script>

<style lang="scss">
@use "../../styles/LogPanel.scss";
@use "../../styles/index.scss";
</style>
