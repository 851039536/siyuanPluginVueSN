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
          <!-- 无可暂存内容时隐藏按钮，避免 disabled 常驻占位 -->
          <Button
            v-if="hasUnstaged"
            variant="ghost"
            size="xsmall"
            dense
            :disabled="gitOpLoading"
            @click.stop="$emit('stageAll')"
          >
            {{ i18n.stageAll }}
          </Button>
          <Button
            v-if="hasStaged"
            variant="ghost"
            size="xsmall"
            dense
            :disabled="gitOpLoading"
            @click.stop="$emit('unstageAll')"
          >
            {{ i18n.unstageAll }}
          </Button>
          <!-- 单独刷新工作区 -->
          <Button
            variant="ghost"
            size="xsmall"
            dense
            icon="refresh"
            :loading="refreshingWorkingTree"
            :title="i18n.refreshWorkingTree"
            @click.stop="$emit('refreshWorkingTree')"
          />
        </span>
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
          :class="{ staged: file.staged, 'diff-active': activeDiffFile?.path === file.path }"
          :title="i18n.clickViewDiff + ' — ' + file.path"
          @click="toggleDiff(file)"
        >
          <!-- 勾选框（共享 Checkbox 提供原生复选语义与 aria-checked；外层包一层拦截冒泡，避免触发整行查看差异） -->
          <span
            class="wt-checkbox"
            @click.stop
          >
            <Checkbox
              :model-value="file.staged"
              size="xsmall"
              :disabled="gitOpLoading"
              :aria-label="gitOpLoading ? i18n.processing : file.staged ? i18n.unstageFile : i18n.stageFile"
              :title="gitOpLoading ? i18n.processing : file.staged ? i18n.unstageFile : i18n.stageFile"
              @update:model-value="toggleStage(file)"
            />
          </span>

          <!-- 状态图标 -->
          <span
            class="wt-file-status"
            :class="`wt-s-${file.status}`"
            :title="fileStatusTitle(file, i18n)"
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

          <!-- 文件名（整行可点击查看差异） -->
          <span class="wt-file-path">{{ file.path }}</span>

          <!-- 丢弃更改（危险语义 ⇒ severity=danger 的红色文字） -->
          <Button
            class="wt-discard-btn"
            variant="ghost"
            size="xsmall"
            dense
            severity="danger"
            icon="undoVariant"
            :title="file.staged ? i18n.unstageDiscard : file.status === 'untracked' ? i18n.discardUntracked : i18n.discardChanges"
            @click.stop="$emit('discardFile', file.path, file.staged, file.status)"
          />
        </div>
      </div>

      <!-- 差异查看弹窗（子组件自含渲染与键盘导航，父只管开关与数据下发） -->
      <WorkingTreeDiffDialog
        v-if="activeDiffFile"
        :i18n="i18n"
        :file="activeDiffFile"
        :files="sortedFiles"
        :file-diffs="fileDiffs"
        :diff-loading="diffLoading"
        :git-op-loading="gitOpLoading"
        @close="activeDiffFile = null"
        @navigate="handleDiffNavigate"
        @stage-toggle="handleDiffStageToggle"
        @discard="handleDiffDiscard"
        @request-diff="handleDiffRequest"
      />

      <!-- 提交表单 -->
      <div
        v-if="hasStaged"
        class="wt-commit-form"
      >
        <!-- 常规提交类型快速选择 -->
        <div class="wt-commit-types">
          <Button
            v-for="ct in COMMIT_TYPE_VALUES"
            :key="ct"
            class="wt-type-btn"
            variant="ghost"
            size="xsmall"
            dense
            :aria-pressed="commitType === ct"
            @click.stop="commitType = ct; updateCommitMessage()"
          >
            {{ ct }}
          </Button>
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
          <Select
            class="wt-template-select"
            size="xsmall"
            :model-value="selectedTemplateId"
            :options="templateOptions"
            :aria-label="i18n.selectTemplate"
            @update:model-value="handleTemplateChange"
          />
        </div>
        <Textarea
          v-model="commitMessage"
          class="wt-commit-msg"
          size="xsmall"
          :rows="4"
          :placeholder="i18n.commitMessagePlaceholder"
        />
        <!-- 提交信息违规提示（实时校验，硬阻止提交） -->
        <span
          v-if="validationReason"
          class="wt-commit-invalid"
        >{{ i18n[COMMIT_RULE_REASON_META[validationReason].labelKey] }}</span>
        <div class="wt-commit-actions">
          <Button
            variant="ghost"
            size="xsmall"
            dense
            icon="sparkles"
            :loading="generating"
            :disabled="generating"
            @click.stop="$emit('generateMsg')"
          >
            {{ generating ? i18n.generating : i18n.generateMsg }}
          </Button>
          <Button
            variant="primary"
            size="xsmall"
            dense
            icon="sourceCommit"
            :loading="committing"
            :disabled="!commitMessage.trim() || committing || !!validationReason"
            @click.stop="handleCommit"
          >
            {{ committing ? i18n.committing : i18n.commit }}
          </Button>
        </div>
      </div>
      <!-- 操作反馈（不限提交表单可见，暂存失败等信息在此显示） -->
      <div
        v-if="commitOutput"
        class="wt-commit-output"
      >
        <Button
          class="wt-output-close"
          variant="ghost"
          size="xsmall"
          dense
          icon="close"
          :title="i18n.close"
          @click.stop="$emit('clearOutput')"
        />
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
import { COMMIT_RULE_REASON_META, COMMIT_TYPE_VALUES } from "../../types"
import { checkCommitRule } from "../../commitRuleChecker"
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
import Button from "@/components/Button.vue"
import Checkbox from "@/components/Checkbox.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Select from "@/components/Select.vue"
import Textarea from "@/components/Textarea.vue"

const props = defineProps<{
  i18n: Record<string, any>
  tree?: WorkingTreeInfo
  committing: boolean
  generating: boolean
  commitOutput: string
  fileDiffs: Record<string, string>
  /** 差异加载中标记（与 fileDiffs 同键同构，供弹窗区分「加载中」与「无差异」） */
  diffLoading: Record<string, boolean>
  generatedMsg: string
  gitOpLoading: boolean
  /** 工作区刷新加载中 */
  refreshingWorkingTree?: boolean
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
/** 提交信息模板下拉当前值（"" = 未选择模板） */
const selectedTemplateId = ref("")

/** 模板下拉选项（首项为「选择模板」占位项，选中首项即回到未选择态） */
const templateOptions = computed(() => [
  { value: "", label: props.i18n.selectTemplate },
  ...(props.commitTemplates ?? []).map((tpl) => ({ value: tpl.id, label: tpl.name })),
])

/** 当前提交信息命中规则问题（合规时为 null；硬阻止提交按钮并显示原因） */
const validationReason = computed(() => checkCommitRule(commitMessage.value))

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
    prefetchOtherScope(file)
  }
}

/** 弹窗内导航：切换当前差异文件并加载对应 diff */
function handleDiffNavigate(file: FileChange) {
  activeDiffFile.value = file
  emit("loadDiff", file.path, file.staged)
}

/**
 * 预取另一份差异：仅「已暂存 + 工作区又改动」的文件有两份差异，
 * 提前拉取后弹窗内切范围命中缓存即刻渲染（不做则首次切换要等一次 git 子进程）
 */
function prefetchOtherScope(file: FileChange) {
  if (file.staged && file.unstaged) emit("loadDiff", file.path, !file.staged)
}

/** 弹窗内切换差异范围：仅切换查看对象，不改变文件的暂存状态 */
function handleDiffRequest(staged: boolean) {
  const file = activeDiffFile.value
  if (!file) return
  emit("loadDiff", file.path, staged)
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

/** 模板下拉变更：Select 为纯受控组件（内部只 emit），必须先回写 ref 再填充模板内容 */
function handleTemplateChange(value: string | number | boolean | null) {
  selectedTemplateId.value = typeof value === "string" ? value : ""
  handleSelectTemplate(selectedTemplateId.value)
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
  if (validationReason.value) return
  emit("commit", commitMessage.value.trim())
}

defineExpose({ clear: () => { commitMessage.value = ""; commitType.value = "chore"; selectedTemplateId.value = "" } })
</script>

<style lang="scss">
@use "@/index.scss" as *;
@use "@/variables.scss" as *;
@use "../../styles/mixins" as *;
@use "../../styles/WorkingTreePanel.scss";
</style>
