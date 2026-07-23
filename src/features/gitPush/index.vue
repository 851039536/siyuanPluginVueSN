<!-- gitPush Git 项目管理主面板 -->
<template>
  <div class="git-push-panel">
    <!-- 头部 -->
    <PanelHeader
      v-model:currentView="currentView"
      v-model:showPlatformMenu="showPlatformMenu"
      v-model:showAddMenu="showAddMenu"
      v-model:showRefreshMenu="showRefreshMenu"
      :i18n="i18n"
      :project-count="projectCount"
      :refreshing-all="refreshingAll"
      :refreshing-all-local="refreshingAllLocal"
      :refreshing-all-remote="refreshingAllRemote"
      :needs-push-count="needsPushCount"
      :pushing-all-projects="pushingAllProjects"
      :push-all-done="pushAllDone"
      :push-all-total="pushAllTotal"
      :search-query="searchQuery"
      :search-placeholder="i18n.searchPlaceholder || '搜索项目...'"
      @update:search-query="searchQuery = $event"
      @open-category="showCatDialog = true"
      @open-settings="showSettings = true"
      @refresh-all="handleRefreshAll"
      @refresh-all-local="handleRefreshAllLocal"
      @refresh-all-remote="handleRefreshAllRemote"
      @push-all-projects="handlePushAllProjects"
      @cancel-push-all="pushingAllProjects = false"
      @open-add-project="showAddDialog = true"
      @open-scan="handleOpenScan"
      @open-web="handleOpenWeb"
      @open-git-config="handleOpenGitConfig"
    />

    <BatchProgressBar
      :state="progressState"
      :log-entries="progressLogEntries"
      @close="progressHide"
    />

    <!-- ========== 统计视图 ========== -->
    <StatsPanel
      v-if="currentView === 'stats'"
      :i18n="i18n"
      :project-count="projectCount"
      :remote-coverage="remoteCoverage"
      :push-status-stats="pushStatusStats"
      :needs-push-projects="needsPushProjects"
      :uncommitted-projects="uncommittedProjects"
      :platform-status-projects="platformStatusProjects"
      @view-project="onViewProject"
    />

    <!-- ========== 列表视图 ========== -->
    <template v-if="currentView === 'list'">
      <!-- 筛选工具栏 + 标签筛选 + 分类 TAB -->
      <ListViewToolbar
        :projects="projects"
        :grouped-projects="groupedProjects"
        :view-mode="viewMode"
        :active-category="activeCategory"
        :show-archived="showArchived"
        :git-ops-paused="gitOpsPaused"
        @update:view-mode="viewMode = $event"
        @update:active-category="activeCategory = $event"
        @update:show-archived="showArchived = $event"
        @update:git-ops-paused="gitOpsPaused = $event"
        @toggle-tag-filter="toggleTagFilter"
      />

      <!-- 项目列表 -->
      <div
        v-if="loading"
        class="gp-loading"
      >
        <Loader />
        <span class="gp-loading-text">{{ i18n.loading || '加载中...' }}</span>
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
          {{ i18n.noProjects || '暂无项目，点击上方添加' }}
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
            :status-meta="STATUS_META"
            :detected-ides="detectedIdes"
            :custom-ides="customIdes"
            :editing-name-id="editingNameId"
            :editing-name-input="editingNameInput"
            :search-query="searchQuery"
            :refreshing="refreshing"
            :fetching="fetching[project.id]"
            :open-ide-menu="openIdeMenu"
            :confirming-del-idx="confirmingDelIdx"
            :branches="branches[project.id]"
            :push-status="pushStatuses[project.id]"
            :working-tree="workingTrees[project.id]"
            :stash-entries="stashEntries[project.id]"
            :stash-loading="stashLoading[project.id]"
            :conflicts="conflicts[project.id]"
            :commit-output="commitOutputs[project.id]"
            :pull-outputs="pullOutputs[project.id]"
            :push-outputs="pushOutputs[project.id]"
            :committing="committing[project.id]"
            :generating-msg="generatingMsgs[project.id]"
            :git-op-loading="gitOpLoading[project.id]"
            :commit-log-loading="commitLogLoading[project.id]"
            :tags-cache="tagsCache[project.id]"
            :tag-loading="tagLoading[project.id]"
            :working-tree-loading="workingTreeLoading[project.id]"
            :working-tree-expanded="expandedWorkingTrees[project.id]"
            :remote-status-loading="remoteStatusLoading[project.id]"
            :open-refresh-menu="openRefreshMenu"
            :tag-push-loading="tagPushLoading[project.id]"
            :gen-stash-desc-loading="genStashDescLoading[project.id]"
            :generated-stash-msg="generatedStashMsg"
            :commit-templates="commitTemplates"
            :selected-tags="selectedTags"
            :get-project-url="getProjectUrl"
            :resolved-path="resolvedPath"
            :md-files="mdFilesForProject(project.id)"
            :relative-time="relativeTime"
            :activity-level="activityLevel"
            :status-badge-class="statusBadgeClass"
            :status-label="statusLabel"
            :has-behind="hasBehind"
            :file-diffs="fileDiffsForProject(project.id)"
            :commit-log-entries="commitLogForProject(project.id)"
            :has-any-remote="hasAnyRemote"
            :is-pulling="isPulling"
            :is-pushing="isPushing"
            :needs-push-for="needsPushFor"
            :get-push-status="getPushStatus"
            @toggle-star="toggleStar"
            @cycle-status="cycleStatus"
            @start-name-edit="startNameEdit"
            @name-edit-save="handleNameEditSave"
            @toggle-tag-filter="toggleTagFilter"
            @switch-branch="handleSwitchBranch"
            @remove="handleRemove"
            @open-edit-dialog="openEditDialog"
            @open-markdown-preview="openMarkdownPreview"
            @open-project-git-config="handleOpenProjectGitConfig"
            @move-project="handleMoveProject"
            @open-web="handleOpenWeb"
            @copy-url="handleCopyUrl"
            @open-path="handleOpenPath"
            @open-ide="handleOpenIde"
            @open-custom-ide="handleOpenCustomIde"
            @toggle-ide-menu="toggleIdeMenu"
            @toggle-refresh-menu="toggleRefreshMenu"
            @show-ide-dialog="showIdeDialog = true"
            @do-remove-custom-ide="doRemoveCustomIde"
            @update:editing-name-id="editingNameId = $event"
            @update:editing-name-input="editingNameInput = $event"
            @update:confirming-del-idx="confirmingDelIdx = $event"
            @refresh="handleRefresh"
            @refresh-working-tree="handleRefreshWorkingTree"
            @refresh-commit-log="handleRefreshCommitLog"
            @refresh-tags="handleRefreshTags"
            @refresh-remote-status="handleRefreshRemoteStatus"
            @stage-file="(id: string, file: string) => handleGitOp(tf('stageFailed', '暂存失败'), () => stageItem(id, file), id)"
            @unstage-file="(id: string, file: string) => handleGitOp(tf('unstageFailed', '取消暂存失败'), () => unstageItem(id, file), id)"
            @stage-all="(id: string) => handleGitOp(tf('stageFailed', '暂存失败'), () => stageAllItems(id), id)"
            @unstage-all="(id: string) => handleGitOp(tf('unstageFailed', '取消暂存失败'), () => unstageAllItems(id), id)"
            @commit="(id: string, msg: string) => handleCommit(id, msg)"
            @generate-msg="handleGenerateMsg"
            @load-diff="loadFileDiff"
            @clear-output="(id: string) => commitOutputs[id] = ''"
            @discard-file="handleDiscard"
            @expand="handleExpand"
            @update:working-tree-expanded="handleWorkingTreeExpanded"
            @reload-commit-log="handleReloadCommitLog"
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
        :selected-path="newProjectPath"
        @close="showAddDialog = false"
        @pick-dir="selectDirectory"
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
        @save="handleSaveConcurrency"
        @save-branch-mode="handleSaveBranchMode"
      />
    </Transition>
    <!-- 拉取确认弹窗 -->
    <ConfirmDialog
      :visible="showPullConfirm"
      :title="i18n.pullConfirm || '确认拉取'"
      message=""
      :confirm-text="i18n.pullConfirm || '确认拉取'"
      :cancel-text="i18n.cancel || '取消'"
      @confirm="doPullSingle"
      @cancel="cancelPullConfirm"
    >
      <template #message>
        <p class="gp-confirm-message">{{ pullConfirmMessage }}</p>
      </template>
    </ConfirmDialog>
    <!-- 通用确认弹窗（删除/丢弃/恢复/分类等破坏性操作） -->
    <ConfirmDialog
      :visible="genericConfirm.visible"
      :title="genericConfirm.title"
      :message="genericConfirm.message"
      :confirm-text="genericConfirm.confirmText || '确定'"
      :cancel-text="i18n.cancel || '取消'"
      @confirm="doGenericConfirm"
      @cancel="cancelGenericConfirm"
    />
    <Transition name="gp-dialog-fade">
      <IdeManagementDialog
        v-if="showIdeDialog"
        :i18n="i18n"
        :custom-ides="customIdes"
        :preset-options="IDE_PRESETS"
        :get-icon="getIdePresetIcon"
        @close="showIdeDialog = false"
        @add-ide="(preset: string, path: string) => { addIdePreset = preset; addIdePath = path; addCustomIde() }"
        @save-edit-ide="(idx: number, preset: string, path: string) => { editingIdeIdx = idx; editIdePreset = preset; editIdePath = path; saveEditIde(idx) }"
        @delete-ide="doRemoveCustomIde"
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
        :scan-dir="scanDirInput"
        @close="handleCloseScan"
        @pick-scan-dir="selectScanDirectory"
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
        :manager="manager"
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
  PlatformKey,
  ProjectStatus,
} from "./types"
import type { Plugin } from "siyuan"
import { Icon } from "@iconify/vue"
import { showMessage } from "siyuan"
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue"
import { copyToClipboard } from "@/utils/domUtils"
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
import BatchProgressBar from "./components/BatchProgressBar.vue"
import GitConfigDialog from "./components/GitConfigDialog.vue"
import Loader from "@/components/Loader.vue"
import { pickDirectory } from "./composables/useDirectoryPicker"
import { useGitPush } from "./composables/useGitPush"
import { useBatchProgress } from "./composables/useBatchProgress"
import {
  IDE_PRESETS,
  useIdeManagement,
} from "./composables/useIdeManagement"
import {
  useProjectFilters,
} from "./composables/useProjectFilters"
import { useTimeUtils } from "./composables/useTimeUtils"
import { useCommitLog } from "./composables/useCommitLog"
import { useScanImport } from "./composables/useScanImport"
import { useGitConfigDialog } from "./composables/useGitConfigDialog"
import { useGitHandlers } from "./composables/useGitHandlers"
import { useRefreshOps } from "./composables/useRefreshOps"
import { PLATFORM_META, REMOTES, STATUS_CYCLE, STATUS_META } from "./types"
import {
  batchProcess,
  gitUrlToWebUrl,
  hasAnyRemote,
  isAheadOfRemote,
  resolveValidPath,
} from "./utils"
import { scanMarkdownFiles } from "./composables/useMarkdownFiles"

const props = defineProps<{
  i18n: Record<string, any>
  plugin: Plugin
  manager: GitPushManager
}>()

/** i18n 取值 + {n} 占位替换，缺失时降级为 fallback */
function tf(key: string, fallback: string, ...args: (string | number)[]): string {
  let s: string = props.i18n[key] || fallback
  args.forEach((a, i) => { s = s.replace(`{${i}}`, String(a)) })
  return s
}

const ut = useTimeUtils()
const {
  relativeTime,
  activityLevel,
  sortProjects,
} = ut

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
  fileDiffs,
  committing,
  branches,
  loadProjects,
  loadPushStatus,
  loadWorkingTree,
  loadProjectGitStatus,
  loadStatsData,
  loadFileDiff,
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
  commitLogs,
  loadCommitLog,
  loadBranches,
  switchBranch,
  startScan,
  importScanResults,
  scanning,
  scanResults,
  scanDirInput,
  gitConcurrency,
  loadGitConcurrency,
  setGitConcurrency,
  stashEntries,
  stashLoading,
  loadStashList,
  doStashSave,
  doStashPop,
  doStashApply,
  doStashDrop,
  generateStashDesc,
  fetchAllRemotes,
  // Tag 管理
  tagsCache,
  tagLoading,
  loadTags,
  createTagOp,
  deleteTagOp,
  pushTagOp,
  // 冲突检测
  conflicts,
  checkConflicts,
  abortMergeOp,
  resolveConflictOp,
  // 提交信息模板
  commitTemplates,
  loadCommitTemplates,
  // 统计视图数据
  projectCount,
  remoteCoverage,
  pushStatusStats,
  needsPushProjects,
  uncommittedProjects,
  platformStatusProjects,
  // 项目聚合管理
  starredProjects,
  updateProjectMeta,
  toggleStar,
  setProjectStatus,
} = useGitPush(props.manager)

const { commitLogLoading, commitLogForProject, handleExpand, handleReloadCommitLog } = useCommitLog({
  commitLogs,
  loadCommitLog,
  loadBranches,
  loadStashList,
  loadTags,
})

/** 各项目工作区面板展开状态（按 projectId 持久化，跨会话记忆） */
const expandedWorkingTrees = ref<Record<string, boolean>>({})

/** 从持久化存储恢复工作区展开状态 */
async function loadExpandedWorkingTrees() {
  expandedWorkingTrees.value = await props.manager.storage.workingTreeExpanded.loadOrDefault()
}

/** 工作区展开状态变化：更新内存并持久化 */
function handleWorkingTreeExpanded(id: string, value: boolean) {
  if (value) {
    expandedWorkingTrees.value[id] = true
  } else {
    delete expandedWorkingTrees.value[id]
  }
  props.manager.storage.workingTreeExpanded.save({ ...expandedWorkingTrees.value }).catch(() => {})
}

const showAddDialog = ref(false)
const showCatDialog = ref(false)
const showSettings = ref(false)
const showAddMenu = ref(false)
const showPlatformMenu = ref(false)
/** 拉取确认状态 */
const showPullConfirm = ref(false)
interface PendingPull { id: string, key: PlatformKey }
const pendingPull = ref<PendingPull | null>(null)
const pendingPullLabel = computed(() => {
  if (!pendingPull.value) return ""
  return PLATFORM_META.find((pm) => pm.key === pendingPull.value!.key)?.label ?? pendingPull.value!.key
})
/** 拉取确认弹窗正文（复用 i18n pullConfirmBody，{0} 填充平台名） */
const pullConfirmMessage = computed(() =>
  (props.i18n.pullConfirmBody || "将从 {0} 拉取代码，可能覆盖本地修改。确定要继续吗？").replace("{0}", pendingPullLabel.value),
)
function confirmPullSingle(id: string, key: PlatformKey) {
  pendingPull.value = {
    id,
    key,
  }
  showPullConfirm.value = true
}
function cancelPullConfirm() {
  showPullConfirm.value = false
  pendingPull.value = null
}
function doPullSingle() {
  if (!pendingPull.value) return
  const {
    id,
    key,
  } = pendingPull.value
  pullSingle(id, key)
  showPullConfirm.value = false
  pendingPull.value = null
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

// ── 批量加载进度条 ──
const { state: progressState, logEntries: progressLogEntries, start: progressStart, advance: progressAdvance, end: progressEnd, finish: progressFinish, hide: progressHide, beginLog: progressBeginLog, addStep: progressAddStep, completeLog: progressCompleteLog } = useBatchProgress()

/** 步骤上下文：在 fn 内部用 ctx.step(name, fn) 测量并记录每个 git 操作的耗时 */
interface StepCtx {
  step<R>(name: string, fn: () => Promise<R>): Promise<R>
}

/** 批量处理 + 进度条包装（per-item 异常隔离，单项目失败不影响后续，支持分步骤计时） */
async function runBatchWithProgress<T>(
  items: T[], label: string, fn: (item: T, ctx: StepCtx) => Promise<void>, getName?: (item: T) => string, options?: { keepVisible?: boolean },
) {
  if (items.length === 0) { return }
  progressStart(items.length, label)
  try {
    await batchProcess(items, 3, async (item) => {
      const name = getName?.(item) ?? ""
      const displayName = name || `#${progressState.value.current + 1}`
      const logIdx = progressBeginLog(displayName)
      const start = Date.now()

      // 构造步骤上下文：step() 测量耗时后追加到当前日志条目
      const ctx: StepCtx = {
        async step<R>(stepName: string, stepFn: () => Promise<R>): Promise<R> {
          const stepStart = Date.now()
          try {
            return await stepFn()
          } finally {
            progressAddStep(logIdx, { name: stepName, ms: Date.now() - stepStart })
          }
        },
      }

      try {
        await fn(item, ctx)
        progressAdvance(name)
        progressCompleteLog(logIdx, "ok", (Date.now() - start) / 1000)
      } catch (err) {
        const elapsed = (Date.now() - start) / 1000
        progressAdvance(name)
        progressCompleteLog(logIdx, "fail", elapsed, String(err))
      }
    })
  } finally {
    if (options?.keepVisible) {
      progressFinish()
    } else {
      progressEnd()
    }
  }
}

let initTimer: ReturnType<typeof setTimeout> | null = null
/** 当前视图: 'list' | 'stats' */
const currentView = ref<"list" | "stats">("list")
/** 当前选中的分类 ID（onMounted 中设为首个分类） */
const activeCategory = ref<string>("")

/** 扫描导入弹窗状态 */

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
  selectedTags,
  filteredGroups,
  toggleTag: toggleTagFilter,
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
  sortProjects,
})

const {
  detectedIdes,
  customIdes,
  confirmingDelIdx,
  showIdeDialog,
  addIdePreset,
  addIdePath,
  editingIdeIdx,
  editIdePreset,
  editIdePath,
  getIdePresetIcon,
  saveEditIde,
  loadCustomIdes,
  addCustomIde,
  doRemoveCustomIde,
  handleOpenCustomIde,
  scanIdes,
  handleOpenIde,
} = useIdeManagement({
  plugin: props.plugin,
  openFolder: (path: string) => { handleOpenPath(path) },
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
  selectScanDirectory,
} = useScanImport({
  scanResults, scanDirInput, activeCategory, startScan, importScanResults, loadProjects, tf,
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
  abortMergeOp, resolveConflictOp, checkConflicts,
  loadTags, loadCommitLog, loadWorkingTree,
})

// ── 刷新操作集群 ──
const {
  refreshing,
  refreshingAll,
  refreshingAllLocal,
  refreshingAllRemote,
  showRefreshMenu,
  fetching,
  workingTreeLoading,
  remoteStatusLoading,
  headHashes,
  silentRefreshAll,
  handleRefresh,
  handleRefreshWorkingTree,
  handleRefreshCommitLog,
  handleRefreshTags,
  handleRefreshRemoteStatus,
  handleRefreshAll,
  handleRefreshAllLocal,
  handleRefreshAllRemote,
  handleFetchAll,
} = useRefreshOps({
  manager: props.manager, projects, activeCategory, gitOpsPaused, runBatchWithProgress, tf,
  commitLogLoading, tagLoading,
  loadProjectGitStatus, loadPushStatus, loadWorkingTree, loadCommitLog,
  loadBranches, loadStashList, loadTags, refreshRemotes, fetchAllRemotes,
})
/** 解析项目有效路径（模板辅助函数） */
function resolvedPath(p: { path: string, localPaths?: string[] }): string {
  return resolveValidPath(p as GitProject)
}

/** 获取项目平台 URL（模板中动态属性访问的辅助函数） */
function getProjectUrl(project: GitProject, prop: "githubUrl" | "giteeUrl" | "giteaUrl" | "cnbUrl"): string | undefined {
  return project[prop]
}

const newProjectPath = ref("") // 目录选择回填用
/** 项目编辑弹窗状态 */
const editDialogProjectId = ref("")
/** Markdown 文档预览弹窗状态 */
const markdownPreviewProject = ref<GitProject | null>(null)
const markdownPreviewInitialFile = ref<string | undefined>(undefined)
/** 项目 Markdown 文件缓存（项目 id → 文件元数据数组，避免每次 readdirSync） */
const projectMdFiles = ref<Record<string, ReturnType<typeof scanMarkdownFiles>>>({})
/** 行内名称编辑状态 */
const editingNameId = ref("")
const editingNameInput = ref("")
/** IDE 打开菜单：当前打开的项目 id 集合 */
const openIdeMenu = ref(new Set<string>())
/** 刷新下拉菜单：当前打开的项目 id 集合 */
const openRefreshMenu = ref(new Set<string>())
/** 获取指定项目的 Markdown 文件列表（懒扫描 + 缓存） */
function mdFilesForProject(projectId: string): ReturnType<typeof scanMarkdownFiles> {
  if (projectMdFiles.value[projectId]) return projectMdFiles.value[projectId]
  const project = projects.value.find((p) => p.id === projectId)
  if (!project) return []
  const files = scanMarkdownFiles(resolveValidPath(project))
  projectMdFiles.value = { ...projectMdFiles.value, [projectId]: files }
  return files
}

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

/** 提取指定项目相关的 fileDiffs（按前缀过滤） */
function fileDiffsForProject(projectId: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, val] of Object.entries(fileDiffs.value)) {
    if (key.startsWith(`${projectId}::`)) {
      // 去掉 projectId 前缀作为组件内 key
      result[key.substring(projectId.length + 2)] = val
    }
  }
  return result
}

onMounted(async () => {
  document.addEventListener("click", closeIdeMenuOnOutside)
  await loadProjects()
  projectMdFiles.value = {}
  loadCommitTemplates()
  loadCustomIdes()
  scanIdes() // 扫描已安装的 IDE
  await loadGitOpsPaused() // 从持久化存储恢复暂停状态
  await loadShowArchived() // 从持久化存储恢复归档显示状态
  await loadExpandedWorkingTrees() // 从持久化存储恢复工作区展开状态
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
    await runBatchWithProgress(projList, tf("loadingLabel", "加载中"), async (p, ctx) => {
      await ctx.step(tf("stepStatus", "状态"), () => loadProjectGitStatus(p.id, true))
    })
  }, 200)
})

onUnmounted(() => {
  if (initTimer) { clearTimeout(initTimer); initTimer = null }
  document.removeEventListener("click", closeIdeMenuOnOutside)
})

/** 点击外部关闭 IDE 菜单 / 添加菜单 / 刷新菜单 */
function closeIdeMenuOnOutside(e: MouseEvent) {
  const target = e.target as HTMLElement | null
  if (target && !target.closest(".gp-ide-wrap")) {
    openIdeMenu.value = new Set()
  }
  if (target && !target.closest(".gp-add-wrap")) {
    showAddMenu.value = false
  }
  if (target && !target.closest(".gp-platform-wrap")) {
    showPlatformMenu.value = false
  }
  if (target && !target.closest(".gp-refresh-wrap")) {
    openRefreshMenu.value = new Set()
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
  await runBatchWithProgress(pending, tf("loadingLabel", "加载中"), async (p, ctx) => {
    await ctx.step(tf("stepStatus", "状态"), () => loadProjectGitStatus(p.id, true))
  })
})

/**
 * 切换到统计视图时，补齐统计面板所需的最小数据集（pushStatus + workingTree）。
 *  commitLog/branches/stash 不在统计视图中展示，无需加载。
 *  使用 loadStatsData 共用 rev-parse，避免 loadPushStatus/loadWorkingTree 各调一次
 */
watch(currentView, async (view) => {
  if (view !== "stats" || gitOpsPaused.value) return
  const pending = projects.value.filter((p) => !pushStatuses.value[p.id] || !workingTrees.value[p.id])
  if (pending.length === 0) return
  await runBatchWithProgress(pending, tf("loadingLabel", "加载中"), async (p, ctx) => {
    await ctx.step(tf("stepStats", "统计"), () => loadStatsData(p.id))
  })
})

async function handleAddFromDialog(data: { name: string, path: string, catId: string }) {
  try {
    await addProject(data.name, data.path, data.catId)
    showAddDialog.value = false
  } catch (e: any) {
    showMessage(e?.message || tf("addFailed", "添加失败"), 5000, "error")
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

/** 在文件管理器中打开项目路径 */
async function handleOpenPath(path: string) {
  if (typeof window.require === "function") {
    try {
      const electron = window.require("electron")
      const shell = electron.shell || electron.remote?.shell
      if (shell?.openPath) {
        await shell.openPath(path)

      }
    } catch {
      // 降级
    }
  }
  // 浏览器环境：无法直接打开本地文件夹
}

/** 切换 IDE 打开菜单 */
function toggleIdeMenu(id: string) {
  const s = openIdeMenu.value
  if (s.has(id)) { s.delete(id) } else { s.add(id) }
  openIdeMenu.value = new Set(s)
}

/** 切换刷新下拉菜单 */
function toggleRefreshMenu(id: string) {
  const s = openRefreshMenu.value
  if (s.has(id)) { s.delete(id) } else { s.add(id) }
  openRefreshMenu.value = new Set(s)
}

/** 在浏览器中打开远程仓库网页 */
async function handleOpenWeb(url: string) {
  const webUrl = gitUrlToWebUrl(url)
  if (typeof window.require === "function") {
    try {
      const electron = window.require("electron")
      const shell = electron.shell || electron.remote?.shell
      if (shell?.openExternal) {
        await shell.openExternal(webUrl)
        return
      }
    } catch {
      // 降级
    }
  }
  window.open(webUrl, "_blank")
}

/** 右键复制远程仓库链接 */
async function handleCopyUrl(url: string) {
  const ok = await copyToClipboard(url)
  if (ok) {
    showMessage(tf("copiedLink", "已复制链接"), 1500, "info")
  }
}

function handleRemove(project: any) {
  showConfirm(tf("deleteProjectTitle", "删除项目"), tf("deleteProjectConfirm", "确定要删除项目 \"{0}\" 吗？此操作不可撤销。", project.name), () => {
    removeProject(project.id)
    // 清理 HEAD hash 缓存中已删除项目的条目
    delete headHashes.value[project.id]
  })
}

async function handleSwitchBranch(id: string, branch: string) {
  await safeGitOp(tf("switchBranchFailed", "分支切换失败"), () => switchBranch(id, branch))
}

// ---- 项目聚合管理操作 ----

/** 状态徽章循环切换 active → maintenance → paused → active */
async function cycleStatus(id: string, current?: ProjectStatus) {
  const cur: ProjectStatus = current || "active"
  const idx = STATUS_CYCLE.indexOf(cur)
  const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
  await setProjectStatus(id, next)
}

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

/** 行内名称编辑：点击名称开始编辑 */
function startNameEdit(project: GitProject) {
  editingNameId.value = project.id
  editingNameInput.value = project.name
}

/** 行内名称编辑：失焦/回车保存 */
async function handleNameEditSave(project: GitProject) {
  const newName = editingNameInput.value.trim()
  try {
    if (!newName) {
      showMessage(tf("nameEmpty", "项目名称不能为空"), 2000, "error")
    } else if (newName !== project.name) {
      await updateProjectMeta(project.id, { name: newName })
    }
  } catch (e: any) {
    showMessage(tf("nameUpdateFailed", "名称修改失败: {0}", e?.message || e), 4000, "error")
  } finally {
    editingNameId.value = ""
  }
}

/** 统一的异步操作错误处理包装器 */
async function safeGitOp(label: string, fn: () => Promise<void>) {
  try {
    await fn()
  } catch (e: any) {
    showMessage(`${label}: ${e?.message || e}`, 5000, "error")
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
  showConfirm(tf("deleteCategoryTitle", "删除分类"), tf("deleteCategoryConfirm", "确定删除分类 \"{0}\"？\n该分类下的项目将移至「未分组」。", cat.name), () => {
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

async function handleMoveProject(projectId: string, categoryId: string) {
  await moveProject(projectId, categoryId)
}

async function handleSaveConcurrency(value: number) {
  await setGitConcurrency(value)
}

/** 推送分支模式 */
const pushBranchMode = ref<"all" | "head">(props.manager.getPushBranchMode())

async function handleSaveBranchMode(mode: "all" | "head") {
  pushBranchMode.value = mode
  await props.manager.setPushBranchMode(mode)
}

/** 推送所有项目状态 */
const pushingAllProjects = ref(false)
const pushAllDone = ref(0)
const pushAllTotal = ref(0)

/** 当前视图下需要推送的项目数 */
const needsPushCount = computed(() => {
  let count = 0
  for (const p of projects.value) {
    if (pushStatuses.value[p.id]?.needsPush) { count++ }
  }
  return count
})

async function handlePushAllProjects() {
  pushingAllProjects.value = true
  const allProjects = projects.value.filter((p) => pushStatuses.value[p.id]?.needsPush)
  pushAllTotal.value = allProjects.length
  pushAllDone.value = 0
  try {
    // 批次并发推送（复用 gitConcurrency）；取消后不再启动新批次，进行中的批次自然完成
    await batchProcess(allProjects, gitConcurrency.value || 3, async (p) => {
      if (!pushingAllProjects.value) return
      await pushToAll(p.id)
      pushAllDone.value++
    })
  } finally {
    pushingAllProjects.value = false
  }
}

/** 获取指定项目指定远程的推送状态 */
function getRemoteStatus(projectId: string, remoteKey: string) {
  return pushStatuses.value[projectId]?.remotes[remoteKey]
}

/** 获取远程推送状态标签文案 */
function statusLabel(projectId: string, remoteKey: string): string {
  const rs = getRemoteStatus(projectId, remoteKey)
  if (!rs) return ""
  if (rs.noUpstream) return `+${rs.ahead}`
  if (rs.ahead > 0) return `↑${rs.ahead}`
  if (rs.behind > 0) return `↓${rs.behind}`
  return ""
}

/** 获取状态 badge 的 CSS 类 */
function statusBadgeClass(projectId: string, remoteKey: string): string {
  const rs = getRemoteStatus(projectId, remoteKey)
  if (!rs) return ""
  if (isAheadOfRemote(rs)) return "gp-ahead"
  if (rs.behind > 0) return "gp-behind"
  return "gp-synced"
}

/** 判断某个远程是否需要推送（本地超前或从未推送） */
function needsPushFor(projectId: string, remoteKey: string): boolean {
  const rs = getRemoteStatus(projectId, remoteKey)
  if (!rs) return true // 尚未检测，允许点击
  return isAheadOfRemote(rs)
}

/** 判断项目是否有远程落后（远程有新提交） */
function hasBehind(projectId: string): boolean {
  const status = pushStatuses.value[projectId]
  if (!status) return false
  return Object.values(status.remotes).some((r) => r.behind > 0)
}

async function selectDirectory() {
  const path = await pickDirectory(tf("selectProjectDirTitle", "选择项目目录"))
  if (path) newProjectPath.value = path
}
</script>

<style lang="scss">
@use "@/index.scss" as *;
@use "./styles/variables" as *;
@use "./styles/mixins" as *;
@use "./styles/Buttons";
@use "./styles/Shared";
@use "./styles/index.scss";
</style>
