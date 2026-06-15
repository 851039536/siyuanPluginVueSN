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

          <!-- 丢弃更改 -->
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm wt-discard-btn"
            :title="file.staged ? '取消暂存并丢弃更改' : file.status === 'untracked' ? '删除未跟踪文件' : '丢弃更改'"
            @click.stop="$emit('discardFile', file.path, file.staged, file.status)"
          >
            <Icon icon="mdi:undo-variant" height="13" />
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
          rows="10"
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
  discardFile: [file: string, staged: boolean, status: string]
  /** 面板首次展开时触发，父组件按需懒加载 commitLog/branches/stash 等详情 */
  expand: []
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
  // 首次展开时通知父组件懒加载详情数据（commitLog/branches/stash）
  if (expanded.value) emit("expand")
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
@use "../styles/WorkingTreePanel.scss";
</style>
