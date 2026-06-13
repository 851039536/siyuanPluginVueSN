<template>
  <div class="wt-panel">
    <!-- 工作区摘要条（可点击展开） -->
    <div class="wt-summary" :class="{ expanded: expanded }" @click="toggleExpanded">
      <Icon :icon="expanded ? 'mdi:chevron-down' : 'mdi:chevron-right'" height="14" />
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

          <!-- 文件名 -->
          <span class="wt-file-path" :title="file.path">{{ file.path }}</span>

          <!-- 查看差异 -->
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm wt-diff-btn"
            :title="i18n.viewDiff || '查看差异'"
            @click.stop="toggleDiff(file)"
          >
            <Icon icon="mdi:file-diff" height="13" />
          </button>
        </div>
      </div>

      <!-- 差异查看区 -->
      <div v-if="activeDiffFile" class="wt-diff-viewer">
        <div class="wt-diff-header">
          <span class="wt-diff-label">
            diff -- {{ activeDiffFile.staged ? (i18n.staged || '暂存') : (i18n.unstaged || '未暂存') }}: {{ activeDiffFile.path }}
          </span>
          <button class="vp-btn vp-btn--ghost vp-btn--sm" @click.stop="activeDiffFile = null">
            <Icon icon="mdi:close" height="12" />
          </button>
        </div>
        <pre class="wt-diff-content" v-text="activeDiffText || '加载中...'" />
      </div>

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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue"
import { Icon } from "@iconify/vue"
import type { FileChange, WorkingTreeInfo } from "../types"

const COMMIT_TYPES = [
  { value: "feat", label: "feat" },
  { value: "fix", label: "fix" },
  { value: "chore", label: "chore" },
  { value: "docs", label: "docs" },
  { value: "style", label: "style" },
  { value: "refactor", label: "refactor" },
  { value: "test", label: "test" },
]

const props = defineProps<{
  i18n: Record<string, any>
  tree: WorkingTreeInfo
  committing: boolean
  generating: boolean
  commitOutput: string
  fileDiffs: Record<string, string>
  generatedMsg: string
  gitOpLoading: boolean
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

$vp-mono: "JetBrains Mono", "Fira Code", "Consolas", monospace;

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
}

.wt-diff-btn {
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s;

  .wt-file-row:hover & {
    opacity: 0.6;

    &:hover {
      opacity: 1;
    }
  }
}

.wt-diff-viewer {
  margin-bottom: 6px;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  overflow: hidden;
}

.wt-diff-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  background: var(--b3-theme-surface);
  border-bottom: 1px solid var(--b3-border-color);
}

.wt-diff-label {
  font-size: 10px;
  font-family: $vp-mono;
  opacity: 0.5;
}

.wt-diff-content {
  margin: 0;
  padding: 6px 8px;
  font-size: 10px;
  font-family: $vp-mono;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 180px;
  overflow: auto;
  color: var(--b3-theme-on-surface);
  tab-size: 2;
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
    border-color: var(--b3-theme-primary);
    box-shadow: 0 0 0 2px var(--b3-theme-primary-lightest);
  }
}

.wt-commit-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}

.wt-commit-output {
  position: relative;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  padding: 6px 8px;
  padding-right: 28px;
  max-height: 100px;
  overflow: auto;

  pre {
    margin: 0;
    font-size: 10px;
    font-family: $vp-mono;
    white-space: pre-wrap;
    color: var(--b3-theme-on-surface);
  }
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
</style>
