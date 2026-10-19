<!-- Git 工作区文件变更面板 -->
<template>
  <!-- pointerdown 触发状态同步：双窗口并列（不切换窗口焦点）时点回面板同样能拿到最新状态 -->
  <div
    class="wt-panel"
    @pointerdown="handleAutoRefreshTrigger"
  >
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
            text
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

      <!-- 文件列表（本地分页：默认渲染前 200 行，其余经「加载更多」增量渲染；弹窗导航仍用完整列表） -->
      <div
        v-if="sortedFiles.length"
        class="wt-files"
      >
        <div
          v-for="file in pagedFiles"
          :key="file.path"
          class="wt-file-row"
          :class="{
            'staged': file.staged,
            'partially-staged': file.staged && file.unstaged,
            'diff-active': activeDiffFile?.path === file.path,
          }"
          role="button"
          tabindex="0"
          :aria-pressed="activeDiffFile?.path === file.path"
          :title="`${i18n.clickViewDiff} — ${file.path}`"
          @click="toggleDiff(file)"
          @keydown.enter.prevent="toggleDiff(file)"
          @keydown.space.prevent="toggleDiff(file)"
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

          <!-- 已暂存后又改动（porcelain MM/AM）：提示暂存区与工作区各有一份，提交只含暂存的那份 -->
          <span
            v-if="file.staged && file.unstaged"
            class="wt-partial-mark"
            :title="i18n.stagedAndUnstagedTip"
          ></span>

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
        <!-- 剩余文件增量渲染（复用日志面板/违规列表同款按钮） -->
        <LoadMoreButton
          v-if="filesHasMore"
          :i18n="i18n"
          :visible="pagedFiles.length"
          :total="sortedFiles.length"
          @load-more="loadMoreFiles"
        />
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
        <!-- 常规提交类型快速选择：按钮显示中文（title 提示标准单词），写入提交信息的前缀仍是 Conventional Commit 标准单词 -->
        <div class="wt-commit-types">
          <Button
            v-for="ct in COMMIT_TYPE_VALUES"
            :key="ct"
            class="wt-type-btn"
            variant="ghost"
            size="xsmall"
            dense
            :aria-pressed="commitType === ct"
            :title="ct"
            @click.stop="commitType = ct; updateCommitMessage()"
          >
            {{ commitTypeLabel(ct) }}
          </Button>
        </div>
        <Textarea
          ref="textareaEl"
          v-model="commitMessage"
          class="wt-commit-msg"
          size="xsmall"
          :rows="4"
          :placeholder="i18n.commitMessagePlaceholder"
        />
        <!-- 提交信息违规提示（实时校验，硬阻止提交；悬停显示该规则的判定说明与改法） -->
        <span
          v-if="validationReason"
          class="wt-commit-invalid"
          :title="ruleReasonDesc(validationReason, i18n)"
        >{{ ruleReasonText(validationReason, i18n) }}</span>
        <div class="wt-commit-actions">
          <Button
            variant="ghost"
            size="xsmall"
            dense
            :loading="generating"
            :disabled="generating || deepGenerating"
            @click.stop="$emit('generateMsg')"
          >
            {{ generating ? i18n.generating : i18n.generateMsg }}
          </Button>
          <!-- 深度生成：读取暂存区完整 diff 理解实际改动，输出标题行 + 改动要点（耗时与消耗高于常规生成） -->
          <Button
            variant="ghost"
            size="xsmall"
            dense
            :loading="deepGenerating"
            :disabled="generating || deepGenerating"
            :title="i18n.deepGenerateMsgTip"
            @click.stop="$emit('deepGenerateMsg')"
          >
            {{ deepGenerating ? i18n.deepGenerating : i18n.deepGenerateMsg }}
          </Button>
          <Button
            variant="primary"
            size="xsmall"
            dense
            icon="sourceCommit"
            :loading="committing"
            :disabled="isCommitIncomplete || committing || !!validationReason"
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
  CommitType,
  FileChange,
  WorkingTreeInfo,
} from "../../types"
import type { TimerHandle } from "@/utils/timerRegistry"
import {
  computed,
  nextTick,
  onUnmounted,
  ref,
  toRef,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import Checkbox from "@/components/Checkbox.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Textarea from "@/components/Textarea.vue"
import {

  TimerRegistry,
} from "@/utils/timerRegistry"
import { checkCommitRule } from "../../commitRuleChecker"
import { useGeneratedMsgSync } from "../../composables/useGeneratedMsgSync"
import { usePagedList } from "../../composables/usePagedList"
import {
  COMMIT_ANALYSIS_TYPE_META,
  COMMIT_TYPE_VALUES,
} from "../../types"
import {
  fileStatusIcon,
  fileStatusIconKey,
  fileStatusTitle,
  isIconFileStatus,
  ruleReasonDesc,
  ruleReasonText,
} from "../../utils"
import LoadMoreButton from "../common/LoadMoreButton.vue"
import WorkingTreeDiffDialog from "./WorkingTreeDiffDialog.vue"

const props = defineProps<{
  i18n: Record<string, any>
  tree?: WorkingTreeInfo
  committing: boolean
  generating: boolean
  /** 深度生成中（读取暂存区完整 diff，耗时高于常规生成） */
  deepGenerating: boolean
  commitOutput: string
  fileDiffs: Record<string, string>
  /** 差异加载中标记（与 fileDiffs 同键同构，供弹窗区分「加载中」与「无差异」） */
  diffLoading: Record<string, boolean>
  generatedMsg: string
  gitOpLoading: boolean
  /** 工作区刷新加载中 */
  refreshingWorkingTree?: boolean
}>()

const emit = defineEmits<{
  stageFile: [file: string]
  unstageFile: [file: string]
  stageAll: []
  unstageAll: []
  commit: [message: string]
  generateMsg: []
  /** 深度生成提交信息（暂存区完整 diff → 标题行 + 改动要点） */
  deepGenerateMsg: []
  /**
   * 查看文件差异。opts.status 透传 FileChange.status（untracked 命中数据层单进程快速路径）；
   *  opts.force=true 表示「内容必然已变」（写后重载），绕过数据层缓存命中
   */
  loadDiff: [file: string, staged: boolean, opts?: { force?: boolean, status?: string }]
  clearOutput: []
  discardFile: [file: string, staged: boolean, status: string]
  /** 手动刷新工作区（顶部刷新按钮，force 语义：必须重查，不复用在飞结果） */
  refreshWorkingTree: []
  /** 自动刷新工作区（pointerdown 触发，可复用调度器在飞单飞结果） */
  autoRefreshWorkingTree: []
}>()

/** 已写入的 Conventional Commit 前缀：type + 可选 scope + 可选 `!` 破坏性标记 */
const TYPE_PREFIX_RE = /^([A-Z]+)((?:\([^)]*\))?!?):\s*/i

/** 「尚未填写完成」：空串 / 纯空白 / 只有 type 前缀而没有描述 */
const INCOMPLETE_COMMIT_RE = /^(?:[A-Z]+(?:\([^)]*\))?!?:\s*)?$/i

const commitType = ref("chore")
const commitMessage = ref("")
const activeDiffFile = ref<FileChange | null>(null)
/** 提交信息输入框（类型按钮赋值后把焦点交回此处） */
const textareaEl = ref<InstanceType<typeof Textarea>>()

/**
 * 提交类型按钮的中文标签：直接复用提交分析分类的标签键（同名同源，避免文案二次维护）。
 * 只影响按钮显示，`commitType` 与写入提交信息的前缀始终是 Conventional Commit 标准单词。
 */
function commitTypeLabel(ct: CommitType): string {
  return props.i18n[COMMIT_ANALYSIS_TYPE_META[ct].labelKey] ?? ct
}

/** 提交信息是否尚未填写完成（空串 / 只有类型前缀）—— 未完成不报违规，也不允许提交 */
const isCommitIncomplete = computed(() => INCOMPLETE_COMMIT_RE.test(commitMessage.value.trim()))

/**
 * 当前提交信息命中规则问题（合规或尚未填写完成时为 null；硬阻止提交按钮并显示原因）。
 * 校验取 trim 后的文本：提交时本就 trim，避免「刚敲一个空格就闪违规」的噪音。
 */
const validationReason = computed(() =>
  isCommitIncomplete.value ? null : checkCommitRule(commitMessage.value.trim()),
)

// 监听外部生成的消息，自动填充
useGeneratedMsgSync(toRef(props, "generatedMsg"), commitMessage)

// ── 状态自动同步（避免停留在外部修改前的旧快照）──

/** 自动刷新防抖时长：合并「指针按下」的连续触发 */
const AUTO_REFRESH_DEBOUNCE_MS = 800
/**
 * 自动刷新最小间隔：距上次刷新过近时跳过——面板内操作本身已刷新，无需重复起 git 子进程。
 *  这是**自动触发**的 UI 限流（手动刷新按钮不受限）；数据层同名查询去重由调度器单飞承担
 */
const AUTO_REFRESH_MIN_INTERVAL_MS = 2000

/** 自动刷新定时器（统一入口 TimerRegistry，随组件卸载清理） */
const autoRefreshTimers = new TimerRegistry()
let autoRefreshTimer: TimerHandle | null = null
/** 最近一次工作区刷新开始时间戳（含面板内操作触发的刷新，用于自动触发的最小间隔判断） */
let lastRefreshStartedAt = 0

// 面板内操作（暂存 / 提交 / 丢弃 / 手动刷新）都会经过刷新标记，记录下来供自动刷新去重
watch(() => props.refreshingWorkingTree, (refreshing) => {
  if (refreshing) lastRefreshStartedAt = Date.now()
})

/**
 * 自动同步工作区状态：外部编辑器改完文件后，面板不再停留在修改前的快照。
 *
 * ⚠️ 只由 `@pointerdown` 触发（双窗口并列、点击面板不切焦点时使用）。
 * 窗口获焦的刷新收敛到探测层统一入口（useGitProbe.handleFocus → 全项目 refresh + 标脏）：
 * 曾经这里每张卡片各挂一个 window focus 监听，N 张卡获焦即并 N 路 force 查询，
 * 与探测层全量轮询叠加成 2N 量级 git 进程风暴（见 docs/gitPush-memory-cpu-review.md §P0-1）。
 *
 * ⚠️ 差异弹窗打开期间跳过：弹窗未 Teleport、渲染在本面板内，弹窗内的每次点击
 * （导航/复制/关闭）都会冒泡到此处，触发无意义的后台 git status —— 用户此时在「看」diff，
 * 不是在改文件；关闭弹窗后的下一次 pointerdown 自然恢复刷新。
 *
 * 已有待发定时器时不再重置：用户连续点击（每次 pointerdown 都会触发）会让刷新被无限推迟。
 */
function handleAutoRefreshTrigger() {
  if (activeDiffFile.value) return
  if (autoRefreshTimer !== null) return
  if (props.gitOpLoading || props.refreshingWorkingTree) return
  if (Date.now() - lastRefreshStartedAt < AUTO_REFRESH_MIN_INTERVAL_MS) return
  autoRefreshTimer = autoRefreshTimers.setTimeout(() => {
    autoRefreshTimer = null
    // 防抖期间可能已有操作触发过刷新，真正发出前再判一次
    if (props.gitOpLoading || props.refreshingWorkingTree) return
    // 自动路径单独事件：让父层以 force:false 复用调度器单飞，
    // 与顶部「刷新」按钮（force:true，必须重查）区分开
    emit("autoRefreshWorkingTree")
  }, AUTO_REFRESH_DEBOUNCE_MS)
}

onUnmounted(() => {
  autoRefreshTimers.clearAll()
})

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

// ── 文件列表本地分页：行内各挂一个 Checkbox + Button 组件实例，上千变更文件时
//    全量渲染拖慢卡片挂载/刷新。复用 usePagedList 模式（违规列表/日志面板同款）；
//    ⚠️ 差异弹窗导航必须用完整 sortedFiles（fileIndex 与 ←/→ 不受分页影响）。
/** 文件列表每页行数（200 行 ≈ 10 屏滚动量，超出的靠「加载更多」增量渲染） */
const WT_FILES_PAGE_SIZE = 200
const {
  paged: pagedFiles,
  hasMore: filesHasMore,
  loadMore: loadMoreFiles,
} = usePagedList(sortedFiles, WT_FILES_PAGE_SIZE)

function toggleStage(file: FileChange) {
  if (file.staged) {
    emit("unstageFile", file.path)
  } else {
    emit("stageFile", file.path)
  }
}

/** 打开差异弹窗：纯查看语义（非 force）。缓存命中时数据层直接返回（0 git 进程、无加载闪烁） */
function toggleDiff(file: FileChange) {
  if (activeDiffFile.value?.path === file.path && activeDiffFile.value?.staged === file.staged) {
    activeDiffFile.value = null
  } else {
    activeDiffFile.value = file
    emit("loadDiff", file.path, file.staged, { status: file.status })
    prefetchOtherScope(file)
  }
}

/**
 * 预取另一份差异：仅「已暂存 + 工作区又改动」的文件有两份差异，
 * 提前拉取后弹窗内切范围命中缓存即刻渲染（不做则首次切换要等一次 git 子进程）。
 * 缓存命中时数据层直接返回，重复打开不再重复付进程。
 */
function prefetchOtherScope(file: FileChange) {
  if (file.staged && file.unstaged) emit("loadDiff", file.path, !file.staged, { status: file.status })
}

/** 弹窗内导航：切换当前差异文件并加载对应 diff（非 force：已看过的文件命中缓存即时渲染） */
function handleDiffNavigate(file: FileChange) {
  activeDiffFile.value = file
  emit("loadDiff", file.path, file.staged, { status: file.status })
}

/** 弹窗内切换差异范围：仅切换查看对象，不改变文件的暂存状态（非 force，预取缓存可命中） */
function handleDiffRequest(staged: boolean) {
  const file = activeDiffFile.value
  if (!file) return
  emit("loadDiff", file.path, staged)
}

/**
 * 弹窗内暂存切换：翻转 staged 后重新加载 diff（缓存键含 staged 前缀）。
 *
 * 部分暂存文件（porcelain MM/AM：staged && unstaged）在「暂存」后，
 * 工作区那份改动已被并入暂存区 —— 若只翻转 staged 而保留 unstaged，
 * 弹窗会继续提供切到「已暂存」范围，而那份 diff 此时已为空。
 * 故暂存时同时清掉 unstaged，让 canSwitchScope 与实际状态一致；
 * 反向（取消暂存）则把内容交回工作区。
 * 真实状态仍以后续 tree 刷新为准（失败回滚由下方 watch 自愈）。
 *
 * ⚠️ force：暂存操作必然改变目标范围的 diff 内容，打开时预取的缓存已过期，必须重取。
 */
function handleDiffStageToggle() {
  const file = activeDiffFile.value
  if (!file) return
  const nextStaged = !file.staged
  toggleStage(file)
  activeDiffFile.value = {
    ...file,
    staged: nextStaged,
    unstaged: nextStaged ? false : file.unstaged,
  }
  emit("loadDiff", file.path, nextStaged, {
    force: true,
    status: file.status,
  })
}

/** 弹窗内丢弃：透传给父级确认流程，文件从树中消失后由下方 watch 关闭弹窗 */
function handleDiffDiscard() {
  const file = activeDiffFile.value
  if (!file) return
  emit("discardFile", file.path, file.staged, file.status)
}

/**
 * 树刷新后同步当前差异文件：两级匹配自愈——
 * - 精确匹配（path + staged 均未变）：跟随新对象；仅当暂存/未暂存计数相对**上一棵树**有变化
 *   （说明有文件内容被外部改动，可能就是当前文件）时 force 重取一次；计数均未变则 diff 必然未变，
 *   不重取（避免自动刷新风暴期反复 spawn git diff）；
 * - 仅同路径（staged 翻转，暂存/取消暂存操作后）：scope 已变，force 重取目标范围；
 * - 都不存在（丢弃/提交完成）则关闭弹窗。
 */
function syncActiveDiffOnTree(tree: WorkingTreeInfo, prev: WorkingTreeInfo | undefined) {
  const file = activeDiffFile.value
  if (!file) return
  const exact = tree.files.find((f) => f.path === file.path && f.staged === file.staged)
  if (exact) {
    activeDiffFile.value = exact
    const countsChanged = !prev
      || tree.stagedCount !== prev.stagedCount
      || tree.unstagedCount !== prev.unstagedCount
      || tree.untrackedCount !== prev.untrackedCount
    if (countsChanged) { emit("loadDiff", file.path, file.staged, {
      force: true,
      status: file.status,
    })
    }
    return
  }
  const samePath = tree.files.find((f) => f.path === file.path)
  if (samePath) {
    activeDiffFile.value = samePath
    // staged 翻转 ⇒ 目标范围的 diff 内容必然已变（暂存把工作区改动并入暂存区），必须 force
    emit("loadDiff", samePath.path, samePath.staged, {
      force: true,
      status: samePath.status,
    })
  } else {
    activeDiffFile.value = null
  }
}
watch(() => props.tree, (tree, prevTree) => {
  if (!tree) return
  syncActiveDiffOnTree(tree, prevTree)
})

/**
 * 按当前选中的类型写入/替换提交信息前缀（模板下拉移除后，这是唯一的快捷赋值入口）：
 * - 空输入 → 直接写入 `type: `，接着写描述即可
 * - 已有前缀 → 只换类型单词，保留 scope 与 `!` 破坏性标记
 * - 有正文无前缀 → 补上前缀
 */
async function updateCommitMessage() {
  const prefix = `${commitType.value}: `
  const current = commitMessage.value
  const matched = current.match(TYPE_PREFIX_RE)
  commitMessage.value = matched
    ? `${commitType.value}${matched[2]}: ${current.slice(matched[0].length)}`
    : prefix + current
  // 赋值后把焦点交给输入框，用户可以接着写描述
  await nextTick()
  textareaEl.value?.focus()
}

function handleCommit() {
  if (isCommitIncomplete.value) return
  if (validationReason.value) return
  emit("commit", commitMessage.value.trim())
}

// 提交成功后清空输入与类型选择：成功的判据是「暂存区已空」（挂在 v-if="hasStaged" 上的表单随之消失），
// 而失败时暂存区仍有内容、输入保留供用户修改重试。
// 此前把 clear() 经 defineExpose 暴露出去但无人调用，导致下一轮提交会看到上一轮的旧信息。
watch(hasStaged, (nowStaged, wasStaged) => {
  if (wasStaged && !nowStaged) {
    commitMessage.value = ""
    commitType.value = "chore"
  }
})
</script>

<style lang="scss">
@use "@/index.scss" as *;
@use "@/variables.scss" as *;
@use "../../styles/mixins" as *;
@use "../../styles/WorkingTreePanel.scss";
</style>
