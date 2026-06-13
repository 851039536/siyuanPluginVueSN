<template>
  <div class="wt-panel">
    <!-- 工作区摘要条（可点击展开） -->
    <div class="wt-summary" :class="{ expanded: expanded }" @click="toggleExpanded">
      <Icon :icon="expanded ? 'mdi:chevron-down' : 'mdi:chevron-right'" height="14" />
      <span class="wt-label">WORKING TREE</span>
      <template v-if="tree.hasChanges">
        <span class="wt-count">
          <span v-if="tree.stagedCount" class="wt-staged">●{{ tree.stagedCount }}</span>
          <span v-if="tree.unstagedCount" class="wt-unstaged">●{{ tree.unstagedCount }}</span>
          <span v-if="tree.untrackedCount" class="wt-untracked">○{{ tree.untrackedCount }}</span>
        </span>
        <span class="wt-summary-text">
          {{ i18n.pendingChanges || '个文件变更' }}
        </span>
      </template>
      <template v-else>
        <span class="wt-clean">{{ i18n.workingTreeClean || '工作区干净' }}</span>
      </template>
    </div>

    <!-- 展开的工作区详情 -->
    <div v-if="expanded" class="wt-body">
      <!-- 工具栏 -->
      <div v-if="tree.hasChanges" class="wt-toolbar">
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          :disabled="(tree.unstagedCount === 0 && tree.untrackedCount === 0) || gitOpLoading"
          @click.stop="$emit('stageAll')"
        >
          {{ i18n.stageAll || '暂存全部' }}
        </button>
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          :disabled="tree.stagedCount === 0 || gitOpLoading"
          @click.stop="$emit('unstageAll')"
        >
          {{ i18n.unstageAll || '取消暂存全部' }}
        </button>
      </div>

      <!-- 文件列表 -->
      <div v-if="tree.files.length" class="wt-files">
        <div v-if="!activeDiffFile" class="wt-diff-hint">
          <Icon icon="mdi:information-outline" height="11" />
          <span>点击文件名或「差异」按钮查看带颜色的 diff 比对</span>
        </div>
        <div
          v-for="file in sortedFiles"
          :key="file.path"
          class="wt-file-row"
          :class="{ staged: file.staged }"
        >
          <!-- 勾选框 -->
          <button
            class="wt-checkbox"
            :class="{ checked: file.staged }"
            :disabled="gitOpLoading"
            :title="gitOpLoading ? '处理中...' : file.staged ? (i18n.unstageFile || '取消暂存') : (i18n.stageFile || '暂存')"
            @click.stop="toggleStage(file)"
          >
            <Icon v-if="gitOpLoading" icon="mdi:loading" class="gp-spin" height="14" />
            <Icon v-else-if="file.staged" icon="mdi:checkbox-marked" height="14" />
            <Icon v-else icon="mdi:checkbox-blank-outline" height="14" />
          </button>

          <!-- 状态图标 -->
          <span class="wt-file-status" :class="`wt-s-${file.status}`" :title="statusTitle(file)">
            {{ statusIcon(file) }}
          </span>

          <!-- 文件名（点击查看差异） -->
          <span
            class="wt-file-path"
            :title="'点击查看差异 — ' + file.path"
            @click="toggleDiff(file)"
          >{{ file.path }}</span>

          <!-- 查看差异 -->
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm wt-diff-btn"
            :title="activeDiffFile?.path === file.path ? '关闭差异' : '查看差异（带增/删/改着色）'"
            @click.stop="toggleDiff(file)"
          >
            <Icon icon="mdi:file-compare" height="13" />
            <span class="wt-diff-btn-label">差异</span>
          </button>
        </div>
      </div>

      <!-- 差异查看弹窗 -->
      <Teleport to="body">
        <div v-if="activeDiffFile" class="wt-diff-overlay" @click.self="activeDiffFile = null">
          <div class="wt-diff-dialog">
            <div class="wt-diff-header">
              <div class="wt-diff-title-row">
                <Icon icon="mdi:file-compare" height="14" />
                <span class="wt-diff-title">{{ activeDiffFile.path }}</span>
                <span class="wt-diff-badge">{{ activeDiffFile.staged ? (i18n.staged || '暂存') : (i18n.unstaged || '未暂存') }}</span>
              </div>
              <button class="vp-btn vp-btn--ghost vp-btn--sm" @click="activeDiffFile = null">
                <Icon icon="mdi:close" height="14" />
              </button>
            </div>
            <div class="wt-diff-legend">
              <span class="wt-legend-add">+ 新增</span>
              <span class="wt-legend-del">− 删除</span>
              <span class="wt-legend-ctx">⋯ 未变</span>
            </div>
            <div class="wt-diff-content">
              <div
                v-for="(line, i) in coloredDiffLines"
                :key="i"
                class="wt-diff-line"
                :class="`wt-dl-${line.type}`"
              >
                <span class="wt-dl-sign">{{ line.type === 'add' ? '+' : line.type === 'del' ? '−' : line.type === 'hunk' ? '@' : ' ' }}</span>
                <span class="wt-dl-text">{{ line.text }}</span>
              </div>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- 提交表单 -->
      <div v-if="tree.stagedCount > 0" class="wt-commit-form">
        <!-- 常规提交类型快速选择 -->
        <div class="wt-commit-types">
          <button
            v-for="ct in COMMIT_TYPES"
            :key="ct.value"
            class="wt-type-btn"
            :class="{ active: commitType === ct.value }"
            @click.stop="commitType = ct.value; updateCommitMessage()"
          >
            {{ ct.label }}
          </button>
        </div>
        <textarea
          v-model="commitMessage"
          class="wt-commit-msg"
          rows="3"
          :placeholder="i18n.commitMessagePlaceholder || '输入提交信息...'"
        />
        <div class="wt-commit-actions">
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm"
            :disabled="generating"
            @click.stop="handleGenerate"
          >
            <Icon v-if="generating" icon="mdi:loading" class="gp-spin" height="13" />
            <Icon v-else icon="mdi:auto-fix" height="13" />
            <span>{{ generating ? (i18n.generating || '生成中...') : (i18n.generateMsg || '生成提交信息') }}</span>
          </button>
          <button
            class="vp-btn vp-btn--primary vp-btn--sm"
            :disabled="!commitMessage.trim() || committing"
            @click.stop="handleCommit"
          >
            <Icon v-if="committing" icon="mdi:loading" class="gp-spin" height="13" />
            <Icon v-else icon="mdi:source-commit" height="13" />
            <span>{{ committing ? (i18n.committing || '提交中...') : (i18n.commit || '提交') }}</span>
          </button>
        </div>
      </div>
      <!-- 操作反馈（不限提交表单可见，暂存失败等信息在此显示） -->
      <div v-if="commitOutput" class="wt-commit-output">
        <button class="wt-output-close" @click.stop="$emit('clearOutput')" title="关闭">×</button>
        <pre>{{ commitOutput }}</pre>
      </div>

      <!-- 提交历史 -->
      <BranchCommitList :entries="commitLogEntries" :loading="commitLogLoading" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue"
import { Icon } from "@iconify/vue"
import type { FileChange, WorkingTreeInfo, CommitLogEntry } from "../types"
import { COMMIT_TYPE_VALUES } from "../types/storage"
import BranchCommitList from "./BranchCommitList.vue"

const COMMIT_TYPES = COMMIT_TYPE_VALUES.map(v => ({ value: v, label: v }))

const props = defineProps<{
  i18n: Record<string, any>
  tree: WorkingTreeInfo
  committing: boolean
  generating: boolean
  commitOutput: string
  fileDiffs: Record<string, string>
  generatedMsg: string
  gitOpLoading: boolean
  commitLogEntries: CommitLogEntry[]
  commitLogLoading: boolean
}>()

const emit = defineEmits<{
  stageFile: [file: string]
  unstageFile: [file: string]
  stageAll: []
  unstageAll: []
  commit: [message: string]
  generateMsg: []
  loadDiff: [file: string, staged: boolean]
  clearOutput: []
}>()

const expanded = ref(false)
const commitType = ref("chore")
const commitMessage = ref("")
const activeDiffFile = ref<FileChange | null>(null)

// 监听外部生成的消息，自动填充
watch(() => props.generatedMsg, (msg) => {
  if (msg) commitMessage.value = msg
})

const sortedFiles = computed(() => {
  return [...props.tree.files].sort((a, b) => {
    // 已暂存的排前面
    if (a.staged !== b.staged) return a.staged ? -1 : 1
    // 同组内按路径排序
    return a.path.localeCompare(b.path)
  })
})

const activeDiffText = computed(() => {
  if (!activeDiffFile.value) return ""
  const key = `${activeDiffFile.value.staged ? "s" : "u"}::${activeDiffFile.value.path}`
  return props.fileDiffs[key] || ""
})

type DiffLineType = "add" | "del" | "hunk" | "ctx"
interface DiffLine { text: string; type: DiffLineType }

/** 将 diff 文本解析为带类型的行数组（用于着色渲染） */
const coloredDiffLines = computed<DiffLine[]>(() => {
  if (!activeDiffText.value) return []
  return activeDiffText.value.split("\n").map(line => {
    if (line.startsWith("+") && !line.startsWith("+++")) return { text: line, type: "add" }
    if (line.startsWith("-") && !line.startsWith("---")) return { text: line, type: "del" }
    if (line.startsWith("@@")) return { text: line, type: "hunk" }
    return { text: line, type: "ctx" }
  })
})

/** 文件状态元数据（图标 + 标题统一维护） */
const STATUS_MAP: Record<string, { icon: string; title: string }> = {
  modified:  { icon: "~", title: "已修改" },
  added:     { icon: "+", title: "新增" },
  deleted:   { icon: "−", title: "已删除" },
  renamed:   { icon: "→", title: "重命名" },
  untracked: { icon: "?", title: "未跟踪" },
  copied:    { icon: "⇋", title: "已复制" },
  unmerged:  { icon: "⚠", title: "冲突" },
}

function statusIcon(file: FileChange): string {
  return STATUS_MAP[file.status]?.icon || "·"
}

function statusTitle(file: FileChange): string {
  const title = STATUS_MAP[file.status]?.title || file.status
  return file.oldPath ? `${title}: ${file.oldPath} → ${file.path}` : title
}

function toggleStage(file: FileChange) {
  if (file.staged) {
    emit("unstageFile", file.path)
  } else {
    emit("stageFile", file.path)
  }
}

function toggleExpanded() {
  expanded.value = !expanded.value
}

function toggleDiff(file: FileChange) {
  if (activeDiffFile.value?.path === file.path && activeDiffFile.value?.staged === file.staged) {
    activeDiffFile.value = null
  } else {
    activeDiffFile.value = file
    emit("loadDiff", file.path, file.staged)
  }
}

function updateCommitMessage() {
  if (commitMessage.value) {
    // 替换已有的 type 前缀
    const colonIdx = commitMessage.value.indexOf(": ")
    if (colonIdx > 0) {
      commitMessage.value = `${commitType.value}: ${commitMessage.value.substring(colonIdx + 2)}`
    }
  }
  // 如果为空，不自动填充（等用户点生成）
}

async function handleGenerate() {
  emit("generateMsg")
}

function handleCommit() {
  if (!commitMessage.value.trim()) return
  emit("commit", commitMessage.value.trim())
}

defineExpose({ clear: () => { commitMessage.value = ""; commitType.value = "chore" } })
</script>

<style lang="scss">
@use "@/index.scss" as *;
@use "../styles/variables" as *;
@use "../styles/mixins" as *;

.wt-panel {
  border-top: 1px solid var(--b3-border-color);
  margin-top: 8px;
  padding-top: 6px;
}

.wt-summary {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 4px 0;
  font-size: 11px;
  opacity: 0.6;
  transition: opacity 0.15s;
  user-select: none;

  &:hover {
    opacity: 1;
  }

  &.expanded {
    opacity: 0.9;
  }
}

.wt-count {
  display: flex;
  gap: 4px;
  font-size: 10px;
  font-weight: 700;
}

.wt-staged {
  color: var(--b3-theme-primary);
}

.wt-unstaged {
  color: var(--b3-theme-warning);
}

.wt-untracked {
  color: var(--b3-theme-error);
  opacity: 0.7;
}

.wt-summary-text {
  margin-left: 2px;
}

.wt-clean {
  color: var(--b3-theme-success);
  font-weight: 600;
}

.wt-body {
  margin-top: 6px;
}

.wt-toolbar {
  display: flex;
  gap: 4px;
  margin-bottom: 6px;
}

.wt-diff-hint {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 3px 8px;
  font-size: 10px;
  opacity: 0.35;
  border-bottom: 1px solid var(--b3-border-color);
}

.wt-files {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  margin-bottom: 6px;
}

.wt-file-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  font-size: 11px;
  border-bottom: 1px solid var(--b3-border-color);
  transition: background 0.1s;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: var(--b3-list-hover);
  }

  &.staged {
    opacity: 0.5;
  }
}

.wt-checkbox {
  display: flex;
  align-items: center;
  cursor: pointer;
  background: none;
  border: none;
  padding: 0;
  color: var(--b3-theme-on-surface);
  opacity: 0.4;
  flex-shrink: 0;

  &.checked {
    color: var(--b3-theme-primary);
    opacity: 1;
  }

  &:hover {
    opacity: 0.8;
  }

  &[disabled] {
    cursor: not-allowed;
    pointer-events: none;
    opacity: 0.3;
  }
}

.wt-file-status {
  width: 18px;
  flex-shrink: 0;
  text-align: center;
  font-size: 10px;
  font-weight: 700;
  font-family: $vp-mono;
  overflow: hidden;

  &.wt-s-modified { color: var(--b3-theme-warning); }
  &.wt-s-added    { color: var(--b3-theme-success); }
  &.wt-s-deleted  { color: var(--b3-theme-error); }
  &.wt-s-renamed  { color: #9b59b6; }
  &.wt-s-untracked { color: var(--b3-theme-error); opacity: 0.6; }
  &.wt-s-copied   { color: #9b59b6; }
  &.wt-s-unmerged { color: var(--b3-theme-error); }
}

.wt-file-path {
  flex: 1;
  min-width: 0;
  font-family: $vp-mono;
  font-size: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;

  &:hover {
    color: var(--b3-theme-primary);
  }
}

.wt-diff-btn {
  flex-shrink: 0;
  opacity: 0.45;
  gap: 2px;
  transition: opacity 0.15s;

  .wt-file-row:hover & {
    opacity: 1;
  }

  &:hover {
    opacity: 1;
    border-color: var(--b3-theme-primary);
  }
}

.wt-diff-btn-label {
  font-size: 9px;
  font-weight: 600;
}

// Diff 弹窗
.wt-diff-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2px);
}

.wt-diff-dialog {
  width: 90vw;
  max-width: 800px;
  height: 880px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.wt-diff-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--b3-theme-surface);
  border-bottom: 1px solid var(--b3-border-color);
  flex-shrink: 0;
}

.wt-diff-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.wt-diff-title {
  font-size: 12px;
  font-family: $vp-mono;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wt-diff-badge {
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px solid var(--b3-border-color);
  opacity: 0.5;
  flex-shrink: 0;
}

.wt-diff-legend {
  display: flex;
  gap: 12px;
  padding: 4px 12px;
  font-size: 9px;
  font-family: $vp-mono;
  border-bottom: 1px solid var(--b3-border-color);
  flex-shrink: 0;
}

.wt-legend-add { color: #1a7f37; }
.wt-legend-del { color: #cf222e; }
.wt-legend-ctx { opacity: 0.35; }

.wt-diff-content {
  margin: 0;
  font-size: 10px;
  font-family: $vp-mono;
  max-height: calc(80vh - 100px);
  overflow: auto;
  color: var(--b3-theme-on-surface);
  tab-size: 2;
}

.wt-diff-line {
  display: flex;
  padding: 0 8px;
  line-height: 1.6;

  &.wt-dl-add {
    background: #e6ffec;
  }

  &.wt-dl-del {
    background: #ffebe9;
  }

  &.wt-dl-hunk {
    color: #0969da;
    .wt-dl-sign { color: #0969da; }
  }

  &.wt-dl-ctx {
    opacity: 0.6;
  }
}

.wt-dl-sign {
  width: 16px;
  flex-shrink: 0;
  text-align: center;
  font-weight: 700;
  user-select: none;
  opacity: 0.5;
}

.wt-dl-text {
  white-space: pre-wrap;
  word-break: break-all;
  flex: 1;
  min-width: 0;
}

.wt-commit-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.wt-commit-types {
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
}

.wt-type-btn {
  padding: 1px 6px;
  font-size: 10px;
  font-family: $vp-mono;
  font-weight: 600;
  border: 1px solid var(--b3-border-color);
  border-radius: 3px;
  background: transparent;
  color: var(--b3-theme-on-surface);
  opacity: 0.5;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    opacity: 0.8;
  }

  &.active {
    opacity: 1;
    border-color: var(--b3-theme-primary);
    color: var(--b3-theme-primary);
    background: var(--b3-theme-primary-lightest);
  }
}

.wt-commit-msg {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  font-size: 11px;
  font-family: $vp-mono;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  resize: vertical;
  outline: none;

  &:focus {
    @include focus-ring;
  }
}

.wt-commit-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}

.wt-commit-output {
  position: relative;
  padding: 6px 8px;
  padding-right: 28px;
  max-height: 100px;
  @include output-base;
}

.wt-output-close {
  position: absolute;
  top: 2px;
  right: 4px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--b3-theme-on-surface);
  opacity: 0.4;
  font-size: 14px;
  line-height: 1;
  padding: 0 4px;

  &:hover {
    opacity: 1;
  }
}

.wt-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.45;
  margin-right: 6px;
}
</style>
