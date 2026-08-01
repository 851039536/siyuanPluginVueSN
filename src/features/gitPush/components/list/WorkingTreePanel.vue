<!-- Git 工作区文件变更面板 -->
<template>
  <div class="wt-panel">
    <!-- 工作区摘要条 -->
    <div
      class="wt-summary"
    >
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
        <span class="wt-summary-actions">
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm"
            :disabled="!hasUnstaged || gitOpLoading"
            @click.stop="$emit('stageAll')"
          >
            {{ i18n.stageAll }}
          </button>
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm"
            :disabled="!hasStaged || gitOpLoading"
            @click.stop="$emit('unstageAll')"
          >
            {{ i18n.unstageAll }}
          </button>
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm"
            @click.stop="$emit('refreshWorkingTree')"
          >
            <Icon icon="mdi:refresh" height="12" />
          </button>
        </span>
      </template>
      <template v-else-if="tree">
        <span class="wt-clean">{{ i18n.workingTreeClean }}</span>
      </template>
    </div>

    <!-- 工作区详情 -->
    <div class="wt-body">

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
            <!-- 加载中显示旋转图标，否则按暂存状态显示勾选框 -->
            <Icon
              :icon="gitOpLoading ? 'mdi:loading' : file.staged ? 'mdi:checkbox-marked' : 'mdi:checkbox-blank-outline'"
              :class="{ 'gp-spin': gitOpLoading }"
              height="12"
            />
          </button>

          <!-- 状态图标 -->
          <span
            class="wt-file-status"
            :class="`wt-s-${file.status}`"
            :title="fileStatusTitle(file)"
          >
            <!-- renamed/unmerged 用 IconWrapper 图标渲染，其余状态用字符标记（图标名与字符均来自 FILE_STATUS_META） -->
            <IconWrapper
              v-if="isIconFileStatus(file)"
              :name="fileStatusIconKey(file)"
              :size="12"
            />
            <template v-else>
              {{ fileStatusIcon(file) }}
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

      <!-- 差异查看弹窗（子组件自含渲染与键盘导航，父只管开关与数据下发） -->
      <WorkingTreeDiffDialog
        v-if="activeDiffFile"
        :i18n="i18n"
        :file="activeDiffFile"
        :files="sortedFiles"
        :file-diffs="fileDiffs"
        :git-op-loading="gitOpLoading"
        @close="activeDiffFile = null"
        @navigate="handleDiffNavigate"
        @stage-toggle="handleDiffStageToggle"
        @discard="handleDiffDiscard"
      />

      <!-- 提交表单 -->
      <div
        v-if="hasStaged"
        class="wt-commit-form"
      >
        <!-- 常规提交类型快速选择 -->
        <div class="wt-commit-types">
          <button
            v-for="ct in COMMIT_TYPE_VALUES"
            :key="ct"
            class="wt-type-btn"
            :class="{ active: commitType === ct }"
            @click.stop="commitType = ct; updateCommitMessage()"
          >
            {{ ct }}
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
            @click.stop="$emit('generateMsg')"
          >
            <Icon
              :icon="generating ? 'mdi:loading' : 'mdi:auto-fix'"
              :class="{ 'gp-spin': generating }"
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
              :icon="committing ? 'mdi:loading' : 'mdi:source-commit'"
              :class="{ 'gp-spin': committing }"
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
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  CommitTemplate,
  FileChange,
  WorkingTreeInfo,
} from "../../types"
import { COMMIT_TYPE_VALUES } from "../../types"
import { fileStatusIcon, fileStatusIconKey, fileStatusTitle, isIconFileStatus } from "../../utils"
import { useGeneratedMsgSync } from "../../composables/useGeneratedMsgSync"
import WorkingTreeDiffDialog from "./WorkingTreeDiffDialog.vue"
import { Icon } from "@iconify/vue"
import {
  computed,
  ref,
  toRef,
  watch,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"

const props = defineProps<{
  i18n: Record<string, any>
  tree?: WorkingTreeInfo
  committing: boolean
  generating: boolean
  commitOutput: string
  fileDiffs: Record<string, string>
  generatedMsg: string
  gitOpLoading: boolean
  /** 提交信息模板 */
  commitTemplates?: CommitTemplate[]
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
  /** 单独刷新工作区 */
  refreshWorkingTree: []
}>()

const commitType = ref("chore")
const commitMessage = ref("")
const activeDiffFile = ref<FileChange | null>(null)

// 监听外部生成的消息，自动填充
useGeneratedMsgSync(toRef(props, "generatedMsg"), commitMessage)

// 摘要按钮与提交表单共用的暂存状态判断（消除模板中多处 ?? 0 空值守卫）
const hasStaged = computed(() => (props.tree?.stagedCount ?? 0) > 0)
const hasUnstaged = computed(() => ((props.tree?.unstagedCount ?? 0) + (props.tree?.untrackedCount ?? 0)) > 0)

const sortedFiles = computed(() => {
  if (!props.tree) return []
  return [...props.tree.files].sort((a, b) => {
    // 已暂存的排前面
    if (a.staged !== b.staged) return a.staged ? -1 : 1
    // 同组内按路径排序
    return a.path.localeCompare(b.path)
  })
})

function toggleStage(file: FileChange) {
  if (file.staged) {
    emit("unstageFile", file.path)
  } else {
    emit("stageFile", file.path)
  }
}

function toggleDiff(file: FileChange) {
  if (activeDiffFile.value?.path === file.path && activeDiffFile.value?.staged === file.staged) {
    activeDiffFile.value = null
  } else {
    activeDiffFile.value = file
    emit("loadDiff", file.path, file.staged)
  }
}

/** 弹窗内导航：切换当前差异文件并加载对应 diff */
function handleDiffNavigate(file: FileChange) {
  activeDiffFile.value = file
  emit("loadDiff", file.path, file.staged)
}

/** 弹窗内暂存切换：翻转 staged 后重新加载 diff（缓存键含 staged 前缀） */
function handleDiffStageToggle() {
  const file = activeDiffFile.value
  if (!file) return
  toggleStage(file)
  activeDiffFile.value = { ...file, staged: !file.staged }
  emit("loadDiff", file.path, !file.staged)
}

/** 弹窗内丢弃：透传给父级确认流程，文件从树中消失后由下方 watch 关闭弹窗 */
function handleDiffDiscard() {
  const file = activeDiffFile.value
  if (!file) return
  emit("discardFile", file.path, file.staged, file.status)
}

// 树刷新后同步当前差异文件：两级匹配自愈——精确匹配则跟随新对象；仅同路径（操作失败回滚等）则改指现存条目；都不存在（丢弃/提交完成）则关闭弹窗
watch(() => props.tree, (tree) => {
  const file = activeDiffFile.value
  if (!file || !tree) return
  const exact = tree.files.find((f) => f.path === file.path && f.staged === file.staged)
  if (exact) {
    activeDiffFile.value = exact
    return
  }
  const samePath = tree.files.find((f) => f.path === file.path)
  if (samePath) {
    activeDiffFile.value = samePath
    emit("loadDiff", samePath.path, samePath.staged)
  } else {
    activeDiffFile.value = null
  }
})

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

function handleCommit() {
  if (!commitMessage.value.trim()) return
  emit("commit", commitMessage.value.trim())
}

defineExpose({ clear: () => { commitMessage.value = ""; commitType.value = "chore" } })
</script>

<style lang="scss">
@use "@/index.scss" as *;
@use "../../styles/variables" as *;
@use "../../styles/mixins" as *;
@use "../../styles/WorkingTreePanel.scss";
</style>
