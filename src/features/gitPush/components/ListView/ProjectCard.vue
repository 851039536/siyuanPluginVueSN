<!-- gitPush 项目卡片编排层（仅 project prop，数据与操作全部经 useCardServices/useCardData 注入） -->
<template>
  <div
    ref="rootEl"
    class="gp-card"
    :class="{ 'gp-card--collapsed': collapsed }"
    @click.capture="handleCardClick"
  >
    <!-- 手风琴收起态：单行摘要（名称/分支/最近提交/变更/同步状态/主推送），点击展开详情 -->
    <CardSummary
      v-if="collapsed"
      :project="project"
      :latest-commit-date="latestCommitDate"
      :stash-count="stashList.length"
      @expand="expand"
    />

    <!-- 卡片顶栏：信息区 + 操作按钮区（手风琴模式下额外提供"收起"按钮） -->
    <CardHeader
      v-if="!collapsed"
      :project="project"
      :branches="branches"
      :current-branch="pushStatus?.branch || ''"
      :md-files="mdFiles"
      :open-workspace-files="openWorkspaceFiles"
      :collapsible="isAccordion"
      @toggle-collapse="toggle"
    />

    <!-- 远程仓库状态（当前分支名统一由顶栏分支行展示，此处不再重复） -->
    <CardRemotes
      v-if="!collapsed"
      :project="project"
    />

    <!-- 冲突区（合并冲突的列表 + 解决操作）：阻断性信息，放在页签之前 -->
    <ConflictSection
      v-if="!collapsed"
      :conflicts="conflicts"
      :i18n="i18n"
      @resolve-conflict="(file: string, strategy: 'theirs' | 'ours') => ops.handleResolveConflict(project.id, file, strategy)"
      @abort-merge="ops.handleAbortMerge(project.id)"
    />

    <!-- 操作栏：拉取 / 推送（主操作上移到页签之前，避免长页签内容把它推到首屏之外） -->
    <CardActionBar
      v-if="!collapsed"
      :project="project"
    />

    <!-- 拉取/推送输出（运行中显示逐平台过程行；失败时内置 AI 分析入口；右上角可关闭结果） -->
    <OutputPanel
      v-if="!collapsed"
      :entries="pullOutputs"
      :running-states="pullRunningStates"
      :i18n="i18n"
      :project-name="project.name"
      action="pull"
      @clear="ops.clearRemoteOutput(project.id, 'pull')"
    />
    <OutputPanel
      v-if="!collapsed"
      :entries="pushOutputs"
      :running-states="pushRunningStates"
      :i18n="i18n"
      :project-name="project.name"
      action="push"
      @clear="ops.clearRemoteOutput(project.id, 'push')"
    />

    <!-- 多面板 Tab 切换（工作区 / 提交日志 / Stash / Tag）；面板经具名插槽下发，未激活面板不挂载 -->
    <CardTabs
      v-if="!collapsed"
      v-model="stashTagTab"
      :i18n="i18n"
      :changes-count="changesCount"
      :log-count="logEntries.length"
      :log-count-more="logCountMore"
      :stash-count="stashList.length"
      :tag-count="tags.length"
    >
      <!-- 工作区变更 -->
      <template #worktree>
        <WorkingTreePanel
          v-model:draft="commitDraft"
          :i18n="i18n"
          :tree="workingTree"
          :committing="committing || false"
          :generating="generatingMsg?.generating || false"
          :deep-generating="generatingMsg?.deepGenerating || false"
          :commit-output="commitOutput || ''"
          :generated-msg="generatingMsg?.text || ''"
          :file-diffs="fileDiffs"
          :diff-loading="diffLoading"
          :git-op-loading="gitOpLoading || false"
          :refreshing-working-tree="refreshingWorkingTree || false"
          :commit-templates="commitTemplates"
          :focus-request="explorerFocus"
          :get-changeset="loadChangeset"
          :project-path="project.path"
          @stage-file="(file: string) => ops.stageItem(project.id, file)"
          @unstage-file="(file: string) => ops.unstageItem(project.id, file)"
          @stage-all="ops.stageAllItems(project.id)"
          @unstage-all="ops.unstageAllItems(project.id)"
          @commit="(msg: string) => ops.handleCommit(project.id, msg)"
          @generate-msg="ops.handleGenerateMsg(project.id)"
          @deep-generate-msg="ops.handleDeepGenerateMsg(project.id)"
          @load-diff="loadDiff"
          @clear-output="ops.clearOutput(project.id)"
          @discard-file="(file: string, staged: boolean, status: string) => ops.handleDiscard(project.id, file, staged, status)"
          @discard-many="(files: DiscardTarget[]) => ops.handleDiscardMany(project.id, files)"
          @refresh-working-tree="ops.handleRefreshWorkingTree(project.id)"
          @auto-refresh-working-tree="ops.handleRefreshWorkingTree(project.id, { force: false })"
          @save-commit-templates="handleSaveCommitTemplates"
        />
      </template>

      <!-- 提交日志（数据卡内自持，刷新/换条数直调卡内重载） -->
      <template #log>
        <BranchCommitList
          :i18n="i18n"
          :entries="logEntries"
          :loading="logLoading"
          :tag-commit-map="tagCommitMap"
          :remote-tags="remoteTags"
          :initial-count="logLimit"
          :stats="logStats"
          @reload-commit-log="handleLogCountReload"
          @refresh-commit-log="() => reloadLog()"
          @fix-commit="openCommitFix"
          @add-tag="openTagCreate"
          @drop-commit="openCommitDrop"
          @view-files="openCommitFiles"
        />
      </template>

      <!-- Stash -->
      <template #stash>
        <StashSection
          :entries="stashList"
          :loading="stashLoading || false"
          :tree="workingTree"
          :gen-desc-loading="genStashDescLoading || false"
          :generated-msg="generatedStashMsg"
          :i18n="i18n"
          @stash-confirm="(msg: string) => ops.handleStashConfirmMsg(project.id, msg)"
          @gen-stash-desc="ops.handleGenStashDesc(project.id)"
          @stash-pop="(idx: number) => ops.handleStashPop(project.id, idx)"
          @stash-apply="(idx: number) => ops.handleStashApply(project.id, idx)"
          @stash-drop="(idx: number) => ops.handleStashDrop(project.id, idx)"
        />
      </template>

      <!-- Tag（列表数据卡内自持，刷新直调卡内重载） -->
      <template #tag>
        <TagPanel
          :tags="tags"
          :loading="tagsLoading"
          :push-loaded="tagPushLoading"
          :remotes="remoteNames"
          :i18n="i18n"
          @create="(name: string, message?: string) => ops.handleCreateTag(project.id, name, message)"
          @push="(tag: string, remote?: string) => ops.handlePushTag(project.id, tag, remote)"
          @delete="(tag: string) => ops.handleDeleteTag(project.id, tag)"
          @refresh="refreshTags"
        />
      </template>
    </CardTabs>

    <!-- 提交信息修正弹窗（LOG Tab 与规则检查共用） -->
    <CommitFixDialog
      v-if="fixingEntry"
      :i18n="i18n"
      :target="fixingEntry"
      @close="fixingEntry = null"
      @saved="handleFixSaved"
    />

    <!-- 删除历史提交弹窗（LOG Tab 行内入口；记录级删除、内容不变语义） -->
    <DropCommitDialog
      v-if="droppingEntry"
      :i18n="i18n"
      :target="droppingEntry"
      @close="droppingEntry = null"
      @saved="handleDropSaved"
    />

    <!-- 提交文件弹窗（LOG Tab 行内入口；列出该提交修改的文件清单） -->
    <CommitFilesDialog
      v-if="filesTarget"
      :i18n="i18n"
      :target="filesTarget"
      @close="filesTarget = null"
    />

    <!-- 在指定提交上打 Tag 弹窗（LOG Tab 行内入口） -->
    <TagCommitDialog
      v-if="taggingEntry"
      :i18n="i18n"
      :target="tagDialogTarget"
      @create="handleTagCreate"
      @close="taggingEntry = null"
    />

    <!-- 工作区文件浏览器（顶栏「浏览工作区文件」入口；只读整库文件树 + 类型预览 + 底部脚本面板） -->
    <WorkspaceExplorerDialog
      v-if="showWorkspaceFiles"
      :project="project"
      :i18n="i18n"
      :changes="workingTree?.files ?? []"
      @close="showWorkspaceFiles = false"
      @open-changes="handleOpenChanges"
    />
  </div>
</template>

<script setup lang="ts">
// gitPush 项目卡片编排层（仅 project prop，区块组件与 Tab 子组件的数据/操作全部下沉注入）
import type {
  CommitFixTarget,
  CommitLogEntry,
  CommitTemplate,
  DiscardTarget,
  GitProject,
} from "../../types"
import type { CardTabId } from "../../types/cardTab"
import {
  computed,
  nextTick,
  onMounted,
  ref,
  watch,
} from "vue"
import { showMessage } from "siyuan"
import { getErrorMessage } from "@/utils/stringUtils"
import { checkCommitRule } from "../../commitRuleChecker"
import { useCardAccordion } from "../../composables/useCardAccordion"
import { getCardTab, rememberCardTab, useCardData } from "../../composables/useCardData"
import { provideCardMenu } from "../../composables/useCardMenu"
import { useCardServices } from "../../composables/useCardServices"
import { useWorkspaceExplorer } from "../../composables/useWorkspaceExplorer"
import {
  getProjectRemoteNames,
  platformLabel,
} from "../../utils"
import CommitFilesDialog from "../common/CommitFilesDialog.vue"
import CommitFixDialog from "../common/CommitFixDialog.vue"
import DropCommitDialog from "../common/DropCommitDialog.vue"
import TagCommitDialog from "../common/TagCommitDialog.vue"
import BranchCommitList from "./BranchCommitList.vue"
import CardActionBar from "./CardActionBar.vue"
import CardHeader from "./CardHeader.vue"
import CardRemotes from "./CardRemotes.vue"
import CardSummary from "./CardSummary.vue"
import CardTabs from "./CardTabs.vue"
import ConflictSection from "./ConflictSection.vue"
import OutputPanel from "./OutputPanel.vue"
import StashSection from "./StashSection.vue"
import TagPanel from "./TagPanel.vue"
import WorkingTreePanel from "./WorkingTreePanel.vue"
import WorkspaceExplorerDialog from "./WorkspaceExplorerDialog.vue"

const props = defineProps<{
  project: GitProject
}>()

// 卡片服务（共享数据 / 响应式 Record 派生 / 派生函数 / 操作集群）
const {
  services,
  pushStatus,
  workingTree,
  changesCount,
  committing,
  stashLoading,
  commitOutput,
  generatingMsg,
  gitOpLoading,
  tagPushLoading,
  genStashDescLoading,
  generatedStashMsg,
  refreshingWorkingTree,
  pullOutputs,
  pushOutputs,
} = useCardServices(() => props.project)
const {
  shared,
  ops,
} = services
const i18n = shared.i18n
/** 提交模板（顶层 ref 绑定，模板中自动解包后下发给工作区面板） */
const commitTemplates = shared.commitTemplates

// 卡片内联下拉菜单（顶栏与操作栏共享互斥状态，行为与拆分前一致）
provideCardMenu()

// 手风琴 / 详细布局（上下文由 ListView 提供；未提供时退化为始终展开）
const { isAccordion, isExpanded, expand, toggle } = useCardAccordion(() => props.project.id)
/** 收起态：仅手风琴模式且未展开时为 true（详细模式恒为 false） */
const collapsed = computed(() => !isExpanded.value)

// ── 卡片自持 Tab 数据（log/branches/stash/tags/冲突/diff/md，经 manager 直取 + 父层信号重载）──
const {
  branches,
  logEntries,
  logLoading,
  logStats,
  stashList,
  tags,
  tagsLoading,
  tagCommitMap,
  remoteTags,
  conflicts,
  fileDiffs,
  diffLoading,
  mdFiles,
  ensureDetailsLoaded,
  ensureLogStats,
  ensureRemoteTags,
  reloadLog,
  refreshTags,
  loadDiff,
  loadChangeset,
  logLimit,
  setLogLimit,
} = useCardData(() => props.project)

/** Stash / Tag 面板 Tab 切换（恢复该项目上次激活的 Tab，切分类 / 切视图后不丢） */
const stashTagTab = ref<CardTabId>(getCardTab(props.project.id))

/** 提交信息草稿（shared 会话态；面板卸载 / 手风琴折叠不丢，提交成功后由面板清空） */
const commitDraft = computed({
  get: () => shared.commitDrafts.value[props.project.id] ?? "",
  set: (v: string) => {
    shared.commitDrafts.value[props.project.id] = v
  },
})

/** 最近一条提交时间（仅日志已缓存时可用；摘要只展示相对时间，不展示消息，不额外起 git） */
const latestCommitDate = computed(() => logEntries.value[0]?.date ?? "")

/** LOG 徽标是否可能还有更多：已加载条数达到抓取上限（选「全部」时不再追加 "+"） */
const logCountMore = computed(() => {
  const limit = logLimit.value
  return limit !== "all" && logEntries.value.length > 0 && logEntries.value.length >= limit
})

/**
 * 卡片「用户主动展开」时的刷新节流（ms）。
 *
 * 挂载**不再**刷新：详细模式下所有卡片都会挂载，切一次视图 = N 张卡各跑 2~3 个 git 进程
 * （v2 status + pushStatus），60 个项目≈150+ 进程，正是「切回收藏 / 有变更还在加载全部仓库」的主因。
 * 新鲜度由探测层兜底（GitDirWatcher 监听 .git + 2s 预筛轮询），卡片重挂载不该承担「重查仓库」的职责；
 * 用户真的进入某张卡（展开 / 点卡片 / 切回工作区 Tab）时仍会刷新，只是把最小间隔从 10s 提到 30s。
 */
const CARD_ENTER_REFRESH_MIN_INTERVAL_MS = 30_000

/**
 * 卡片进入「可见详情」时刷新一次工作区，并在确有变更时落到「变更」页签。
 * 触发点：手风琴**展开**（用户主动进入），不再包含挂载。
 * 刷新期间用户已手动切页签则不抢；刷新失败保持原页签。
 * 自动跳页签只在手风琴展开时做——详细模式卡片常开，跳页签会覆盖用户记住的 LOG / TAG 选择。
 */
function refreshWorkingTreeOnEnter() {
  if (!isExpanded.value) return
  const tabBeforeRefresh = stashTagTab.value
  void ops.refreshProjectStatus(props.project.id, { minIntervalMs: CARD_ENTER_REFRESH_MIN_INTERVAL_MS })
    .then(() => {
      if (!isAccordion.value || stashTagTab.value !== tabBeforeRefresh) return
      if (changesCount.value > 0) stashTagTab.value = "worktree"
    })
    .catch(() => {})
}

/** 卡片根节点（展开后把焦点交给「收起」按钮，避免键盘用户丢失焦点位置） */
const rootEl = ref<HTMLElement | null>(null)

watch(isExpanded, (expanded) => {
  if (expanded) refreshWorkingTreeOnEnter()
})

/**
 * 键盘展开后的焦点接力 + 滚动定位：
 * 摘要按钮会随收起态一起卸载，若不转移焦点，键盘用户会直接掉回页面顶部；
 * 同时把卡片滚入视口，避免展开后的详情落在可视区外。
 */
watch(isExpanded, (expanded) => {
  if (!expanded) return
  const active = document.activeElement
  const fromSummary = active instanceof HTMLElement && active.classList.contains("gp-summary-main")
  void nextTick(() => {
    rootEl.value?.scrollIntoView({ block: "nearest" })
    if (fromSummary) rootEl.value?.querySelector<HTMLElement>(".gp-collapse-btn")?.focus()
  })
})

/**
 * 挂载只做「有数据可渲染」：命中调度器缓存时 0 个 git 进程，缺数据才查一次（ensure 语义）。
 * 详细模式恒为展开态，watch 不会触发，故这里补一次 ensure —— 但**绝不**升级为 refresh。
 */
onMounted(() => {
  if (isExpanded.value) void ops.ensureProjectStatus(props.project.id)
})

/** 项目已配置的远程名列表（Tag 推送远程选择用） */
const remoteNames = computed(() => getProjectRemoteNames(props.project).map((r) => r.name))

// 运行中的推送/拉取平台（useRemoteProgress 启动时显式置 "pushing"，空闲默认 "pending" 不会误入；
// 供输出面板过程视图逐平台显示实时状态）
const pushRunningStates = computed(() =>
  buildRunningStates((key) => services.derived.getPushStatus(props.project.id, key) === "pushing"),
)
const pullRunningStates = computed(() =>
  buildRunningStates((key) => services.derived.isPulling(props.project.id, key)),
)

/** 按运行判据过滤已配置远程，产出输出面板过程视图条目 */
function buildRunningStates(isRunning: (key: string) => boolean) {
  return getProjectRemoteNames(props.project)
    .filter(({ key }) => isRunning(key))
    .map(({ key }) => ({
      key,
      label: platformLabel(key),
    }))
}

/** 当前正在修正的提交条目（null = 未打开修正弹窗） */
const fixingEntry = ref<CommitFixTarget | null>(null)

/** LOG Tab 点击修正按钮：把 CommitLogEntry 转为通用修正目标 */
function openCommitFix(entry: CommitLogEntry) {
  fixingEntry.value = {
    projectId: props.project.id,
    projectName: props.project.name,
    hash: entry.hash,
    message: entry.message,
    reason: checkCommitRule(entry.message) ?? undefined,
    isMerge: entry.isMerge,
  }
}

/** 历史重写后强制重查推送状态（ahead 计数已变；纯本地比对，不联网） */
function reloadPushStatusAfterRewrite() {
  void services.scheduler.loadPushStatus(props.project.id, { force: true }).catch(() => {})
}

/** 修正成功后关闭弹窗并刷新 LOG 数据 */
function handleFixSaved() {
  fixingEntry.value = null
  void reloadLog()
  reloadPushStatusAfterRewrite()
}

/** 保存提交模板：写盘后同步共享列表（所有卡片的下拉即时更新） */
async function handleSaveCommitTemplates(list: CommitTemplate[]) {
  try {
    await services.manager.saveCommitTemplates(list)
    shared.commitTemplates.value = list
  } catch (e: unknown) {
    showMessage(`${i18n.saveTemplatesFailed}: ${getErrorMessage(e)}`, 4000, "error")
  }
}

/** 当前正在删除的提交条目（null = 未打开删除弹窗） */
const droppingEntry = ref<CommitFixTarget | null>(null)

/** LOG Tab 点击删除按钮：把 CommitLogEntry 转为通用删除目标（复用 CommitFixTarget 形状） */
function openCommitDrop(entry: CommitLogEntry) {
  droppingEntry.value = {
    projectId: props.project.id,
    projectName: props.project.name,
    hash: entry.hash,
    message: entry.message,
    isMerge: entry.isMerge,
  }
}

/** 删除成功后刷新 LOG 数据（hash 已变，列表必须重抓）；弹窗停留展示备份路径，关闭交由 close 事件 */
function handleDropSaved() {
  void reloadLog()
  reloadPushStatusAfterRewrite()
}

/** 当前正在查看文件的提交条目（null = 未打开提交文件弹窗） */
const filesTarget = ref<CommitFixTarget | null>(null)

/** LOG Tab 点击查看文件：把 CommitLogEntry 转为通用查看目标（复用 CommitFixTarget 形状） */
function openCommitFiles(entry: CommitLogEntry) {
  filesTarget.value = {
    projectId: props.project.id,
    projectName: props.project.name,
    hash: entry.hash,
    message: entry.message,
    isMerge: entry.isMerge,
  }
}

/** 当前正在打 Tag 的提交条目（null = 未打开打 Tag 弹窗） */
const taggingEntry = ref<CommitLogEntry | null>(null)

/**
 * 打 Tag 弹窗目标（含该提交已命中的 Tag）。
 *  tagCommitMap 键（`%(objectname)` 完整 hash）与日志条目 hash（`%H` 完整 hash）同口径，直接精确匹配
 */
const tagDialogTarget = computed(() => {
  const entry = taggingEntry.value
  if (!entry) {
    return {
      projectName: props.project.name,
      hash: "",
      message: "",
      existingTags: [],
    }
  }
  return {
    projectName: props.project.name,
    hash: entry.hash,
    message: entry.message,
    existingTags: tagCommitMap.value.get(entry.hash) ?? [],
  }
})

/** LOG Tab 点击打 Tag 按钮：打开打 Tag 弹窗 */
function openTagCreate(entry: CommitLogEntry) {
  taggingEntry.value = entry
}

/** 弹窗确认打 Tag：在指定 commit 上创建（失败由统一 toast 提示），成功后关闭并重载 Tag 数据 */
function handleTagCreate(name: string, message?: string) {
  const entry = taggingEntry.value
  if (!entry) return
  ops.handleCreateTag(props.project.id, name, message, entry.hash)
  taggingEntry.value = null
}

/** LOG 列表变更显示条数：同步卡片级 logLimit 并按新条数重载（保证后续无参刷新沿用该值） */
function handleLogCountReload(count: number | "all") {
  setLogLimit(count)
  void reloadLog(count)
}

// 切回 worktree 时刷新工作区（refresh 语义 + 最小间隔节流由调度器裁决，避免与面板内操作重复发 git）；
// 切到 log 时懒加载该项的高代价统计（--shortstat），切到 tag 时懒加载网络 ls-remote 状态
watch(stashTagTab, (val) => {
  // 记忆本次选择：卡片卸载（切分类 / 切智能视图）后重挂载时恢复
  rememberCardTab(props.project.id, val)
  if (val === "worktree") {
    void ops.refreshProjectStatus(props.project.id)
    return
  }
  void ensureDetailsLoaded()
  if (val === "log") ensureLogStats()
  if (val === "tag") ensureRemoteTags()
})

// 恢复的非工作区 Tab 需要在挂载时补齐其懒加载域（重挂载不会有点击事件）
onMounted(() => {
  if (stashTagTab.value === "worktree") return
  void ensureDetailsLoaded()
  if (stashTagTab.value === "log") ensureLogStats()
  else if (stashTagTab.value === "tag") ensureRemoteTags()
})

/** 交互控件判定：点这些元素只补项目状态，不触发详情懒加载（避免点「编辑 / 删除」也跑 4 条 git） */
const INTERACTIVE_CLICK_SELECTOR = "button, a, input, textarea, select, [role='button'], [role='menuitem'], [role='tab'], [contenteditable='true']"

/**
 * 点击卡片空白处时补齐当前项目数据（幂等：状态按 ensure + 详情在途共享，重复点击不产生额外查询）。
 * 交互控件自身的点击不算「进入卡片」——详情由页签切换 / 展开时按需加载。
 */
function handleCardClick(e: MouseEvent) {
  void ops.ensureProjectStatus(props.project.id)
  const target = e.target as HTMLElement | null
  if (target?.closest(INTERACTIVE_CLICK_SELECTOR)) return
  void ensureDetailsLoaded()
  // 当前激活面板若是 LOG/TAG，点空白处也补齐其懒加载域
  if (stashTagTab.value === "log") ensureLogStats()
  else if (stashTagTab.value === "tag") ensureRemoteTags()
}

// ── 工作区文件浏览器（顶栏按钮打开；角标点击回到工作区 Tab 并打开该文件差异）──
// 弹窗开关与一次性定位请求由 composable 持有（含请求清空时序），本层只负责 Tab 切换副作用
const {
  visible: showWorkspaceFiles,
  focus: explorerFocus,
  open: openWorkspaceFiles,
  locate: handleOpenChanges,
} = useWorkspaceExplorer({
  changes: () => workingTree.value?.files,
  openWorktreeTab: () => {
    stashTagTab.value = "worktree"
    rememberCardTab(props.project.id, "worktree")
  },
})
</script>
