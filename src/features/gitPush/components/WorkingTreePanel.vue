<!-- Git 工作区文件变更面板 -->
<template>
  <div class="wt-panel">
    <!-- 工作区摘要条（可点击展开） -->
    <div
      class="wt-summary"
      :class="{ expanded }"
      @click="toggleExpanded"
    >
      <Icon
        :icon="expanded ? 'mdi:chevron-down' : 'mdi:chevron-right'"
        height="12"
      />
      <span class="wt-label">WORKING TREE</span>
      <template v-if="tree?.hasChanges">
        <span class="wt-count">
          <span
            v-if="tree.stagedCount"
            class="wt-staged"
          >●{{ tree.stagedCount }}</span>
          <span
            v-if="tree.unstagedCount"
            class="wt-unstaged"
          >●{{ tree.unstagedCount }}</span>
          <span
            v-if="tree.untrackedCount"
            class="wt-untracked"
          >○{{ tree.untrackedCount }}</span>
        </span>
        <span class="wt-summary-text">
          {{ i18n.pendingChanges }}
        </span>
      </template>
      <template v-else-if="tree">
        <span class="wt-clean">{{ i18n.workingTreeClean }}</span>
      </template>
      <button
        class="vp-btn vp-btn--ghost vp-btn--sm wt-section-refresh"
        :disabled="workingTreeLoading"
        @click.stop="$emit('refreshWorkingTree')"
      >
        <Icon icon="mdi:refresh" height="12" :class="{ 'gp-spin': workingTreeLoading }" />
        <span class="wt-refresh-label">{{ i18n.refreshWorkingTree }}</span>
      </button>
    </div>

    <!-- 展开的工作区详情 -->
    <div
      v-if="expanded"
      class="wt-body"
    >
      <!-- 工具栏 -->
      <div
        v-if="tree?.hasChanges"
        class="wt-toolbar"
      >
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          :disabled="((tree?.unstagedCount ?? 0) === 0 && (tree?.untrackedCount ?? 0) === 0) || gitOpLoading"
          @click.stop="$emit('stageAll')"
        >
          {{ i18n.stageAll }}
        </button>
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          :disabled="(tree?.stagedCount ?? 0) === 0 || gitOpLoading"
          @click.stop="$emit('unstageAll')"
        >
          {{ i18n.unstageAll }}
        </button>
      </div>

      <!-- 文件列表 -->
      <div
        v-if="tree?.files.length"
        class="wt-files"
      >
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
            :title="gitOpLoading ? i18n.processing : file.staged ? i18n.unstageFile : i18n.stageFile"
            @click.stop="toggleStage(file)"
          >
            <Icon
              v-if="gitOpLoading"
              icon="mdi:loading"
              class="gp-spin"
              height="12"
            />
            <Icon
              v-else-if="file.staged"
              icon="mdi:checkbox-marked"
              height="12"
            />
            <Icon
              v-else
              icon="mdi:checkbox-blank-outline"
              height="12"
            />
          </button>

          <!-- 状态图标 -->
          <span
            class="wt-file-status"
            :class="`wt-s-${file.status}`"
            :title="statusTitle(file)"
          >
            <template v-if="file.status === 'renamed'">
              <IconWrapper
                name="forward"
                :size="12"
              />
            </template>
            <template v-else-if="file.status === 'unmerged'">
              <IconWrapper
                name="warning"
                :size="12"
              />
            </template>
            <template v-else>
              {{ statusIcon(file) }}
            </template>
          </span>

          <!-- 文件名（点击查看差异） -->
          <span
            class="wt-file-path"
            :title="i18n.clickViewDiff + ' — ' + file.path"
            @click="toggleDiff(file)"
          >{{ file.path }}</span>

          <!-- 查看差异 -->
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm wt-diff-btn"
            :title="activeDiffFile?.path === file.path ? i18n.closeDiff : i18n.viewDiffColored"
            @click.stop="toggleDiff(file)"
          >
            <Icon
              icon="mdi:file-compare"
              height="12"
            />
            <span class="wt-diff-btn-label">{{ i18n.diff }}</span>
          </button>

          <!-- 丢弃更改 -->
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm wt-discard-btn"
            :title="file.staged ? i18n.unstageDiscard : file.status === 'untracked' ? i18n.discardUntracked : i18n.discardChanges"
            @click.stop="$emit('discardFile', file.path, file.staged, file.status)"
          >
            <Icon
              icon="mdi:undo-variant"
              height="12"
            />
          </button>
        </div>
      </div>

      <!-- 差异查看弹窗 -->
      <Teleport to="body">
        <div
          v-if="activeDiffFile"
          class="wt-diff-overlay"
          @click.self="activeDiffFile = null"
        >
          <div class="wt-diff-dialog">
            <div class="wt-diff-header">
              <div class="wt-diff-title-row">
                <Icon
                  icon="mdi:file-compare"
                  height="12"
                />
                <span class="wt-diff-title">{{ activeDiffFile.path }}</span>
                <span class="wt-diff-badge">{{ activeDiffFile.staged ? i18n.staged : i18n.unstaged }}</span>
              </div>
              <button
                class="vp-btn vp-btn--ghost vp-btn--sm"
                @click="activeDiffFile = null"
              >
                <Icon
                  icon="mdi:close"
                  height="12"
                />
              </button>
            </div>
            <div class="wt-diff-legend">
              <span class="wt-legend-add">+ {{ i18n.legendAdd }}</span>
              <span class="wt-legend-del">− {{ i18n.legendDel }}</span>
              <span class="wt-legend-ctx">⋯ {{ i18n.legendCtx }}</span>
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
      <div
        v-if="(tree?.stagedCount ?? 0) > 0"
        class="wt-commit-form"
      >
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
        <!-- 提交信息模板 -->
        <div
          v-if="commitTemplates?.length"
          class="wt-template-row"
        >
          <Icon
            icon="mdi:file-document-outline"
            height="12"
          />
          <select
            class="wt-template-select"
            @change="handleSelectTemplate(($event.target as HTMLSelectElement).value)"
          >
            <option value="">
              {{ i18n.selectTemplate }}
            </option>
            <option
              v-for="tpl in commitTemplates"
              :key="tpl.id"
              :value="tpl.id"
            >
              {{ tpl.name }}
            </option>
          </select>
        </div>
        <textarea
          v-model="commitMessage"
          class="wt-commit-msg"
          rows="4"
          :placeholder="i18n.commitMessagePlaceholder"
        />
        <div class="wt-commit-actions">
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm"
            :disabled="generating"
            @click.stop="handleGenerate"
          >
            <Icon
              v-if="generating"
              icon="mdi:loading"
              class="gp-spin"
              height="12"
            />
            <Icon
              v-else
              icon="mdi:auto-fix"
              height="12"
            />
            <span>{{ generating ? i18n.generating : i18n.generateMsg }}</span>
          </button>
          <button
            class="vp-btn vp-btn--primary vp-btn--sm"
            :disabled="!commitMessage.trim() || committing"
            @click.stop="handleCommit"
          >
            <Icon
              v-if="committing"
              icon="mdi:loading"
              class="gp-spin"
              height="12"
            />
            <Icon
              v-else
              icon="mdi:source-commit"
              height="12"
            />
            <span>{{ committing ? i18n.committing : i18n.commit }}</span>
          </button>
        </div>
      </div>
      <!-- 操作反馈（不限提交表单可见，暂存失败等信息在此显示） -->
      <div
        v-if="commitOutput"
        class="wt-commit-output"
      >
        <button
          class="wt-output-close"
          :title="i18n.close"
          @click.stop="$emit('clearOutput')"
        >
          ×
        </button>
        <pre>{{ commitOutput }}</pre>
      </div>

      <!-- 提交历史 -->
      <BranchCommitList
        :entries="commitLogEntries"
        :loading="commitLogLoading"
        @reload-commit-log="(count) => emit('reloadCommitLog', count)"
        @refresh-commit-log="$emit('refreshCommitLog')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  CommitLogEntry,
  CommitTemplate,
  FileChange,
  WorkingTreeInfo,
} from "../types"
import { FILE_STATUS_META } from "../types"
import { parseDiffLines } from "../utils"
import { useGeneratedMsgSync } from "../composables/useGeneratedMsgSync"
import { Icon } from "@iconify/vue"
import {
  computed,
  onMounted,
  ref,
  toRef,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { COMMIT_TYPE_VALUES } from "../types/storage"
import BranchCommitList from "./BranchCommitList.vue"

const props = defineProps<{
  i18n: Record<string, any>
  tree?: WorkingTreeInfo
  committing: boolean
  generating: boolean
  commitOutput: string
  fileDiffs: Record<string, string>
  generatedMsg: string
  gitOpLoading: boolean
  commitLogEntries: CommitLogEntry[]
  commitLogLoading: boolean
  /** 工作区刷新加载中 */
  workingTreeLoading?: boolean
  /** 提交信息模板 */
  commitTemplates?: CommitTemplate[]
  /** 面板初始展开状态（按 projectId 持久化后回传） */
  initialExpanded?: boolean
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
  /** 展开状态变化（供父级按 projectId 持久化） */
  "update:expanded": [value: boolean]
  /** 用户修改提交记录显示条数 */
  reloadCommitLog: [count: number]
  /** 单独刷新工作区 */
  refreshWorkingTree: []
  /** 单独刷新提交日志 */
  refreshCommitLog: []
}>()

const COMMIT_TYPES = COMMIT_TYPE_VALUES.map((v) => ({
  value: v,
  label: v,
}))

const expanded = ref(props.initialExpanded ?? false)
const commitType = ref("chore")
const commitMessage = ref("")
const activeDiffFile = ref<FileChange | null>(null)

// 恢复为展开状态时，触发一次懒加载（commitLog/branches/stash）使面板内容完整
onMounted(() => {
  if (expanded.value) emit("expand")
})

// 监听外部生成的消息，自动填充
useGeneratedMsgSync(toRef(props, "generatedMsg"), commitMessage)

const sortedFiles = computed(() => {
  if (!props.tree) return []
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

/** 将 diff 文本解析为带类型的行数组（用于着色渲染） */
const coloredDiffLines = computed(() => parseDiffLines(activeDiffText.value))

function statusIcon(file: FileChange): string {
  return FILE_STATUS_META[file.status]?.icon || "·"
}

function statusTitle(file: FileChange): string {
  const title = FILE_STATUS_META[file.status]?.title || file.status
  return file.oldPath ? `${title}: ${file.oldPath} -> ${file.path}` : title
}

function toggleStage(file: FileChange) {
  if (file.staged) {
    emit("unstageFile", file.path)
  } else {
    emit("stageFile", file.path)
  }
}

function toggleExpanded() {
  if (!props.tree) return // 数据未加载时不展开
  expanded.value = !expanded.value
  emit("update:expanded", expanded.value)
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

function handleSelectTemplate(tplId: string) {
  if (!tplId) return
  const tpl = props.commitTemplates?.find((t) => t.id === tplId)
  if (!tpl) return
  // 填充模板，支持 {branch}/{files} 占位符
  commitMessage.value = tpl.pattern
    .replace(/\{branch\}/g, props.tree?.branch || "")
    .replace(/\{files\}/g, String(props.tree?.files.length ?? 0))
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
