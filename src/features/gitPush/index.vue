<!-- gitPush Git 项目管理主面板（Dock 侧栏 / 独立窗口 tab 双形态） -->
<template>
  <div
    ref="panelRootEl"
    class="git-push-panel"
  >
    <!-- 头部 -->
    <PanelHeader
      v-model:currentView="currentView"
      v-model:showPlatformMenu="showPlatformMenu"
      v-model:showAddMenu="showAddMenu"
      v-model:searchQuery="searchQuery"
      :i18n="i18n"
      :project-count="projectCount"
      :is-floating="isFloating"
      :progress="progressState"
      @open-settings="openSettings"
      @open-add-project="showAddDialog = true"
      @open-scan="handleOpenScan"
      @open-web="openRepoWebUrl"
      @open-consistency="showConsistencyDialog = true"
      @open-floating="openFloatingWindow"
    />

    <!-- ========== 统计视图 ========== -->
    <StatsPanel
      v-if="currentView === 'stats'"
      :i18n="i18n"
      :stats="statsView"
      :audit-rows="auditRows"
      :auditing="auditing"
      :refreshing="statsRefreshing"
      :refreshed-at="statsRefreshedAt"
      @view-project="onViewProject"
      @refresh="refreshStatsData"
    />

    <!-- ========== 操作日志视图 ========== -->
    <LogPanel
      v-if="currentView === 'log'"
      :i18n="i18n"
      :logs="opLogs"
      :loading="opLogsLoading"
      @clear="confirmClearOpLogs"
      @view-project="onViewProject"
    />

    <!-- ========== 提交分析视图（三视角 Tab：提交概览 / 规则检查 / 行数排行） ========== -->
    <CommitAnalysisPanel
      v-if="currentView === 'analysis'"
      :i18n="i18n"
      :projects="projects"
      :stats="analysisStats"
      :rule-check-stats="commitRuleStats"
      :analyzing="analysisAnalyzing"
      :analyzed="analysisAnalyzed"
      :analyzed-at="analysisAnalyzedAt"
      :line-analyzed-at="lineAnalyzedAt"
      :commit-count="analysisCommitCount"
      :view-settings="analysisViewSettings"
      :rule-check-project-id="effectiveRuleCheckProjectId"
      :project-ranking="projectLineRanking"
      :line-stats-summary="lineStatsSummary"
      :line-analyzing="lineAnalyzing"
      :line-analyzed="lineAnalyzed"
      :line-failed-count="lineFailedCount"
      :fetch-failures="fetchFailures"
      :selected-extensions="selectedExtensions"
      :line-detail-project-id="lineDetailProjectId"
      :line-detail-refreshing="lineDetailRefreshing"
      :get-project-file-lines="getProjectFileLines"
      :refresh-project="refreshLineStatsProject"
      @run-analysis="runAnalysis"
      @run-line-stats="runLineStatsAnalysis"
      @update-count="setCommitCount"
      @update-view-settings="updateViewSettings"
      @update-selected-extensions="updateSelectedExtensions"
      @update-project="setRuleCheckProject"
      @view-project="onViewProject"
      @open-line-detail="lineDetailProjectId = $event"
      @close-line-detail="lineDetailProjectId = ''"
    />

    <!-- ========== 代码统计报告视图 ========== -->
    <CodeReportPanel
      v-if="currentView === 'report'"
      :i18n="i18n"
      :report="reportData"
      :running="reportRunning"
      :refreshing="reportRefreshing"
      :generated="reportGenerated"
      :projects="projects"
      :project-id="reportProjectId"
      :range="reportRange"
      :current-project="reportCurrentProject"
      :get-file-patch="fetchFilePatch"
      :exporting="reportExporting"
      @run-report="runReport"
      @change-project="setProject"
      @change-range="setRange"
      @export-html="exportReportHtml"
    />

    <!-- ========== 仓库清理视图 ========== -->
    <RepoCleanPanel
      v-if="currentView === 'repoclean'"
      :i18n="i18n"
      :manager="props.manager"
      :projects="projects"
    />

    <!-- ========== 列表视图 ========== -->
    <ListView
      v-if="currentView === 'list'"
      v-model:view-mode="viewMode"
      v-model:active-category="activeCategory"
      v-model:show-archived="showArchived"
      v-model:git-ops-paused="gitOpsPaused"
      :i18n="i18n"
      :projects="projects"
      :grouped-projects="groupedProjects"
      :filtered-groups="filteredGroups"
      :empty-hint="listEmptyHint"
    />
    <!-- 列表视图结束 -->

    <Transition name="gp-dialog-fade">
      <AddProjectDialog
        v-if="showAddDialog"
        :i18n="i18n"
        :categories="categories"
        @close="showAddDialog = false"
        @add="handleAddFromDialog"
      />
    </Transition>
    <Transition name="gp-dialog-fade">
      <CategoryDialog
        v-if="showCatDialog"
        :i18n="i18n"
        :categories="categories"
        @close="showCatDialog = false"
        @add-category="handleAddCategory"
        @update-category="handleUpdateCategory"
        @delete-category="handleDeleteCategory"
      />
    </Transition>
    <Transition name="gp-dialog-fade">
      <SettingsDialog
        v-if="showSettings"
        :i18n="i18n"
        :manager="props.manager"
        :concurrency="gitConcurrency"
        :network-timeout="networkTimeout"
        :rule-config="ruleConfig"
        :push-branch-mode="pushBranchMode"
        :view-settings="analysisViewSettings"
        :year-options="settingsYearOptions"
        :probe-config="probeConfig"
        :probe-watched-count="probeWatchedCount"
        @close="showSettings = false"
        @save="setGitConcurrency"
        @save-network-timeout="setNetworkTimeout"
        @save-rule-config="updateCommitRuleConfig"
        @save-branch-mode="handleSaveBranchMode"
        @update-view-settings="updateViewSettings"
        @save-probe-config="saveProbeConfig"
        @probe-now="handleProbeNow"
        @open-category="openCategoryFromSettings"
      />
    </Transition>
    <!-- 通用确认弹窗（删除/丢弃/恢复/分类/拉取等需二次确认的操作） -->
    <ConfirmDialog
      :visible="genericConfirm.visible"
      :header="genericConfirm.title"
      :message="genericConfirm.message"
      :accept-label="genericConfirm.confirmText"
      :reject-label="i18n.cancel"
      @confirm="doGenericConfirm"
      @cancel="cancelGenericConfirm"
    />
    <Transition name="gp-dialog-fade">
      <IdeManagementDialog
        v-if="showIdeDialog"
        :i18n="i18n"
        :custom-ides="customIdes"
        @close="showIdeDialog = false"
        @add="addCustomIde"
        @saveEdit="saveEditIde"
        @delete="doRemoveCustomIde"
      />
    </Transition>
    <Transition name="gp-dialog-fade">
      <ScanImportDialog
        v-if="showScanDialog"
        v-model:scan-dir="scanDir"
        :i18n="i18n"
        :scanning="scanning"
        :error="scanError"
        :results="scanResults"
        :selection="scanSelection"
        @close="handleCloseScan"
        @start-scan="handleStartScan"
        @toggle-select-all="handleToggleSelectAll"
        @toggle-item="toggleScanItem"
        @import-selected="handleImportSelected"
      />
    </Transition>
    <Transition name="gp-dialog-fade">
      <EditProjectDialog
        v-if="editDialogProjectId"
        :project-id="editDialogProjectId"
        :manager="manager"
        :i18n="i18n"
        @close="editDialogProjectId = ''"
        @saved="handleEditSaved"
        @urls-updated="handleUrlsUpdated"
      />
    </Transition>
    <Transition name="gp-dialog-fade">
      <MarkdownPreviewDialog
        v-if="markdownPreviewProject"
        :project="markdownPreviewProject"
        :i18n="i18n"
        :initial-file="markdownPreviewInitialFile"
        @close="closeMarkdownPreview"
      />
    </Transition>
    <Transition name="gp-dialog-fade">
      <GitConfigDialog
        v-if="showGitConfig"
        :i18n="i18n"
        :manager="props.manager"
        :scope="gitConfigScope"
        :project-path="gitConfigProjectPath"
        :title="gitConfigTitle"
        @close="closeGitConfig"
      />
    </Transition>
    <!-- 远程与本地一致性分析弹窗（自包含：仅传 manager + i18n，内部自行取项目快照与分析） -->
    <Transition name="gp-dialog-fade">
      <ConsistencyAuditDialog
        v-if="showConsistencyDialog"
        :i18n="i18n"
        :manager="props.manager"
        @close="showConsistencyDialog = false"
        @view-project="handleViewProjectFromConsistency"
      />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import type {
  GitProject,
  GitPushManager,
  PanelView,
  PlatformKey,
  ProbeConfig,
  ProjectPathExtras,
} from "./types"
import type { Plugin } from "siyuan"
import {
  getFrontend,
  showMessage,
} from "siyuan"
import {
  computed,
  onMounted,
  onUnmounted,
  provide,
  ref,
  watch,
} from "vue"
import { getErrorMessage } from "@/utils/stringUtils"
import { buildYearOptions, findProject } from "./utils"
import AddProjectDialog from "./components/common/AddProjectDialog.vue"
import CategoryDialog from "./components/common/CategoryDialog.vue"
import ConfirmDialog from "@/components/ConfirmDialog.vue"
import ConsistencyAuditDialog from "./components/common/ConsistencyAuditDialog.vue"
import EditProjectDialog from "./components/common/EditProjectDialog.vue"
import IdeManagementDialog from "./components/common/IdeManagementDialog.vue"
import ListView from "./components/ListView/index.vue"
import MarkdownPreviewDialog from "./components/common/MarkdownPreviewDialog.vue"
import PanelHeader from "./components/common/PanelHeader.vue"
import ScanImportDialog from "./components/common/ScanImportDialog.vue"
import SettingsDialog from "./components/common/SettingsDialog.vue"
import StatsPanel from "./components/StatsView/index.vue"
import LogPanel from "./components/LogPanel/index.vue"
import CommitAnalysisPanel from "./components/CommitAnalysis/index.vue"
import CodeReportPanel from "./components/CodeReport/index.vue"
import RepoCleanPanel from "./components/RepoCleanPanel/index.vue"
import GitConfigDialog from "./components/common/GitConfigDialog.vue"
import { useGitPush } from "./composables/useGitPush"
import { useGitProbe } from "./composables/useGitProbe"
import { useBatchProgress } from "./composables/useBatchProgress"
import { usePushStatusView } from "./composables/usePushStatusView"
import { useIdeManagement } from "./composables/useIdeManagement"
import {
  useProjectFilters,
} from "./composables/useProjectFilters"
import { useScanImport } from "./composables/useScanImport"
import { useGitConfigDialog } from "./composables/useGitConfigDialog"
import { useGitHandlers } from "./composables/useGitHandlers"
import { useRefreshOps } from "./composables/useRefreshOps"
import { useRepoLinkAudit } from "./composables/useRepoLinkAudit"
import { useCommitAnalysis } from "./composables/useCommitAnalysis"
import { useCodeReport } from "./composables/useCodeReport"
import { useReportExport } from "./composables/useReportExport"
import { CARD_SERVICES_KEY, PLATFORM_META } from "./types"
import { clampProbeConfig, DEFAULT_PROBE_CONFIG } from "./types/probeConfig"
import {
  openLocalPath,
  openRepoWebUrl,
} from "./utils"

const props = defineProps<{
  i18n: Record<string, any>
  plugin: Plugin
  manager: GitPushManager
  /** 承载模式：dock = 侧边栏面板；tab = 独立页签/浮动窗口 */
  mode?: "dock" | "tab"
}>()

/** i18n 取值 + {n} 占位替换（i18n 是唯一文案数据源，不设兜底） */
function tf(key: string, ...args: (string | number)[]): string {
  let s: string = props.i18n[key]
  args.forEach((a, i) => { s = s.replace(`{${i}}`, String(a)) })
  return s
}

/** 当前是否运行在独立浮动窗口中（思源 getFrontend()：desktop=主窗口 / desktop-window=新窗口） */
const isFloating = computed(() => {
  try {
    return getFrontend() === "desktop-window"
  } catch {
    return false
  }
})

/** 打开独立浮动窗口：经 GitPushManager 调度（openTab + openWindow 官方 API） */
const openFloatingWindow = () => {
  void props.manager.openFloating()
}

const {
  projects,
  categories,
  groupedProjects,
  getPushStatus,
  isPushing,
  pushOutputs,
  isPulling,
  pullOutputs,
  pushStatuses,
  workingTrees,
  committing,
  loadProjects,
  loadWorkingTree,
  stageItem,
  stageAllItems,
  unstageItem,
  unstageAllItems,
  discardFile,
  doCommit,
  generateCommitMsg,
  deepGenerateCommitMsg,
  addProject,
  removeProject,
  pushToAll,
  forcePushToAll,
  pushSingle,
  pullSingle,
  cancelPush,
  clearRemoteOutput,
  addCategory: addCategoryFn,
  deleteCategory: deleteCategoryFn,
  updateCategory: updateCategoryFn,
  moveProject,
  switchBranch,
  startScan,
  importScanResults,
  scanning,
  scanResults,
  gitConcurrency,
  loadGitConcurrency,
  setGitConcurrency,
  networkTimeout,
  loadNetworkTimeout,
  setNetworkTimeout,
  stashLoading,
  doStashSave,
  doStashPop,
  doStashApply,
  doStashDrop,
  generateStashDesc,
  // 查询调度器（单飞/新鲜度/脏标记唯一权威）
  scheduler,
  ensureProjectStatus,
  refreshProjectStatus,
  // 卡片自持数据脏标记（下沉数据的父层写入通道）
  bumpCardRefresh,
  // Tag 管理（仅写操作，列表数据已下沉卡片）
  createTagOp,
  deleteTagOp,
  pushTagOp,
  // 冲突操作（仅写操作，冲突列表已下沉卡片）
  abortMergeOp,
  resolveConflictOp,
  // 提交信息模板
  commitTemplates,
  loadCommitTemplates,
  // 统计视图数据
  projectCount,
  needsPushProjects,
  needsPullProjects,
  uncommittedProjects,
  statsView,
  // 操作日志
  opLogs,
  ensureOpLogsLoaded,
  clearOpLogs,
  // 项目聚合管理
  starredProjects,
  updateProjectMeta,
  toggleStar,
} = useGitPush(props.manager, props.i18n)

/** 卡片加载提交日志后回传最近活动时间（原 useGitOps.loadCommitLog 的副作用） */
async function recordCommitActivity(id: string, isoTime: string) {
  await props.manager.recordLastActivity(id, isoTime).catch(() => {})
  const project = findProject(projects, id)
  if (project && project.lastActivity !== isoTime) {
    project.lastActivity = isoTime
    projects.value = [...projects.value]
  }
}

const showAddDialog = ref(false)
const showCatDialog = ref(false)
const showSettings = ref(false)

/** 打开设置汇总弹窗：先预载显示设置，防止未进分析视图时以默认值覆盖已保存设置 */
function openSettings() {
  showSettings.value = true
  void loadViewSettings()
  // 同步监听状态：该值仅用于弹窗内解释「文件监听是否真的生效」，按需刷新即可
  probeWatchedCount.value = gitProbe.getWatchedCount()
}

/** 设置弹窗内「管理分类」入口：关闭设置并打开分类弹窗（避免弹窗叠放） */
function openCategoryFromSettings() {
  showSettings.value = false
  showCatDialog.value = true
}

/** 远程与本地一致性分析弹窗 */
const showConsistencyDialog = ref(false)

/** 一致性弹窗内点击项目：关闭弹窗并跳转项目卡片 */
function handleViewProjectFromConsistency(projectId: string) {
  showConsistencyDialog.value = false
  onViewProject(projectId)
}
const showAddMenu = ref(false)
const showPlatformMenu = ref(false)
/** 拉取二次确认：复用通用确认弹窗，正文 {0} 填充平台名 */
function confirmPullSingle(id: string, key: PlatformKey) {
  const label = PLATFORM_META.find((pm) => pm.key === key)?.label ?? key
  showConfirm(
    props.i18n.pullConfirm,
    props.i18n.pullConfirmBody.replace("{0}", label),
    () => { pullSingle(id, key) },
    props.i18n.pullConfirm,
  )
}
/** 通用确认弹窗状态 */
interface ConfirmState {
  visible: boolean
  title: string
  message: string
  confirmText?: string
  onConfirm: () => void
}
const genericConfirm = ref<ConfirmState>({
  visible: false,
  title: "",
  message: "",
  onConfirm: () => {},
})

/** 打开通用确认弹窗 */
function showConfirm(title: string, message: string, onConfirm: () => void, confirmText?: string) {
  genericConfirm.value = { visible: true, title, message, onConfirm, confirmText }
}

/** 执行确认回调并关闭 */
function doGenericConfirm() {
  genericConfirm.value.onConfirm()
  genericConfirm.value.visible = false
}

/** 取消确认 */
function cancelGenericConfirm() {
  genericConfirm.value.visible = false
}

/** 清空操作日志二次确认 */
function confirmClearOpLogs() {
  showConfirm(
    props.i18n.clearLogsConfirm,
    props.i18n.clearLogsConfirmBody,
    () => { clearOpLogs() },
    props.i18n.clearLogs,
  )
}

// ── 批量加载旋转进度指示器（数据经 PanelHeader 头部最右侧展示；runBatch 编排已下沉 useBatchProgress，批内并发跟随 git 并发设置）──
const { state: progressState, runBatch: runBatchWithProgress } = useBatchProgress({
  getBatchSize: () => props.manager.getGitConcurrency(),
})

/**
 * 统一自动批量加载入口：仅对尚未具备目标数据的项目入队。
 * 跨触发器去重由调度器单飞承担（同 (项目, 域) 在飞时共享同一 Promise），
 * 配合 useBatchProgress 的 runChain 串行化，既不重复发 git 子进程，也不破坏进度计数。
 */
async function runProjectLoadBatch(
  candidates: GitProject[],
  loader: (id: string) => Promise<void>,
  /** 已具备数据的判据（缺省：pushStatus 与 workingTree 两域齐备即跳过） */
  isLoaded: (id: string) => boolean = (id) => scheduler.has(id, "pushStatus") && scheduler.has(id, "workingTree"),
) {
  const pending = candidates.filter((p) => !isLoaded(p.id))
  if (pending.length === 0) return
  await runBatchWithProgress(pending, tf("loadingLabel"), async (p) => {
    await loader(p.id)
  })
}

/** 当前视图: 'list' | 'stats' | 'log' */
const currentView = ref<PanelView>("list")
/** 日志视图首次读盘加载态（供 LogPanel 展示加载中占位，避免闪现空态） */
const opLogsLoading = ref(false)
/** 当前选中的分类 ID（空串 = 用户尚未选择，此时不加载任何项目；每次打开面板均从空串开始） */
const activeCategory = ref<string>("")

/**
 * 按分类 TAB 过滤后的分组。
 * 空串 = 未选择（渲染空态引导用户选择），**不是**「全部」——后者会在首屏一次性加载所有项目状态。
 */
const visibleGroups = computed(() => {
  if (!activeCategory.value) return []
  return groupedProjects.value.filter((g) => g.category.id === activeCategory.value)
})

const {
  searchQuery,
  viewMode,
  showArchived,
  gitOpsPaused,
  filteredGroups,
  loadGitOpsPaused,
  loadShowArchived,
} = useProjectFilters({
  gitOpsPausedStorage: props.manager.storage.gitOpsPaused,
  showArchivedStorage: props.manager.storage.showArchived,
  projects,
  needsPushProjects,
  needsPullProjects,
  uncommittedProjects,
  starredProjects,
  visibleGroups,
  allGroups: groupedProjects,
})

/**
 * 列表视图空态文案（null = 渲染卡片列表）。
 * 仅「全部」视图 + 无搜索词 + 未选择分类 时提示选择分类；智能视图（需推送/有变更/收藏/归档）
 * 与搜索态不依赖分类 TAB（走 smartViewProjects / allGroups），故不显示该提示，避免误导。
 */
const listEmptyHint = computed(() => {
  if (projects.value.length === 0) return null
  if (viewMode.value !== "all") return null
  if (searchQuery.value.trim()) return null
  if (activeCategory.value) return null
  return props.i18n.selectCategoryHint
})

// ── 仓库链接一致性校验（仅在进入统计视图时执行；见审查报告 §P0-2 的门控要求）──
const {
  auditRows,
  auditing,
  audited,
  runAudit,
} = useRepoLinkAudit(props.manager, projects, {
  enabled: () => currentView.value === "stats",
  isPaused: () => gitOpsPaused.value,
})

// ── 提交分析（批量读取各项目提交日志；结果持久化，首次进入复用缓存，无缓存时自动分析一次）──
const {
  analysisStats,
  commitRuleStats,
  analyzing: analysisAnalyzing,
  analyzed: analysisAnalyzed,
  analyzedAt: analysisAnalyzedAt,
  // 行数统计域（独立进度/时间戳/失败计数：不再与提交分析互相覆盖）
  lineAnalyzing,
  lineAnalyzed,
  lineAnalyzedAt,
  lineFailedCount,
  fetchFailures,
  commitCount: analysisCommitCount,
  setCommitCount,
  runAnalysis,
  runLineStatsAnalysis,
  ensureAnalysis,
  ensureLineStats,
  viewSettings: analysisViewSettings,
  loadViewSettings,
  updateViewSettings,
  effectiveRuleCheckProjectId,
  setRuleCheckProject,
  loadRuleCheckPrefs,
  ruleConfig,
  updateCommitRuleConfig,
  projectLineRanking,
  lineStatsSummary,
  selectedExtensions,
  updateSelectedExtensions,
  getProjectFileLines,
  refreshLineStatsProject,
  lineDetailRefreshing,
} = useCommitAnalysis(props.manager, projects)

/** 行数统计视图：项目详情弹窗目标项目 id（非空即打开弹窗，关闭时清空） */
const lineDetailProjectId = ref("")

// ── 代码统计报告（单项目 git numstat 统计：团队总览/贡献度/技术债务/热点；进入视图自动生成）──
const {
  reportData,
  running: reportRunning,
  refreshing: reportRefreshing,
  generated: reportGenerated,
  projectId: reportProjectId,
  range: reportRange,
  currentProject: reportCurrentProject,
  runReport,
  setRange,
  setProject,
  ensureReport,
  fetchFilePatch,
  markStale: markReportStale,
} = useCodeReport(props.manager, projects, props.i18n)

// 仓库写操作（提交/stash/tag/冲突/历史重写）后使报告缓存失效：
// 卡片脏标记是这些写操作的统一信号通道，报告数据与之同源（都来自 git 提交历史），
// 故复用同一信号，避免用户提交后切回报告视图仍看到旧的提交数/行数。
watch(scheduler.epoch, () => { markReportStale() })

// ── 报告导出（单文件 HTML，含内联 SVG 图表）──
const { exporting: reportExporting, exportHtml: exportReportHtml } = useReportExport({
  i18n: props.i18n,
  report: reportData,
  currentProject: reportCurrentProject,
  generated: reportGenerated,
  running: reportRunning,
})

const {
  detectedIdes,
  customIdes,
  showIdeDialog,
  saveEditIde,
  loadCustomIdes,
  addCustomIde,
  doRemoveCustomIde,
  removeCustomIdeByName,
  handleOpenCustomIde,
  scanIdes,
  handleOpenIde,
} = useIdeManagement({
  plugin: props.plugin,
  openFolder: (path: string) => { void openLocalPath(path) },
})

// ── 扫描导入 ──
const {
  showScanDialog,
  scanError,
  scanSelection,
  scanDir,
  handleOpenScan,
  handleCloseScan,
  handleStartScan,
  handleToggleSelectAll,
  toggleScanItem,
  handleImportSelected,
} = useScanImport({
  scanResults,
  activeCategory,
  startScan,
  importScanResults,
  loadProjects,
  getScanDir: () => props.manager.getScanDir(),
  setScanDir: (dir: string) => props.manager.setScanDir(dir),
  tf,
})

// ── Git 配置弹窗（项目级入口；全局配置走设置弹窗 GitConfigSection 分区）──
const {
  showGitConfig,
  gitConfigScope,
  gitConfigProjectPath,
  gitConfigTitle,
  handleOpenProjectGitConfig,
  closeGitConfig,
} = useGitConfigDialog({ manager: props.manager, projects })

// ── Git 操作 handler 集群 ──
const {
  commitOutputs,
  generatingMsgs,
  gitOpLoading,
  genStashDescLoading,
  generatedStashMsg,
  tagPushLoading,
  handleGitOp,
  handleDiscard,
  handleGenStashDesc,
  handleStashConfirmMsg,
  handleStashPop,
  handleStashApply,
  handleStashDrop,
  handleCreateTag,
  handleDeleteTag,
  handlePushTag,
  handleAbortMerge,
  handleResolveConflict,
  handleCommit,
  handleGenerateMsg,
  handleDeepGenerateMsg,
} = useGitHandlers({
  projects, showConfirm, safeGitOp, tf,
  discardFile, doCommit, generateCommitMsg, deepGenerateCommitMsg,
  doStashSave, doStashPop, doStashApply, doStashDrop, generateStashDesc,
  createTagOp, deleteTagOp, pushTagOp,
  abortMergeOp, resolveConflictOp,
  bumpCardRefresh, loadWorkingTree,
})

// ── 刷新操作集群 ──
const {
  refreshing,
  fetching,
  remoteStatusLoading,
  refreshingWorkingTree,
  handleRefresh,
  handleRefreshWorkingTree,
  handleRefreshRemoteStatus,
  handleFetchAll,
} = useRefreshOps({
  projects, runBatchWithProgress, tf,
  scheduler,
  bumpCardRefresh,
})

// ── 实时探测（三层：.git 文件监听 → 工作区轮询 → 网络慢轮询）──
// 只负责决定「何时」调用既有 scheduler 入口，去重/单飞/新鲜度仍归调度器，不新增派发路径。
const probeConfig = ref<ProbeConfig>(DEFAULT_PROBE_CONFIG)

/** 读取并归一化探测配置（逐字段钳位兜底） */
async function loadProbeConfig() {
  try {
    probeConfig.value = await props.manager.getProbeConfig()
  } catch {
    // 存储读取失败时回落到默认配置：探测是增强能力，
    // 不能因一次读取失败中断 onMounted 后续流程（否则 start() 永不执行，探测整体静默失效）
    probeConfig.value = DEFAULT_PROBE_CONFIG
  }
}

/**
 * 保存探测配置并让运行中的探测立即按新配置重排（无需重启面板）。
 * 用 try/finally 保证即使持久化失败也把新配置应用到运行中的探测，
 * 避免出现「内存已改、实际仍在按旧配置跑」的不一致。
 */
async function saveProbeConfig(next: ProbeConfig) {
  probeConfig.value = clampProbeConfig(next)
  try {
    await props.manager.setProbeConfig(probeConfig.value)
  } catch {
    // 落盘失败不回滚内存值：本次会话仍按用户选择生效，下次启动回落到已持久化的旧值
  } finally {
    gitProbe.applyConfig()
  }
}

/**
 * 已建立 .git 文件监听的项目数。
 * 设置弹窗打开时刷新一次即可——该值仅用于解释「监听是否真的生效」，
 * 不需要实时跟随（每秒轮询一次反而增加无谓开销）。
 */
const probeWatchedCount = ref(0)

/** 面板根元素（可见性门控用：Dock 隐藏时祖先 display:none，不能只看 document.visibilityState） */
const panelRootEl = ref<HTMLElement | null>(null)

/**
 * 面板是否真实可见。
 *
 * document.visibilityState 对「Dock 被隐藏 / 被其他 Dock 顶掉 / 页签切走」全部返回 visible，
 * 故必须叠加元素级判据，否则关闭面板后探测仍全天候轮询（审查报告 §P0-3）。
 *
 * ⚠️ 默认 true 而非「检测结果」：首帧 ref 尚未绑定（null）时不能据此判定为不可见，
 * 否则一旦 IntersectionObserver 不可用就永久停机（探测再也起不来）。初始值只是乐观缺省，
 * 真正的判定由 syncPanelVisible() 在挂载后立即执行并持续校正。
 */
const panelVisible = ref(true)

function detectPanelVisible(): boolean {
  const el = panelRootEl.value
  if (!el) return true // 首帧/已卸载：不据此停机，避免永久关停探测
  if (!el.isConnected) return false
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return false
  const check = (el as HTMLElement & { checkVisibility?: (opts?: Record<string, unknown>) => boolean }).checkVisibility
  if (typeof check === "function") {
    try {
      return check.call(el, { checkOpacity: false, checkVisibilityCSS: true })
    } catch {
      // 老内核不支持参数对象时退回无参调用
      try { return check.call(el) } catch { /* 落到下方兜底 */ }
    }
  }
  return el.getClientRects().length > 0
}

/**
 * 统一可见性校正入口（唯一真源）：
 * 元素级检测 → 写 panelVisible → 通知探测层。观察器、visibilitychange、挂载时都走这里，
 * 避免两条可见性信号（document / 元素）互相漂移。
 */
function syncPanelVisible(): void {
  const visible = detectPanelVisible()
  if (panelVisible.value === visible) {
    // 状态未变也要喂给 probe：panelVisible 的初值可能与 probe 内部 lastVisible 不同步
    gitProbe.setVisible(visible)
    return
  }
  panelVisible.value = visible
  gitProbe.setVisible(visible)
}

/** 视图是否在前台：文档可见 + 面板元素真实可见（独立窗口页签模式同样适用） */
function isProbeActive(): boolean {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return false
  return panelVisible.value
}

/**
 * 根元素可见性观察：Dock/页签显隐（class 切换 display:none）会触发 intersection 变化。
 *
 * ⚠️ 必须等 ref 真正绑定后再 observe：onMounted 内此时已绑定，故直接 observe；
 * 若元素缺失/环境不支持 IntersectionObserver，则退化为仅依赖 window focus/blur +
 * document.visibilitychange 的校正（不会永久停机）。
 */
let panelVisibilityObserver: IntersectionObserver | null = null
function setupPanelVisibilityObserver(): void {
  const el = panelRootEl.value
  if (typeof IntersectionObserver === "undefined" || !el) return
  panelVisibilityObserver = new IntersectionObserver((entries) => {
    // 取最后一条（同一次回调里同一元素可能有多次状态变化）
    const last = entries[entries.length - 1]
    if (!last) return
    panelVisible.value = last.isIntersecting && detectPanelVisible()
    gitProbe.setVisible(panelVisible.value)
  }, { threshold: 0 })
  panelVisibilityObserver.observe(el)
}

/** 文档可见性变化（最小化/切窗口）：与元素级检测合并后统一喂给探测层 */
function handleDocumentVisibilityChange(): void {
  if (panelRootEl.value) syncPanelVisible()
}


/**
 * 已在前台展示过的项目集合（探测层据此决定首轮是否发 git）。
 *
 * 判定口径与列表/统计视图的「用户真的能看到」一致：
 *   - 列表视图：当前分类下的项目（或智能视图命中的项目）；
 *   - 统计视图 / 分析 / 报告 / 日志：这些视图会全量读取状态，视为全部展示；
 * 未展示的项目只建预筛基线（stat + 读 HEAD，0 进程），不触发 git 查询，
 * 避免「进入页面即对全部项目跑 3N 次 git」（审查报告 §P0-2）。
 */
const displayedProjectIds = ref<Set<string>>(new Set())

function markProjectsDisplayed(ids: Iterable<string>): void {
  let changed = false
  for (const id of ids) {
    if (!displayedProjectIds.value.has(id)) {
      displayedProjectIds.value.add(id)
      changed = true
    }
  }
  // Set 就地修改不会触发依赖收集：需要换引用或显式版本号；probe 只在轮询时读取，无需响应式更新
  if (changed) displayedProjectIds.value = new Set(displayedProjectIds.value)
}

const gitProbe = useGitProbe({
  manager: props.manager,
  projects,
  scheduler,
  getConfig: () => probeConfig.value,
  isPaused: () => gitOpsPaused.value,
  isActive: isProbeActive,
  isProjectDisplayed: (id) => displayedProjectIds.value.has(id),
})
/** 手动「立即检测」：清空预筛基准强制真查一轮 */
async function handleProbeNow() {
  probeWatchedCount.value = gitProbe.getWatchedCount()
  await gitProbe.probeNow()
}
/** 项目编辑弹窗状态 */
const editDialogProjectId = ref("")
/** Markdown 文档预览弹窗状态 */
const markdownPreviewProject = ref<GitProject | null>(null)
const markdownPreviewInitialFile = ref<string | undefined>(undefined)

/** 打开 Markdown 文档预览弹窗 */
function openMarkdownPreview(project: GitProject, fileName: string) {
  markdownPreviewProject.value = project
  markdownPreviewInitialFile.value = fileName
}

/** 关闭 Markdown 文档预览弹窗 */
function closeMarkdownPreview() {
  markdownPreviewProject.value = null
  markdownPreviewInitialFile.value = undefined
}

onMounted(async () => {
  document.addEventListener("click", closeIdeMenuOnOutside)
  document.addEventListener("visibilitychange", handleDocumentVisibilityChange)
  await loadProjects()
  loadCommitTemplates()
  loadCustomIdes()
  scanIdes() // 扫描已安装的 IDE
  await loadGitOpsPaused() // 从持久化存储恢复暂停状态
  await loadShowArchived() // 从持久化存储恢复归档显示状态
  loadGitConcurrency()
  loadNetworkTimeout()
  // 预载提交规则检查偏好（含描述最短字数阈值），保证设置弹窗打开即显示已保存值
  void loadRuleCheckPrefs()
  // 实时探测配置：必须在 start() 之前加载，否则会按默认值建立监听与定时器
  await loadProbeConfig()
  // 可见性门控：先做一次元素级校正并挂观察器，再启动探测（探测启动时 isActive() 已是真实状态）
  setupPanelVisibilityObserver()
  syncPanelVisible()
  gitProbe.start()
  // 不自动选择分类、不预加载任何项目：等用户点选分类 TAB 后由 watch(activeCategory) 按需加载该分类。
  // 故此处无需首屏批量加载（原 200ms initTimer 已随之移除）。
})

onUnmounted(() => {
  document.removeEventListener("click", closeIdeMenuOnOutside)
  document.removeEventListener("visibilitychange", handleDocumentVisibilityChange)
  panelVisibilityObserver?.disconnect()
  panelVisibilityObserver = null
  // 探测持有 fs.watch 句柄与定时器，必须随组件卸载释放（否则多窗口/反复开关面板会累积泄漏）
  gitProbe.destroy()
})

/**
 * 项目集合变化时同步探测。
 *
 * ⚠️ 用 `id:path` 签名而非 `projects.length`：只比长度会漏掉「删除一个又新增一个」
 *    （长度不变）与「项目改了路径」（长度不变）这两类集合变更，探测会继续监听旧 gitdir
 *    直到 5 分钟后的周期性重建。签名同时含 path，故改路径也能立即重解析。
 */
const projectProbeSignature = computed(() =>
  projects.value.map((p) => `${p.id}:${p.path}`).join("|"),
)
watch(projectProbeSignature, () => gitProbe.syncProjects())

/** 暂停期间探测不执行（isPaused 已由 getConfig/isPaused 注入），恢复时立即补一轮并重排定时器 */
watch(gitOpsPaused, (paused) => {
  if (!paused) void gitProbe.probeNow()
})

/** 点击外部关闭顶栏菜单（添加/平台过滤；卡片内菜单由 ProjectCard 自行管理） */
function closeIdeMenuOnOutside(e: MouseEvent) {
  const target = e.target as HTMLElement | null
  if (target && !target.closest(".gp-add-wrap")) {
    showAddMenu.value = false
  }
  if (target && !target.closest(".gp-platform-wrap")) {
    showPlatformMenu.value = false
  }
}

/**
 * 补齐给定项目集的状态最小数据集（pushStatus + workingTree），列表视图与统计/智能视图共用。
 * commitLog/branches/stash 不在这两类视图中展示，无需加载。
 * 分支名由调度器解析一次并缓存分发给两个查询；在途与已加载均由调度器去重。
 *
 * @param fastWhenClean 兼容保留（当前 no-op）。原「干净工作区快速路径」已移除：
 *   实测探测 + 全量 ≈ 2× 单次全量（瓶颈是每次 git 调用的进程启动费 ~310ms，而非文件扫描量），
 *   故全场景统一走单次 `git status --porcelain`。详见 WorktreeOps.getWorkingTreeStatus。
 */
async function ensureStatusFor(list: GitProject[], fastWhenClean = false) {
  if (gitOpsPaused.value) return
  // 进入加载即视为「已展示」：探测层随后按增量判定，不再做无谓的全量首查
  markProjectsDisplayed(list.map((p) => p.id))
  await runProjectLoadBatch(list, (id) => ensureProjectStatus(id, fastWhenClean))
}

/**
 * 加载当前分类列表视图所需的最小状态数据（分类切换 / 切回列表 / 首次进入共用）。
 * 未选择分类时不加载任何项目——首屏零 git 调用，等用户点选分类后再按需加载该分类。
 */
async function loadCurrentCategoryList() {
  const catId = activeCategory.value
  if (!catId) return
  const list = projects.value.filter((p) => p.categoryId === catId)
  await ensureStatusFor(list)
}

/** 切换分类时懒加载该分类下项目的数据（仅列表视图需要；非列表视图由统计视图统一加载，避免看不见的预加载） */
watch(activeCategory, async (catId) => {
  if (!catId || gitOpsPaused.value) return
  if (currentView.value !== "list") return
  await loadCurrentCategoryList()
})

/** 补齐所有项目的统计最小数据集（统计视图与智能视图共用，未缓存的项目才入队）。
 * 开启干净工作区快速路径：批量场景下面向的大多是「无未提交变更」的项目，收益显著且失败可降级。 */
async function ensureStatsDataLoaded() {
  await ensureStatusFor(projects.value, true)
}
/** 统计视图快照刷新中（工具条刷新按钮转圈禁用） */
const statsRefreshing = ref(false)

/** 统计视图上次快照刷新完成时间（ISO，空串 = 本次会话尚未手动刷新过；工具条状态文案数据源） */
const statsRefreshedAt = ref("")

/**
 * 统计视图"刷新"：强制重查全部项目的状态最小数据集（pushStatus + workingTree）。
 * 与 ensureStatsDataLoaded 的区别是不走缓存短路——调度器 loadStatus 的 refresh 模式会强制重查，
 * 批内并发仍受 git 并发设置约束，进度经 runBatchWithProgress 复用头部旋转指示器。
 */
async function refreshStatsData() {
  if (statsRefreshing.value || projects.value.length === 0) return
  statsRefreshing.value = true
  try {
    markProjectsDisplayed(projects.value.map((p) => p.id))
    await runBatchWithProgress(projects.value, tf("refreshingLabel"), async (p) => {
      // 显式刷新同样开快速路径：批量重查全部项目，干净工作区的比例通常很高
      await scheduler.loadStatus(p.id, { mode: "refresh", fastWhenClean: true })
    })
    statsRefreshedAt.value = new Date().toISOString()
  } finally {
    statsRefreshing.value = false
  }
}

/** 切换视图时按目标视图补齐数据：列表→当前分类状态；统计→全量统计；日志→同步置 loading（pre-flush，避免 LogPanel 首渲闪空态）；分析→复用缓存或首次自动分析；行数统计→复用缓存（无缓存需手动分析）；报告→自动生成一次 */
watch(currentView, async (view) => {
  if (view === "list") await loadCurrentCategoryList()
  if (view === "stats") {
    // 统计视图的平台矩阵需要一致性校验数据：进入时按需跑一次（约 6 路并发 git remote -v）。
    // 只在「本次会话尚未成功校验」时跑，避免每次 stats/list 来回切换都重发 N 个进程
    // （项目变更由 composable 内部的签名 watch 负责补跑）。
    if (!audited.value) void runAudit().catch((e: unknown) => {
      console.warn("[gitPush] 仓库链接一致性校验失败", e)
    })
    await ensureStatsDataLoaded()
  }
  if (view === "log") {
    opLogsLoading.value = true
    try {
      await ensureOpLogsLoaded()
    } finally {
      opLogsLoading.value = false
    }
  }
  if (view === "analysis" && !gitOpsPaused.value) await ensureAnalysis()
  // 行数排行是「提交分析」视图的内部 Tab，其缓存加载是纯本地存储读取、不触发 git，
  // 故与 ensureAnalysis 一并无条件执行（暂停 git 操作时仍须恢复过滤选择与上次行数数据，否则重启后勾选丢失）
  if (view === "analysis") await ensureLineStats()
  if (view === "report" && !gitOpsPaused.value) await ensureReport()
})

/** 切换到"需推送/有变更"智能视图时，补齐命中判定所需的全量状态数据 */
watch(viewMode, async (mode) => {
  if (mode !== "needsPush" && mode !== "uncommitted") return
  await ensureStatsDataLoaded()
})

/** 解除暂停时按当前上下文补载数据（暂停期间跳过的加载在恢复后立即补齐） */
watch(gitOpsPaused, async (paused) => {
  if (paused) return
  // 提交分析视图（含规则检查 / 行数排行两个内部 Tab）：暂停期间跳过的缓存加载/首次分析在恢复后补齐
  if (currentView.value === "analysis") {
    await ensureAnalysis()
    await ensureLineStats()
    return
  }
  // 代码统计报告视图：暂停期间跳过的首次生成在恢复后补齐
  if (currentView.value === "report") {
    await ensureReport()
    return
  }
  // 统计视图 / 智能视图需要全量状态数据
  if (currentView.value === "stats" || viewMode.value === "needsPush" || viewMode.value === "uncommitted") {
    // 暂停期间进入统计视图时 audit 被跳过（audited 仍为 false），恢复后必须补跑，
    // 否则平台矩阵会一直显示「未校验」直到用户离开再进统计视图
    if (currentView.value === "stats" && !audited.value) {
      void runAudit().catch((e: unknown) => {
        console.warn("[gitPush] 仓库链接一致性校验失败", e)
      })
    }
    await ensureStatsDataLoaded()
    return
  }
  // 列表视图只补当前分类下未缓存的项目（与首屏最小集一致）
  await loadCurrentCategoryList()
})

async function handleAddFromDialog(data: ProjectPathExtras & { name: string, path: string, catId: string }) {
  try {
    await addProject(data.name, data.path, data.catId, undefined, {
      localPaths: data.localPaths,
      pathDevices: data.pathDevices,
    })
    showAddDialog.value = false
  } catch (e: unknown) {
    showMessage(getErrorMessage(e) || tf("addFailed"), 5000, "error")
  }
}

/** 从统计视图跳转到指定项目 */
function onViewProject(projectId: string) {
  const project = findProject(projects, projectId)
  if (!project) return
  // 切换到列表视图
  currentView.value = "list"
  // 切换到项目所属分类
  if (project.categoryId) {
    activeCategory.value = project.categoryId
  }
  // 设置搜索词为项目名称，方便快速定位
  searchQuery.value = project.name
}

/** 强制推送二次确认：--force-with-lease 覆盖远程历史，需明确同意 */
function handleForcePushToAll(id: string) {
  showConfirm(
    tf("forcePushConfirm"),
    tf("forcePushConfirmBody"),
    () => { void forcePushToAll(id) },
    tf("forcePush"),
  )
}

function handleRemove(project: GitProject) {
  showConfirm(tf("deleteProjectTitle"), tf("deleteProjectConfirm", project.name), () => {
    removeProject(project.id)
  })
}

async function handleSwitchBranch(id: string, branch: string) {
  await safeGitOp(tf("switchBranchFailed"), () => switchBranch(id, branch))
}

// ---- 项目聚合管理操作 ----

/** 打开项目编辑弹窗 */
function openEditDialog(project: GitProject) {
  editDialogProjectId.value = project.id
}

/** 编辑弹窗保存后同步状态（路径/远程可能已变，清空该项目调度缓存防 ensure 用旧状态短路） */
async function handleEditSaved() {
  const id = editDialogProjectId.value
  editDialogProjectId.value = ""
  if (id) scheduler.clearProject(id)
  await loadProjects()
  if (id) void ensureProjectStatus(id)
}

/** 仓库链接更新：仅刷新列表，不关闭弹窗 */
async function handleUrlsUpdated() {
  await loadProjects()
}

/** 统一的异步操作错误处理包装器 */
async function safeGitOp(label: string, fn: () => Promise<void>) {
  try {
    await fn()
  } catch (e: unknown) {
    showMessage(`${label}: ${getErrorMessage(e)}`, 5000, "error")
  }
}

// ---- 分类管理 ----

async function handleAddCategory(name: string, color: string) {
  if (!name) return
  await addCategoryFn(name, color)
}

/** 分类行内编辑提交：改名/改色后由 useProjectCrud 就地更新 categories，TAB 与卡片下拉同步刷新 */
async function handleUpdateCategory(id: string, name: string, color: string) {
  if (!id || !name) return
  await updateCategoryFn(id, name, color)
}

async function handleDeleteCategory(id: string) {
  const cat = categories.value.find((c) => c.id === id)
  if (!cat) return
  showConfirm(tf("deleteCategoryTitle"), tf("deleteCategoryConfirm", cat.name), () => {
    doDeleteCategory(id)
  })
}

async function doDeleteCategory(id: string) {
  // 删除的正是当前选中分类时回退为「未选择」（不自动跳第一个）：与进入面板时的语义一致，
  // 由用户自行指定下一个分类
  if (activeCategory.value === id) {
    activeCategory.value = ""
  }
  await deleteCategoryFn(id)
}

/** 推送分支模式 */
const pushBranchMode = ref<"all" | "head">(props.manager.getPushBranchMode())

async function handleSaveBranchMode(mode: "all" | "head") {
  pushBranchMode.value = mode
  await props.manager.setPushBranchMode(mode)
}

/** 设置汇总弹窗的显示设置年份选项（数据年份 ∪ 今年 ∪ 已保存年份，与分析视图共用逻辑） */
const settingsYearOptions = computed(() =>
  buildYearOptions(analysisStats.value.entries, analysisViewSettings.value.range),
)

// 推送状态派生视图（徽章文案/样式类/推送判定，供 ProjectCard 函数 props）
const { statusLabel, statusBadgeClass, needsPushFor, hasBehind } = usePushStatusView(pushStatuses)

// ── 卡片服务注入（五分组契约，消除中间人 props/emits：共享数据 / 响应式 Record / 派生函数 / 操作集群）──
provide(CARD_SERVICES_KEY, {
  manager: props.manager,
  updateProjectMeta,
  // 项目查询调度器（单飞/新鲜度/脏标记唯一权威，卡片经此重载自持数据）
  scheduler,
  recordCommitActivity,
  shared: {
    i18n: props.i18n,
    categories,
    detectedIdes,
    customIdes,
    commitTemplates,
    searchQuery,
  },
  records: {
    pushStatuses,
    workingTrees,
    committing,
    stashLoading,
    pushOutputs,
    pullOutputs,
    commitOutputs,
    generatingMsgs,
    gitOpLoading,
    genStashDescLoading,
    generatedStashMsg,
    tagPushLoading,
    fetching,
    remoteStatusLoading,
    refreshingWorkingTree,
    refreshing,
  },
  derived: {
    getPushStatus,
    isPulling,
    isPushing,
    statusLabel,
    statusBadgeClass,
    needsPushFor,
    hasBehind,
  },
  ops: {
    toggleStar,
    moveProject,
    switchBranch: handleSwitchBranch,
    handleRemove,
    openEditDialog,
    openMarkdownPreview,
    openProjectGitConfig: handleOpenProjectGitConfig,
    handleOpenIde,
    handleOpenCustomIde,
    showIdeDialog: (show = true) => { showIdeDialog.value = show },
    removeCustomIdeByName,
    handleRefresh,
    handleRefreshWorkingTree,
    handleRefreshRemoteStatus,
    ensureProjectStatus,
    refreshProjectStatus,
    handleGitOp,
    stageItem,
    unstageItem,
    stageAllItems,
    unstageAllItems,
    handleCommit,
    handleGenerateMsg,
    handleDeepGenerateMsg,
    clearOutput: (id: string) => { commitOutputs.value[id] = "" },
    handleDiscard,
    handleStashConfirmMsg,
    handleGenStashDesc,
    handleStashPop,
    handleStashApply,
    handleStashDrop,
    handleCreateTag,
    handlePushTag,
    handleDeleteTag,
    handleResolveConflict,
    handleAbortMerge,
    confirmPullSingle,
    pushSingle,
    pushToAll,
    handleForcePushToAll,
    cancelPush,
    clearRemoteOutput,
    handleFetchAll,
    openRepoWebUrl,
    openLocalPath,
  },
})
</script>

<style lang="scss">
@use "@/index.scss" as *;
@use "./styles/index.scss";
</style>
