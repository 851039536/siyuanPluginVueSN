<!-- gitPush Git 项目管理主面板 -->
<template>
  <div class="git-push-panel">
    <!-- 头部 -->
    <PanelHeader
      v-model:currentView="currentView"
      v-model:showPlatformMenu="showPlatformMenu"
      v-model:showAddMenu="showAddMenu"
      v-model:showRefreshMenu="showRefreshMenu"
      v-model:searchQuery="searchQuery"
      :i18n="i18n"
      :project-count="projectCount"
      :refreshing-all="refreshingAll"
      :refreshing-all-local="refreshingAllLocal"
      :refreshing-all-remote="refreshingAllRemote"
      @open-category="showCatDialog = true"
      @open-settings="showSettings = true"
      @refresh-all="handleRefreshAll"
      @refresh-all-local="handleRefreshAllLocal"
      @refresh-all-remote="handleRefreshAllRemote"
      @open-add-project="showAddDialog = true"
      @open-scan="handleOpenScan"
      @open-web="openRepoWebUrl"
      @open-git-config="handleOpenGitConfig"
    />

    <BatchProgressBar
      :state="progressState"
      :log-entries="progressLogEntries"
      :i18n="i18n"
      @close="progressHide"
    />

    <!-- ========== 统计视图 ========== -->
    <StatsPanel
      v-if="currentView === 'stats'"
      :i18n="i18n"
      :stats="statsView"
      @view-project="onViewProject"
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

    <!-- ========== 列表视图 ========== -->
    <template v-if="currentView === 'list'">
      <!-- 筛选工具栏 + 分类 TAB -->
      <ListViewToolbar
        v-model:view-mode="viewMode"
        v-model:active-category="activeCategory"
        v-model:show-archived="showArchived"
        v-model:git-ops-paused="gitOpsPaused"
        :i18n="i18n"
        :projects="projects"
        :grouped-projects="groupedProjects"
      />

      <!-- 项目列表 -->
      <div
        v-if="loading"
        class="gp-loading"
      >
        <Loader />
        <span class="gp-loading-text">{{ i18n.loading }}</span>
      </div>

      <div
        v-else-if="projects.length === 0"
        class="gp-empty"
      >
        <div class="gp-empty-icon">
          <Icon
            icon="mdi:source-repository"
            width="48"
            height="48"
          />
        </div>
        <div class="gp-empty-text">
          {{ i18n.noProjects }}
        </div>
      </div>

      <div
        v-else
        class="gp-list"
      >
        <template
          v-for="group in filteredGroups"
          :key="group.category.id"
        >
          <ProjectCard
            v-for="project in group.projects"
            :key="project.id"
            :project="project"
            :i18n="i18n"
            :categories="categories"
            :platform-meta="PLATFORM_META"
            :remotes="REMOTES"
            :detected-ides="detectedIdes"
            :custom-ides="customIdes"
            :search-query="searchQuery"
            :refreshing="refreshing"
            :fetching="fetching[project.id]"
            :push-status="pushStatuses[project.id]"
            :working-tree="workingTrees[project.id]"
            :stash-loading="stashLoading[project.id]"
            :commit-output="commitOutputs[project.id]"
            :pull-outputs="pullOutputs[project.id]"
            :push-outputs="pushOutputs[project.id]"
            :committing="committing[project.id]"
            :generating-msg="generatingMsgs[project.id]"
            :git-op-loading="gitOpLoading[project.id]"
            :remote-status-loading="remoteStatusLoading[project.id]"
            :tag-push-loading="tagPushLoading[project.id]"
            :gen-stash-desc-loading="genStashDescLoading[project.id]"
            :generated-stash-msg="generatedStashMsg"
            :commit-templates="commitTemplates"
            :status-badge-class="statusBadgeClass"
            :status-label="statusLabel"
            :has-behind="hasBehind"
            :is-pulling="isPulling"
            :is-pushing="isPushing"
            :needs-push-for="needsPushFor"
            :get-push-status="getPushStatus"
            @toggle-star="toggleStar"
            @switch-branch="handleSwitchBranch"
            @remove="handleRemove"
            @open-edit-dialog="openEditDialog"
            @open-markdown-preview="openMarkdownPreview"
            @open-project-git-config="handleOpenProjectGitConfig"
            @move-project="moveProject"
            @open-ide="handleOpenIde"
            @open-custom-ide="handleOpenCustomIde"
            @show-ide-dialog="showIdeDialog = true"
            @remove-custom-ide="removeCustomIdeByName"
            @refresh="handleRefresh"
            @refresh-working-tree="handleRefreshWorkingTree"
            @refresh-remote-status="handleRefreshRemoteStatus"
            @stage-file="(id: string, file: string) => handleGitOp(tf('stageFailed'), () => stageItem(id, file), id)"
            @unstage-file="(id: string, file: string) => handleGitOp(tf('unstageFailed'), () => unstageItem(id, file), id)"
            @stage-all="(id: string) => handleGitOp(tf('stageFailed'), () => stageAllItems(id), id)"
            @unstage-all="(id: string) => handleGitOp(tf('unstageFailed'), () => unstageAllItems(id), id)"
            @commit="(id: string, msg: string) => handleCommit(id, msg)"
            @generate-msg="handleGenerateMsg"
            @clear-output="(id: string) => commitOutputs[id] = ''"
            @discard-file="handleDiscard"
            @stash-confirm-msg="handleStashConfirmMsg"
            @gen-stash-desc="handleGenStashDesc"
            @stash-pop="handleStashPop"
            @stash-apply="handleStashApply"
            @stash-drop="handleStashDrop"
            @create-tag="handleCreateTag"
            @push-tag="handlePushTag"
            @delete-tag="handleDeleteTag"
            @resolve-conflict="handleResolveConflict"
            @abort-merge="handleAbortMerge"
            @confirm-pull="confirmPullSingle"
            @push-single="pushSingle"
            @push-to-all="pushToAll"
            @cancel-push="cancelPush"
            @fetch-all="handleFetchAll"
          />
        </template>
      </div>
    </template>
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
        @delete-category="handleDeleteCategory"
      />
    </Transition>
    <Transition name="gp-dialog-fade">
      <SettingsDialog
        v-if="showSettings"
        :i18n="i18n"
        :concurrency="gitConcurrency"
        :push-branch-mode="pushBranchMode"
        @close="showSettings = false"
        @save="setGitConcurrency"
        @save-branch-mode="handleSaveBranchMode"
      />
    </Transition>
    <!-- 通用确认弹窗（删除/丢弃/恢复/分类/拉取等需二次确认的操作） -->
    <ConfirmDialog
      :visible="genericConfirm.visible"
      :title="genericConfirm.title"
      :message="genericConfirm.message"
      :confirm-text="genericConfirm.confirmText"
      :cancel-text="i18n.cancel"
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
        :config-text="gitConfigText"
        :loading="gitConfigLoading"
        :error="gitConfigError"
        :i18n="i18n"
        :file-path="gitConfigFilePath"
        :title="gitConfigTitle"
        @close="closeGitConfig"
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
  ProjectPathExtras,
} from "./types"
import type { Plugin } from "siyuan"
import { Icon } from "@iconify/vue"
import { showMessage } from "siyuan"
import {
  computed,
  onMounted,
  onUnmounted,
  provide,
  ref,
  watch,
} from "vue"
import { getErrorMessage } from "@/utils/stringUtils"
import AddProjectDialog from "./components/AddProjectDialog.vue"
import CategoryDialog from "./components/CategoryDialog.vue"
import ConfirmDialog from "./components/ConfirmDialog.vue"
import EditProjectDialog from "./components/EditProjectDialog.vue"
import IdeManagementDialog from "./components/IdeManagementDialog.vue"
import ListViewToolbar from "./components/ListViewToolbar.vue"
import MarkdownPreviewDialog from "./components/MarkdownPreviewDialog.vue"
import PanelHeader from "./components/PanelHeader.vue"
import ProjectCard from "./components/ProjectCard.vue"
import ScanImportDialog from "./components/ScanImportDialog.vue"
import SettingsDialog from "./components/SettingsDialog.vue"
import StatsPanel from "./components/StatsPanel.vue"
import LogPanel from "./components/LogPanel.vue"
import BatchProgressBar from "./components/BatchProgressBar.vue"
import GitConfigDialog from "./components/GitConfigDialog.vue"
import Loader from "@/components/Loader.vue"
import { useGitPush } from "./composables/useGitPush"
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
import { CARD_SERVICES_KEY, PLATFORM_META, REMOTES } from "./types"
import {
  openLocalPath,
  openRepoWebUrl,
} from "./utils"

const props = defineProps<{
  i18n: Record<string, any>
  plugin: Plugin
  manager: GitPushManager
}>()

/** i18n 取值 + {n} 占位替换（i18n 是唯一文案数据源，不设兜底） */
function tf(key: string, ...args: (string | number)[]): string {
  let s: string = props.i18n[key]
  args.forEach((a, i) => { s = s.replace(`{${i}}`, String(a)) })
  return s
}

const {
  projects,
  categories,
  groupedProjects,
  loading,
  getPushStatus,
  isPushing,
  pushOutputs,
  isPulling,
  pullOutputs,
  pushStatuses,
  workingTrees,
  committing,
  loadProjects,
  loadPushStatus,
  loadWorkingTree,
  loadProjectGitStatus,
  loadStatsData,
  stageItem,
  stageAllItems,
  unstageItem,
  unstageAllItems,
  discardFile,
  doCommit,
  generateCommitMsg,
  addProject,
  removeProject,
  refreshRemotes,
  pushToAll,
  pushSingle,
  pullSingle,
  cancelPush,
  addCategory: addCategoryFn,
  deleteCategory: deleteCategoryFn,
  moveProject,
  switchBranch,
  startScan,
  importScanResults,
  scanning,
  scanResults,
  gitConcurrency,
  loadGitConcurrency,
  setGitConcurrency,
  stashLoading,
  doStashSave,
  doStashPop,
  doStashApply,
  doStashDrop,
  generateStashDesc,
  fetchAllRemotes,
  // 卡片刷新信号（下沉数据的父层写入替代通道）
  cardRefreshSignals,
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
} = useGitPush(props.manager)

// 卡片服务注入（ProjectCard 自包含下沉：卡片直连父层服务与刷新信号，消除中间人 props/emits）
provide(CARD_SERVICES_KEY, { manager: props.manager, updateProjectMeta, cardRefreshSignals, recordCommitActivity })

/** 卡片加载提交日志后回传最近活动时间（原 useGitOps.loadCommitLog 的副作用） */
async function recordCommitActivity(id: string, isoTime: string) {
  await props.manager.recordLastActivity(id, isoTime).catch(() => {})
  const project = projects.value.find((p) => p.id === id)
  if (project && project.lastActivity !== isoTime) {
    project.lastActivity = isoTime
    projects.value = [...projects.value]
  }
}

const showAddDialog = ref(false)
const showCatDialog = ref(false)
const showSettings = ref(false)
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

// ── 批量加载进度条（runBatchWithProgress 编排已下沉 useBatchProgress.runBatch）──
const { state: progressState, logEntries: progressLogEntries, hide: progressHide, runBatch: runBatchWithProgress } = useBatchProgress()

let initTimer: ReturnType<typeof setTimeout> | null = null
/** 当前视图: 'list' | 'stats' | 'log' */
const currentView = ref<PanelView>("list")
/** 日志视图首次读盘加载态（供 LogPanel 展示加载中占位，避免闪现空态） */
const opLogsLoading = ref(false)
/** 当前选中的分类 ID（onMounted 中设为首个分类） */
const activeCategory = ref<string>("")

/** 按分类 TAB 过滤后的分组 */
const visibleGroups = computed(() => {
  if (!activeCategory.value) return groupedProjects.value
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
  uncommittedProjects,
  starredProjects,
  visibleGroups,
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
  handleOpenScan,
  handleCloseScan,
  handleStartScan,
  handleToggleSelectAll,
  toggleScanItem,
  handleImportSelected,
} = useScanImport({
  scanResults, activeCategory, startScan, importScanResults, loadProjects, tf,
})

// ── Git 配置弹窗 ──
const {
  showGitConfig,
  gitConfigText,
  gitConfigLoading,
  gitConfigError,
  gitConfigFilePath,
  gitConfigTitle,
  handleOpenGitConfig,
  handleOpenProjectGitConfig,
  closeGitConfig,
} = useGitConfigDialog({ manager: props.manager, projects, tf })

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
} = useGitHandlers({
  projects, showConfirm, safeGitOp, tf,
  discardFile, doCommit, generateCommitMsg,
  doStashSave, doStashPop, doStashApply, doStashDrop, generateStashDesc,
  createTagOp, deleteTagOp, pushTagOp,
  abortMergeOp, resolveConflictOp,
  bumpCardRefresh, loadWorkingTree,
})

// ── 刷新操作集群 ──
const {
  refreshing,
  refreshingAll,
  refreshingAllLocal,
  refreshingAllRemote,
  showRefreshMenu,
  fetching,
  remoteStatusLoading,
  headHashes,
  handleRefresh,
  handleRefreshWorkingTree,
  handleRefreshRemoteStatus,
  handleRefreshAll,
  handleRefreshAllLocal,
  handleRefreshAllRemote,
  handleFetchAll,
} = useRefreshOps({
  manager: props.manager, projects, activeCategory, gitOpsPaused, runBatchWithProgress, tf,
  bumpCardRefresh,
  loadProjectGitStatus, loadPushStatus, loadWorkingTree,
  refreshRemotes, fetchAllRemotes,
})
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
  await loadProjects()
  loadCommitTemplates()
  loadCustomIdes()
  scanIdes() // 扫描已安装的 IDE
  await loadGitOpsPaused() // 从持久化存储恢复暂停状态
  await loadShowArchived() // 从持久化存储恢复归档显示状态
  // 默认选中第一个分类
  if (!activeCategory.value && groupedProjects.value.length > 0) {
    activeCategory.value = groupedProjects.value[0].category.id
  }
  loadGitConcurrency()
  // 首屏只加载显示卡片所需的最小集：工作区变更摘要 + 推送状态。
  // commitLog/branches/stash 改为展开工作区面板时按需懒加载（见 @expand）。
  // getHeadHash 仅刷新去重用，首屏无历史值可对比，跳过。
  // 使用 loadProjectGitStatus 合并 rev-parse HEAD，skipRefresh=true 跳过 update-index --refresh
  initTimer = setTimeout(async () => {
    if (gitOpsPaused.value) return
    const catId = activeCategory.value
    const projList = catId ? projects.value.filter((p) => p.categoryId === catId) : projects.value
    await runBatchWithProgress(projList, tf("loadingLabel"), async (p, ctx) => {
      await ctx.step(tf("stepStatus"), () => loadProjectGitStatus(p.id, true))
    })
  }, 200)
})

onUnmounted(() => {
  if (initTimer) { clearTimeout(initTimer); initTimer = null }
  document.removeEventListener("click", closeIdeMenuOnOutside)
})

/** 点击外部关闭顶栏菜单（添加/平台过滤/刷新；卡片内菜单由 ProjectCard 自行管理） */
function closeIdeMenuOnOutside(e: MouseEvent) {
  const target = e.target as HTMLElement | null
  if (target && !target.closest(".gp-add-wrap")) {
    showAddMenu.value = false
  }
  if (target && !target.closest(".gp-platform-wrap")) {
    showPlatformMenu.value = false
  }
  if (target && !target.closest(".gp-header-refresh-wrap")) {
    showRefreshMenu.value = false
  }
}

/** 切换分类时懒加载该分类下项目的数据（首屏最小集，详情展开时再补） */
watch(activeCategory, async (catId) => {
  if (!catId || gitOpsPaused.value) return
  const projList = projects.value.filter((p) => p.categoryId === catId)
  if (projList.length === 0) return
  // 只加载尚未缓存的
  const pending = projList.filter((p) => !workingTrees.value[p.id])
  if (pending.length === 0) return
  await runBatchWithProgress(pending, tf("loadingLabel"), async (p, ctx) => {
    await ctx.step(tf("stepStatus"), () => loadProjectGitStatus(p.id, true))
  })
})

/**
 * 补齐所有项目的统计最小数据集（pushStatus + workingTree），统计视图与智能视图共用。
 *  commitLog/branches/stash 不在这两类视图中展示，无需加载。
 *  使用 loadStatsData 共用 rev-parse，避免 loadPushStatus/loadWorkingTree 各调一次
 */
/** 在途去重：加载未完成时来回切换视图不再重复启动批量加载（防并发叠加、进度条反复重置） */
let statsLoadPromise: Promise<void> | null = null
async function ensureStatsDataLoaded() {
  if (gitOpsPaused.value) return
  if (statsLoadPromise) return statsLoadPromise
  const pending = projects.value.filter((p) => !pushStatuses.value[p.id] || !workingTrees.value[p.id])
  if (pending.length === 0) return
  statsLoadPromise = (async () => {
    try {
      await runBatchWithProgress(pending, tf("loadingLabel"), async (p, ctx) => {
        await ctx.step(tf("stepStats"), () => loadStatsData(p.id))
      })
    } finally {
      statsLoadPromise = null
    }
  })()
  return statsLoadPromise
}

/** 切换到统计视图时，补齐统计面板所需数据；切到日志视图时同步置 loading（pre-flush，避免 LogPanel 首渲闪空态） */
watch(currentView, async (view) => {
  if (view === "stats") await ensureStatsDataLoaded()
  if (view === "log") {
    opLogsLoading.value = true
    try {
      await ensureOpLogsLoaded()
    } finally {
      opLogsLoading.value = false
    }
  }
})

/** 切换到"需推送/有变更"智能视图时，补齐命中判定所需的全量状态数据 */
watch(viewMode, async (mode) => {
  if (mode !== "needsPush" && mode !== "uncommitted") return
  await ensureStatsDataLoaded()
})

/** 解除暂停时按当前上下文补载数据（暂停期间跳过的加载在恢复后立即补齐） */
watch(gitOpsPaused, async (paused) => {
  if (paused) return
  // 统计视图 / 智能视图需要全量状态数据
  if (currentView.value === "stats" || viewMode.value === "needsPush" || viewMode.value === "uncommitted") {
    await ensureStatsDataLoaded()
    return
  }
  // 列表视图只补当前分类下未缓存的项目（与首屏最小集一致）
  const catId = activeCategory.value
  const projList = catId ? projects.value.filter((p) => p.categoryId === catId) : projects.value
  const pending = projList.filter((p) => !workingTrees.value[p.id])
  if (pending.length === 0) return
  await runBatchWithProgress(pending, tf("loadingLabel"), async (p, ctx) => {
    await ctx.step(tf("stepStatus"), () => loadProjectGitStatus(p.id, true))
  })
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
  const project = projects.value.find((p) => p.id === projectId)
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

function handleRemove(project: GitProject) {
  showConfirm(tf("deleteProjectTitle"), tf("deleteProjectConfirm", project.name), () => {
    removeProject(project.id)
    // 清理 HEAD hash 缓存中已删除项目的条目
    delete headHashes.value[project.id]
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

/** 编辑弹窗保存后同步状态 */
async function handleEditSaved() {
  editDialogProjectId.value = ""
  await loadProjects()
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

async function handleDeleteCategory(id: string) {
  const cat = categories.value.find((c) => c.id === id)
  if (!cat) return
  showConfirm(tf("deleteCategoryTitle"), tf("deleteCategoryConfirm", cat.name), () => {
    doDeleteCategory(id)
  })
}

async function doDeleteCategory(id: string) {
  // 如果删除的是当前选中分类，切到第一个可用分类
  if (activeCategory.value === id) {
    const others = groupedProjects.value.filter((g) => g.category.id !== id)
    activeCategory.value = others.length > 0 ? others[0].category.id : ""
  }
  await deleteCategoryFn(id)
}

/** 推送分支模式 */
const pushBranchMode = ref<"all" | "head">(props.manager.getPushBranchMode())

async function handleSaveBranchMode(mode: "all" | "head") {
  pushBranchMode.value = mode
  await props.manager.setPushBranchMode(mode)
}

// 推送状态派生视图（徽章文案/样式类/推送判定，供 ProjectCard 函数 props）
const { statusLabel, statusBadgeClass, needsPushFor, hasBehind } = usePushStatusView(pushStatuses)
</script>

<style lang="scss">
@use "@/index.scss" as *;
@use "./styles/index.scss";
</style>
