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
          <!-- 选择模式：摘要条只保留批量动作，避免与单项暂存/丢弃混排造成误点 -->
          <template v-if="selectionMode">
            <span class="wt-selection-count">{{ i18n.discardSelectedCount.replace("{0}", String(selectedCount)) }}</span>
            <Button
              variant="ghost"
              size="xsmall"
              dense
              icon="checkboxMultipleOutline"
              :title="allFilesSelected ? i18n.discardClearSelection : i18n.selectAll"
              :aria-label="allFilesSelected ? i18n.discardClearSelection : i18n.selectAll"
              @click.stop="toggleSelectAll"
            />
            <Button
              variant="ghost"
              size="xsmall"
              dense
              severity="danger"
              :disabled="selectedCount === 0 || gitOpLoading"
              @click.stop="discardSelected"
            >
              {{ i18n.discardSelected }}
            </Button>
            <Button
              variant="ghost"
              size="xsmall"
              dense
              icon="close"
              :title="i18n.cancel"
              :aria-label="i18n.cancel"
              @click.stop="exitSelection"
            />
          </template>
          <template v-else>
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
            <!-- 选择性丢弃：进入多选模式后按勾选批量丢弃 -->
            <Button
              variant="ghost"
              size="xsmall"
              dense
              icon="checkboxMultipleOutline"
              :title="i18n.discardSelectMode"
              :aria-label="i18n.discardSelectMode"
              :disabled="gitOpLoading"
              @click.stop="enterSelection"
            />
            <!-- 全部丢弃：图标与行内丢弃一致（危险色），未跟踪/新增文件会被从磁盘删除，确认弹窗会点明数量 -->
            <Button
              variant="ghost"
              size="xsmall"
              dense
              severity="danger"
              icon="undoVariant"
              :title="i18n.discardAll"
              :aria-label="i18n.discardAll"
              :disabled="gitOpLoading"
              @click.stop="discardAll"
            />
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
          </template>
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
            'diff-active': !selectionMode && activeDiffFile?.path === file.path,
            'selection-mode': selectionMode,
            'selected': selectionMode && selectedPaths.has(file.path),
          }"
          role="button"
          tabindex="0"
          :aria-pressed="selectionMode ? selectedPaths.has(file.path) : activeDiffFile?.path === file.path"
          :title="selectionMode ? i18n.selectFile : `${i18n.clickViewDiff} — ${file.path}`"
          @click="selectionMode ? toggleSelect(file) : toggleDiff(file)"
          @keydown.enter.prevent="selectionMode ? toggleSelect(file) : toggleDiff(file)"
          @keydown.space.prevent="selectionMode ? toggleSelect(file) : toggleDiff(file)"
        >
          <!-- 勾选框（共享 Checkbox 提供原生复选语义与 aria-checked；外层包一层拦截冒泡，避免触发整行查看差异） -->
          <span
            class="wt-checkbox"
            @click.stop
          >
            <!-- 选择模式下同一位置换成「批量丢弃选择框」，不并存两套勾选框（避免误把暂存当选择） -->
            <Checkbox
              v-if="selectionMode"
              :model-value="selectedPaths.has(file.path)"
              size="xsmall"
              :aria-label="i18n.selectFile"
              :title="i18n.selectFile"
              @update:model-value="(value: boolean | any[]) => setSelected(file.path, value === true)"
            />
            <Checkbox
              v-else
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

          <!-- 丢弃更改（危险语义 ⇒ severity=danger 的红色文字）；选择模式下由摘要条的「丢弃所选」统一处理 -->
          <Button
            v-if="!selectionMode"
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

      <!-- 审阅流弹窗（多文件连续浏览 + 目录树索引；子组件自含 changeset 取数与键盘导航） -->
      <DiffStreamDialog
        v-if="activeDiffFile"
        :i18n="i18n"
        :files="sortedFiles"
        :file-diffs="fileDiffs"
        :diff-loading="diffLoading"
        :git-op-loading="gitOpLoading"
        :focus-file="activeDiffFile"
        :get-changeset="getChangeset"
        :project-path="projectPath"
        @close="activeDiffFile = null"
        @stage-file="(file: string) => emit('stageFile', file)"
        @unstage-file="(file: string) => emit('unstageFile', file)"
        @stage-all="emit('stageAll')"
        @unstage-all="emit('unstageAll')"
        @stage-toggle="handleStreamStageToggle"
        @discard="handleStreamDiscard"
        @load-diff="(file: string, staged: boolean, opts?: { force?: boolean, status?: string, context?: number }) => emit('loadDiff', file, staged, opts)"
      />

      <!-- 提交表单 -->
      <div
        v-if="hasStaged"
        class="wt-commit-form"
      >
        <!-- 提交模板：选择即套用（{branch} / {files} 自动替换）；齿轮打开模板管理 -->
        <div class="wt-commit-template">
          <Select
            :model-value="templatePick"
            :options="templateOptions"
            size="xsmall"
            class="wt-template-select"
            :placeholder="i18n.templateSelectPlaceholder"
            :aria-label="i18n.templateSelectLabel"
            filterable
            @update:model-value="applyTemplate"
          />
          <Button
            variant="ghost"
            size="xsmall"
            dense
            icon="cogOutline"
            :title="i18n.manageTemplates"
            @click.stop="showTemplatesDialog = true"
          />
        </div>
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

    <!-- 提交模板管理弹窗（自包含编辑态，保存后回传整表） -->
    <CommitTemplatesDialog
      v-if="showTemplatesDialog"
      :i18n="i18n"
      :templates="commitTemplates"
      @close="showTemplatesDialog = false"
      @saved="handleTemplatesSaved"
    />
  </div>
</template>

<script setup lang="ts">
import type {
  CommitType,
  DiscardTarget,
  FileChange,
  WorkingTreeInfo,
} from "../../types"
import type { CommitTemplate } from "../../types/storage"
import type { SelectOption } from "@/components/Select.vue"
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
import Select from "@/components/Select.vue"
import Textarea from "@/components/Textarea.vue"
import CommitTemplatesDialog from "../common/CommitTemplatesDialog.vue"
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
import DiffStreamDialog from "./DiffStreamDialog.vue"

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
  /** 提交模板（卡内共享数据下发；空数组 = 未配置模板） */
  commitTemplates: CommitTemplate[]
  /**
   * 外部定位请求（工作区文件浏览器点击变更角标）：切到本 Tab 后直接打开该文件差异。
   * seq 每次递增，保证同一文件重复请求也能触发。
   */
  focusRequest?: { file: FileChange, seq: number } | null
  /**
   * 取整个变更集的补丁（审阅流首屏：一次 git diff 覆盖全部 tracked 文件）。
   * 未跟踪文件不在结果中，由审阅流对缺失路径回退 loadDiff。
   * 返回 `null` 表示取数失败（超 maxBuffer / git 报错），审阅流据此显示降级提示。
   */
  getChangeset: (staged: boolean, opts?: { force?: boolean }) => Promise<Record<string, string> | null>
  /** 项目绝对路径（审阅流按文件拼出所在目录，供「打开所在文件夹」用） */
  projectPath: string
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
   *  opts.force=true 表示「内容必然已变」（写后重载），绕过数据层缓存命中；
   *  opts.context 为展开折叠条时请求的上下文行数（缺省 3 行）
   */
  loadDiff: [file: string, staged: boolean, opts?: { force?: boolean, status?: string, context?: number }]
  clearOutput: []
  discardFile: [file: string, staged: boolean, status: string]
  /** 批量丢弃（摘要条的「全部丢弃」/「丢弃所选」）：确认与冲突过滤由父层 handler 完成 */
  discardMany: [files: DiscardTarget[]]
  /** 手动刷新工作区（顶部刷新按钮，force 语义：必须重查，不复用在飞结果） */
  refreshWorkingTree: []
  /** 自动刷新工作区（pointerdown 触发，可复用调度器在飞单飞结果） */
  autoRefreshWorkingTree: []
  /** 保存提交模板（模板管理弹窗保存后整表回传） */
  saveCommitTemplates: [templates: CommitTemplate[]]
}>()

/** 已写入的 Conventional Commit 前缀：type + 可选 scope + 可选 `!` 破坏性标记 */
const TYPE_PREFIX_RE = /^([A-Z]+)((?:\([^)]*\))?!?):\s*/i

/** 「尚未填写完成」：空串 / 纯空白 / 只有 type 前缀而没有描述 */
const INCOMPLETE_COMMIT_RE = /^(?:[A-Z]+(?:\([^)]*\))?!?:\s*)?$/i

const commitType = ref("chore")
/** 提交信息（v-model:draft）：草稿由父层按项目持有，卡片折叠 / 切分类卸载面板时不丢 */
const commitMessage = defineModel<string>("draft", { default: "" })
/** 提交模板选择（空串 = 未选择；选中后立即套用并复位） */
const templatePick = ref<string | number>("")
/** 模板管理弹窗开关 */
const showTemplatesDialog = ref(false)
/** 模板下拉选项（来自卡内共享的 commitTemplates） */
const templateOptions = computed<SelectOption[]>(() =>
  props.commitTemplates.map((t) => ({ value: t.id, label: t.name })),
)
/** 审阅流弹窗锚点：null = 未打开；非 null = 打开并在流中定位到该文件 */
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
 * ⚠️ 审阅流弹窗打开期间跳过：弹窗未 Teleport、渲染在本面板内，弹窗内的每次点击
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

// ── 选择性丢弃（多选模式）──
//
// 为什么用「模式」而不是常驻复选框：行内勾选框已经被「暂存/取消暂存」占用，
// 再并一个勾选框会让用户分不清哪颗是暂存、哪颗是选择（一次误点就是不可逆的丢弃）。
// 模式内勾选框**替换**暂存勾选框，语义唯一。
/** 是否处于多选丢弃模式 */
const selectionMode = ref(false)
/** 已选路径（只在选择模式下生效；浏览态一律忽略，避免残留选择影响下次进入） */
const selectedPaths = ref<Set<string>>(new Set())

/** 选中项 → 丢弃目标（沿用 sortedFiles 顺序，与确认文案里的数量口径一致） */
const selectedDiscardTargets = computed<DiscardTarget[]>(() =>
  sortedFiles.value
    .filter((file) => selectedPaths.value.has(file.path))
    .map((file) => ({ path: file.path, status: file.status, staged: file.staged })),
)
const selectedCount = computed(() => selectedDiscardTargets.value.length)
const allFilesSelected = computed(() =>
  sortedFiles.value.length > 0 && selectedCount.value === sortedFiles.value.length,
)

/** 进入选择模式：清空上轮残留，避免「上次选过」变成一次意外的批量丢弃 */
function enterSelection() {
  // 审阅流弹窗盖在列表上，且选择模式下行点击不再打开差异 —— 先关掉，避免两套交互叠在一起
  activeDiffFile.value = null
  selectionMode.value = true
  selectedPaths.value = new Set()
}

/** 退出选择模式（丢弃完成或用户取消） */
function exitSelection() {
  selectionMode.value = false
  selectedPaths.value = new Set()
}

/** 设置单个文件的选择态（由 Checkbox 的 update 事件驱动，避免取反式切换出现双翻转） */
function setSelected(path: string, selected: boolean) {
  const next = new Set(selectedPaths.value)
  if (selected) next.add(path)
  else next.delete(path)
  selectedPaths.value = next
}

/** 整行点击 = 切换选择（选择模式下不再打开审阅流） */
function toggleSelect(file: FileChange) {
  setSelected(file.path, !selectedPaths.value.has(file.path))
}

/** 全选 / 清空（按已选数量判断，语义随按钮标题切换） */
function toggleSelectAll() {
  selectedPaths.value = allFilesSelected.value
    ? new Set()
    : new Set(sortedFiles.value.map((file) => file.path))
}

/** 丢弃所选：确认与冲突过滤在父层 handler 完成；成功后由 tree 刷新裁剪选择集 */
function discardSelected() {
  const files = selectedDiscardTargets.value
  if (files.length === 0) return
  emit("discardMany", files)
}

/** 全部丢弃：目标取**完整** sortedFiles（不是分页后的 pagedFiles，否则只丢前 200 个） */
function discardAll() {
  const files = sortedFiles.value.map((file) => ({
    path: file.path,
    status: file.status,
    staged: file.staged,
  }))
  if (files.length === 0) return
  emit("discardMany", files)
}

/**
 * 工作区刷新后裁剪选择集：
 *   · 已消失的路径（丢弃成功 / 被提交）从选择里去掉；
 *   · 列表清空则自动退出选择模式，避免停在一个没有任何目标的空模式里。
 */
watch(sortedFiles, (files) => {
  if (!selectionMode.value) return
  const alive = new Set(files.map((file) => file.path))
  const next = new Set([...selectedPaths.value].filter((path) => alive.has(path)))
  if (next.size !== selectedPaths.value.size) selectedPaths.value = next
  if (files.length === 0) exitSelection()
})

/**
 * 打开审阅流并定位到该文件。
 * 与旧的单文件弹窗不同，这里不再「点同一文件 = 关闭」——审阅流一次承载全部变更，
 * 重复点击只重新定位（要关闭走 X / Esc / 遮罩）。
 * diff 由弹窗自己一次取回（含未跟踪文件的回退），这里不再逐文件请求。
 */
function toggleDiff(file: FileChange) {
  activeDiffFile.value = file
}
// 外部定位：文件浏览器角标点击后，父层切到本 Tab 并下发请求，这里复用「打开审阅流」链路
watch(() => props.focusRequest?.seq, () => {
  const request = props.focusRequest
  if (request) toggleDiff(request.file)
}, { immediate: true })

/**
 * 流内暂存切换：翻转该文件暂存态并重取 diff（缓存键含 staged 前缀）。
 *
 * 部分暂存文件（porcelain MM/AM：staged && unstaged）在「暂存」后，工作区那份改动已被并入暂存区——
 * 若只翻转 staged 而保留 unstaged，文件段会继续提供切到「已暂存」的按钮，而那份 diff 此时已为空。
 * 故暂存时同时清掉 unstaged；反向（取消暂存）则把内容交回工作区。真实状态仍以后续 tree 刷新为准。
 */
function handleStreamStageToggle(file: FileChange) {
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

/** 流内丢弃：透传给父级确认流程，文件从树中消失后由下方 watch 关闭弹窗 */
function handleStreamDiscard(file: FileChange) {
  emit("discardFile", file.path, file.staged, file.status)
}

/**
 * 树刷新后同步锚点文件：文件仍在则跟随新对象（暂存态可能已翻转），
 * 已被提交 / 丢弃则关闭审阅流。diff 内容由弹窗按工作区版本自行重取，这里不再逐文件 force。
 */
function syncStreamAnchor(tree: WorkingTreeInfo) {
  const file = activeDiffFile.value
  if (!file) return
  const same = tree.files.find((f) => f.path === file.path)
  activeDiffFile.value = same ?? null
}
watch(() => props.tree, (tree) => {
  if (tree) syncStreamAnchor(tree)
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

/**
 * 套用提交模板：已有 Conventional 前缀则替换（保留其后的描述），否则前置；
 * `{branch}` 替换为当前分支、`{files}` 替换为暂存文件数。
 */
async function applyTemplate(value: string | number | boolean | null) {
  const id = typeof value === "string" ? value : String(value ?? "")
  const tpl = props.commitTemplates.find((t) => t.id === id)
  // 无论是否命中都复位下拉，保证同一模板可连续选择
  templatePick.value = ""
  if (!tpl) return
  const branch = props.tree?.branch || ""
  const files = props.tree?.stagedCount ?? 0
  const pattern = tpl.pattern
    .replace(/\{branch\}/g, branch)
    .replace(/\{files\}/g, String(files))
  const current = commitMessage.value
  const matched = current.match(TYPE_PREFIX_RE)
  commitMessage.value = matched
    ? pattern + current.slice(matched[0].length)
    : pattern + current
  await nextTick()
  textareaEl.value?.focus()
}

/** 模板管理弹窗保存：关闭弹窗并把整表交给父级持久化 */
function handleTemplatesSaved(list: CommitTemplate[]) {
  showTemplatesDialog.value = false
  emit("saveCommitTemplates", list)
}

// 提交成功后清空输入与类型选择：成功的判据是「暂存区已空」（挂在 v-if="hasStaged" 上的表单随之消失），
// 而失败时暂存区仍有内容、输入保留供用户修改重试。
// 此前把 clear() 经 defineExpose 暴露出去但无人调用，导致下一轮提交会看到上一轮的旧信息。
watch(hasStaged, (nowStaged, wasStaged) => {
  if (wasStaged && !nowStaged) {
    commitMessage.value = ""
    commitType.value = "chore"
    templatePick.value = ""
  }
})
</script>

<style lang="scss">
@use "@/variables.scss" as *;
@use "../../styles/mixins" as *;
@use "../../styles/WorkingTreePanel.scss";
</style>
