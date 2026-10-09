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
      <!-- 操作列：展开子行明细 + 复制 -->
      <span class="gp-log-tcol gp-log-tcol--ops">
        <Button
          v-if="hasLogDetail(entry)"
          variant="ghost"
          size="xsmall"
          class="gp-log-icon-btn"
          :icon="expanded ? 'chevronUp' : 'chevronDown'"
          :title="expanded ? i18n.collapsePlatforms : i18n.expandPlatforms"
          :aria-label="expanded ? i18n.collapsePlatforms : i18n.expandPlatforms"
          :aria-expanded="expanded"
          @click.stop="expanded = !expanded"
        />
        <!-- 复制条目（点击写入剪贴板，成功后切换勾选 2s） -->
        <Button
          variant="ghost"
          size="xsmall"
          class="gp-log-icon-btn"
          :icon="copied ? 'check' : 'contentCopy'"
          :title="i18n.logCopyEntry"
          :aria-label="i18n.logCopyEntry"
          @click.stop="handleCopy"
        />
      </span>
    </div>

    <!-- 子行明细（占位列对齐摘要列）：push/pull 展示逐平台结果，commit 展示提交信息。
         两者共用同一个「手动展开」范式（由 hasLogDetail 决定展开按钮显隐），
         原实现 commit 的提交信息子行无条件渲染，与 push/pull 的可折叠子行并存两套模型。 -->
    <div
      v-if="hasLogDetail(entry) && expanded"
      class="gp-log-trow gp-log-trow--sub"
    >
      <span class="gp-log-tcol gp-log-tcol--action" />
      <span class="gp-log-tcol gp-log-tcol--status" />
      <span class="gp-log-tcol gp-log-tcol--project" />
      <!-- 逐平台结果（push/pull） -->
      <div
        v-if="hasLogPlatforms(entry)"
        class="gp-log-tcol gp-log-tcol--summary"
      >
        <LogPlatformList
          :i18n="i18n"
          :platforms="entry.platforms!"
        />
      </div>
      <!-- 提交信息（commit） -->
      <div
        v-else
        class="gp-log-tcol gp-log-tcol--summary gp-log-commit-msg"
      >
        {{ entry.message }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// gitPush 操作日志表格行（数据行 + 平台/commit 子行，展开与复制反馈状态自持）
import type { GitOpLogEntry } from "../../types"
import { ref } from "vue"
import Button from "@/components/Button.vue"
import { copyToClipboard } from "@/utils/domUtils"
import { useCopyFeedback } from "../../composables/useCopyFeedback"
import { formatLogEntryText, formatLogTime, hasLogDetail, hasLogPlatforms, logActionLabel } from "../../utils"
import LogPlatformList from "./LogPlatformList.vue"

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

/** 复制成功反馈（2s 自动还原；定时器清理由 composable 承担） */
const { copied, notifyCopied } = useCopyFeedback()

/** 复制条目（文本构造走 utils.formatLogEntryText 单一真源，与详情弹窗口径一致） */
async function handleCopy() {
  const ok = await copyToClipboard(formatLogEntryText(props.entry))
  if (!ok) return
  notifyCopied()
}
</script>

<style lang="scss">
@use "../../styles/LogPanel.scss";
@use "../../styles/index.scss";
</style>
