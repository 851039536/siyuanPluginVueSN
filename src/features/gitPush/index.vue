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
        {{ i18n.loading || '加载中...' }}
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
            @stage-file="(id: string, file: string) => handleGitOp('暂存失败', () => stageItem(id, file), id)"
            @unstage-file="(id: string, file: string) => handleGitOp('取消暂存失败', () => unstageItem(id, file), id)"
            @stage-all="(id: string) => handleGitOp('暂存失败', () => stageAllItems(id), id)"
            @unstage-all="(id: string) => handleGitOp('取消暂存失败', () => unstageAllItems(id), id)"
            @commit="(id: string, msg: string) => handleCommit(id, msg)"
            @generate-msg="handleGenerateMsg"
            @load-diff="loadFileDiff"
            @clear-output="(id: string) => commitOutputs[id] = ''"
            @discard-file="handleDiscard"
            @expand="handleExpand"
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

    <AddProjectDialog
      v-if="showAddDialog"
      :i18n="i18n"
      :categories="categories"
      :selected-path="newProjectPath"
      @close="showAddDialog = false"
      @pick-dir="selectDirectory"
      @add="handleAddFromDialog"
    />
    <CategoryDialog
      v-if="showCatDialog"
      :i18n="i18n"
      :categories="categories"
      @close="showCatDialog = false"
      @add-category="handleAddCategory"
      @delete-category="handleDeleteCategory"
    />
    <SettingsDialog
      v-if="showSettings"
      :i18n="i18n"
      :concurrency="gitConcurrency"
      :push-branch-mode="pushBranchMode"
      @close="showSettings = false"
      @save="handleSaveConcurrency"
      @save-branch-mode="handleSaveBranchMode"
    />
    <!-- 拉取确认弹窗 -->
    <ConfirmDialog
      :visible="showPullConfirm"
      :title="i18n.pullConfirm || '确认拉取'"
      message=""
      confirm-text="确认拉取"
      cancel-text="取消"
      @confirm="doPullSingle"
      @cancel="cancelPullConfirm"
    >
      <template #message>
        <p class="gp-confirm-message">将从 <strong>{{ pendingPullLabel }}</strong> 拉取代码，可能覆盖本地修改。<br>确定要继续吗？</p>
      </template>
    </ConfirmDialog>
    <!-- 通用确认弹窗（删除/丢弃/恢复/分类等破坏性操作） -->
    <ConfirmDialog
      :visible="genericConfirm.visible"
      :title="genericConfirm.title"
      :message="genericConfirm.message"
      :confirm-text="genericConfirm.confirmText || '确定'"
      cancel-text="取消"
      @confirm="doGenericConfirm"
      @cancel="cancelGenericConfirm"
    />
    <IdeManagementDialog
      v-if="showIdeDialog"
      :custom-ides="customIdes"
      :preset-options="IDE_PRESETS"
      :get-icon="getIdePresetIcon"
      @close="showIdeDialog = false"
      @add-ide="(preset: string, path: string) => { addIdePreset = preset; addIdePath = path; addCustomIde() }"
      @save-edit-ide="(idx: number, preset: string, path: string) => { editingIdeIdx = idx; editIdePreset = preset; editIdePath = path; saveEditIde(idx) }"
      @delete-ide="doRemoveCustomIde"
    />
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
    <EditProjectDialog
      v-if="editDialogProjectId"
      :project-id="editDialogProjectId"
      :manager="manager"
      :i18n="i18n"
      @close="editDialogProjectId = ''"
      @saved="handleEditSaved"
      @urls-updated="handleUrlsUpdated"
    />
    <MarkdownPreviewDialog
      v-if="markdownPreviewProject"
      :project="markdownPreviewProject"
      :manager="manager"
      :i18n="i18n"
      :initial-file="markdownPreviewInitialFile"
      @close="closeMarkdownPreview"
    />
  </div>
</template>

<script setup lang="ts">
import type {
  GitProject,
  GitPushManager,
  PlatformKey,
  ProjectStatus,
} from "./types"
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
import { PLATFORM_META, REMOTES, STATUS_CYCLE, STATUS_META, UNGROUPED_ID } from "./types"
import {
  batchProcess,
  getProjectRemoteNames,
  gitUrlToWebUrl,
  hasAnyRemote,
  isAheadOfRemote,
  pruneRecordCache,
  resolveValidPath,
} from "./utils"
import { scanMarkdownFiles } from "./composables/useMarkdownFiles"

const props = defineProps<{
  i18n: Record<string, any>
  plugin: any
  manager: GitPushManager
}>()

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
const showScanDialog = ref(false)
const scanError = ref("")
const scanSelection = ref<Record<string, boolean>>({})

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
/** 解析项目有效路径（模板辅助函数） */
function resolvedPath(p: { path: string, localPaths?: string[] }): string {
  return resolveValidPath(p as GitProject)
}

/** 获取项目平台 URL（模板中动态属性访问的辅助函数） */
function getProjectUrl(project: GitProject, prop: "githubUrl" | "giteeUrl" | "giteaUrl" | "cnbUrl"): string | undefined {
  return project[prop]
}

const newProjectPath = ref("") // 目录选择回填用
const refreshing = ref<string | null>(null)
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
const refreshingAll = ref(false)
/** 本地状态刷新 loading（不 fetch） */
const refreshingAllLocal = ref(false)
/** 远程状态刷新 loading（含 fetch） */
const refreshingAllRemote = ref(false)
/** Header 刷新下拉菜单开关 */
const showRefreshMenu = ref(false)
/** 全局刷新防抖冷却时间（毫秒） */
const REFRESH_COOLDOWN_MS = 500
/** 全局刷新防抖时间戳 */
let allRefreshLastTime = 0
/** 远程刷新防抖时间戳 */
let remoteRefreshLastTime = 0
/** FETCH 操作加载中 id → true */
const fetching = ref<Record<string, boolean>>({})
/** IDE 打开菜单：当前打开的项目 id 集合 */
const openIdeMenu = ref(new Set<string>())
/** 提交输出 id → text */
const commitOutputs = ref<Record<string, string>>({})
/** AI 生成状态 id → { generating, text } */
const generatingMsgs = ref<Record<string, { generating: boolean, text: string }>>({})
/** 暂存/取消操作加载中 id → true */
const gitOpLoading = ref<Record<string, boolean>>({})
/** 工作区刷新加载中 id → true */
const workingTreeLoading = ref<Record<string, boolean>>({})
/** 远程状态刷新加载中 id → true */
const remoteStatusLoading = ref<Record<string, boolean>>({})
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

/** HEAD hash 缓存，用于跳过无变动项目的 commit log / branches 刷新 */
const headHashes = ref<Record<string, string>>({})

/** 静默刷新当前分类下的项目状态（批次处理，每批 3 个匹配 git 信号量上限） */
async function silentRefreshAll(keepVisible = false) {
  if (gitOpsPaused.value) return
  const catId = activeCategory.value
  const projList = catId ? projects.value.filter((p) => p.categoryId === catId) : projects.value
  if (projList.length === 0) return

  await runBatchWithProgress(projList, "刷新中", async (p, ctx) => {
    const prev = headHashes.value[p.id] || ""
    const [, curr] = await Promise.all([
      ctx.step("状态", () => loadProjectGitStatus(p.id, true)),
      ctx.step("HEAD", () => props.manager.getHeadHash(resolveValidPath(p))),
    ])

    if (curr && curr !== prev) {
      headHashes.value[p.id] = curr
      await Promise.all([
        ctx.step("日志", () => loadCommitLog(p.id)),
        ctx.step("分支", () => loadBranches(p.id)),
        ctx.step("Stash", () => loadStashList(p.id)),
      ])
    } else if (curr) {
      await ctx.step("Stash", () => loadStashList(p.id))
    }
  }, undefined, { keepVisible })
}

onMounted(async () => {
  await loadProjects()
  projectMdFiles.value = {}
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
    await runBatchWithProgress(projList, "加载中", async (p, ctx) => {
      await ctx.step("状态", () => loadProjectGitStatus(p.id, true))
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

// 挂载时注册，卸载时清理
document.addEventListener("click", closeIdeMenuOnOutside)

/** 切换分类时懒加载该分类下项目的数据（首屏最小集，详情展开时再补） */
watch(activeCategory, async (catId) => {
  if (!catId || gitOpsPaused.value) return
  const projList = projects.value.filter((p) => p.categoryId === catId)
  if (projList.length === 0) return
  // 只加载尚未缓存的
  const pending = projList.filter((p) => !workingTrees.value[p.id])
  if (pending.length === 0) return
  await runBatchWithProgress(pending, "加载中", async (p, ctx) => {
    await ctx.step("状态", () => loadProjectGitStatus(p.id, true))
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
  await runBatchWithProgress(pending, "加载中", async (p, ctx) => {
    await ctx.step("统计", () => loadStatsData(p.id))
  })
})

async function handleAddFromDialog(data: { name: string, path: string, catId: string }) {
  try {
    await addProject(data.name, data.path, data.catId)
    showAddDialog.value = false
  } catch (e: any) {
    showMessage(e?.message || "添加失败", 5000, "error")
  }
}

async function handleRefresh(id: string) {
  const project = projects.value.find((p) => p.id === id)
  if (!project) return
  refreshing.value = id
  try {
    await runBatchWithProgress([project], "刷新中", async (p, ctx) => {
      // 一次 rev-parse 获取 branch，六项操作全部并行（git 信号量自动限流到 3）
      const cwd = resolveValidPath(p)
      const branch = await props.manager.getBranch(cwd)
      await Promise.all([
        ctx.step("远程", () => refreshRemotes(p.id)),
        ctx.step("推送", () => loadPushStatus(p.id, { fetchFirst: true, branch })),
        ctx.step("工作区", () => loadWorkingTree(p.id, false, branch)),
        ctx.step("日志", () => loadCommitLog(p.id)),
        ctx.step("分支", () => loadBranches(p.id)),
        ctx.step("Stash", () => loadStashList(p.id)),
      ])
    }, (p) => p.name, { keepVisible: true })
  } finally {
    refreshing.value = null
  }
}

// ---- 细分刷新操作 ----

async function handleRefreshWorkingTree(id: string) {
  const project = projects.value.find((p) => p.id === id)
  if (!project) return
  workingTreeLoading.value = { ...workingTreeLoading.value, [id]: true }
  try {
    const branch = await props.manager.getBranch(resolveValidPath(project))
    await loadWorkingTree(id, false, branch)
  } finally {
    delete workingTreeLoading.value[id]
    workingTreeLoading.value = { ...workingTreeLoading.value }
  }
}

async function handleRefreshCommitLog(id: string) {
  commitLogLoading.value = { ...commitLogLoading.value, [id]: true }
  try {
    await loadCommitLog(id)
  } finally {
    delete commitLogLoading.value[id]
    commitLogLoading.value = { ...commitLogLoading.value }
  }
}

async function handleRefreshTags(id: string) {
  tagLoading.value = { ...tagLoading.value, [id]: true }
  try {
    await loadTags(id)
  } finally {
    delete tagLoading.value[id]
    tagLoading.value = { ...tagLoading.value }
  }
}

async function handleRefreshRemoteStatus(id: string) {
  const project = projects.value.find((p) => p.id === id)
  if (!project) return
  remoteStatusLoading.value = { ...remoteStatusLoading.value, [id]: true }
  try {
    const branch = await props.manager.getBranch(resolveValidPath(project))
    await Promise.all([
      refreshRemotes(id),
      loadPushStatus(id, { fetchFirst: true, branch }),
    ])
  } finally {
    delete remoteStatusLoading.value[id]
    remoteStatusLoading.value = { ...remoteStatusLoading.value }
  }
}

async function handleRefreshAll() {
  if (gitOpsPaused.value) return
  // 防抖：全局刷新的冷却期内跳过
  if (Date.now() - allRefreshLastTime < REFRESH_COOLDOWN_MS) return
  allRefreshLastTime = Date.now()
  refreshingAll.value = true
  try {
    await silentRefreshAll(true)
  } finally {
    refreshingAll.value = false
  }
}

/** Header 下拉：刷新本地状态（不含 git fetch，快） */
async function handleRefreshAllLocal() {
  if (gitOpsPaused.value) return
  if (Date.now() - allRefreshLastTime < REFRESH_COOLDOWN_MS) return
  allRefreshLastTime = Date.now()
  showRefreshMenu.value = false
  refreshingAllLocal.value = true
  try {
    await silentRefreshAll(true)
  } finally {
    refreshingAllLocal.value = false
  }
}

/** Header 下拉：刷新远程状态（含 git fetch，慢） */
async function handleRefreshAllRemote() {
  if (gitOpsPaused.value) return
  if (Date.now() - remoteRefreshLastTime < REFRESH_COOLDOWN_MS) return
  remoteRefreshLastTime = Date.now()
  showRefreshMenu.value = false
  refreshingAllRemote.value = true
  try {
    const catId = activeCategory.value
    const projList = catId ? projects.value.filter((p) => p.categoryId === catId) : projects.value
    if (projList.length === 0) return
    await runBatchWithProgress(projList, "更新远程状态", async (p) => {
      await fetchAllRemotes(p.id)
    }, undefined, { keepVisible: true })
  } finally {
    refreshingAllRemote.value = false
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
    showMessage("已复制链接", 1500, "info")
  }
}

/** Fetch 所有远程 + 刷新状态 */
async function handleFetchAll(id: string) {
  fetching.value = {
    ...fetching.value,
    [id]: true,
  }
  try {
    await fetchAllRemotes(id)
  } catch (e: any) {
    showMessage(e?.message || "Fetch 失败", 5000, "error")
  } finally {
    delete fetching.value[id]
    fetching.value = { ...fetching.value }
  }
}

function handleRemove(project: any) {
  showConfirm("删除项目", `确定要删除项目 "${project.name}" 吗？此操作不可撤销。`, () => {
    removeProject(project.id)
    // 清理 HEAD hash 缓存中已删除项目的条目
    delete headHashes.value[project.id]
  })
}

async function handleSwitchBranch(id: string, branch: string) {
  await safeGitOp("分支切换失败", () => switchBranch(id, branch))
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
      showMessage("项目名称不能为空", 2000, "error")
    } else if (newName !== project.name) {
      await updateProjectMeta(project.id, { name: newName })
    }
  } catch (e: any) {
    showMessage(`名称修改失败: ${e?.message || e}`, 4000, "error")
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

// ---- 工作区操作 ----

/** 统一的 git 操作错误处理包装（含 loading 状态） */
async function handleGitOp(label: string, fn: () => Promise<void>, id: string) {
  commitOutputs.value[id] = ""
  gitOpLoading.value[id] = true
  try {
    await fn()
  } catch (e: any) {
    console.error(`[gitPush] ${label} 失败:`, e)
    commitOutputs.value[id] = `${label}: ${e?.message || e}`
  } finally {
    delete gitOpLoading.value[id]
    pruneRecordCache(commitOutputs.value)
  }
}

async function handleDiscard(id: string, file: string, staged: boolean, status: string) {
  const label = status === "untracked" ? "删除未跟踪文件" : "丢弃更改"
  showConfirm("确认操作", `确定要${label} "${file}" 吗？此操作不可撤销。`, () => {
    doDiscard(id, file, staged, status, label)
  })
}

async function doDiscard(id: string, file: string, staged: boolean, status: string, label: string) {
  commitOutputs.value[id] = ""
  gitOpLoading.value[id] = true
  try {
    await discardFile(id, file, staged, status)
    await loadWorkingTree(id)
  } catch (e: any) {
    commitOutputs.value[id] = `${label}失败: ${e?.message || e}`
  } finally {
    delete gitOpLoading.value[id]
  }
}

// ---- Stash 操作 ----

const genStashDescLoading = ref<Record<string, boolean>>({})
const generatedStashMsg = ref("")
/** Tag 推送操作加载中 id → tagName */
const tagPushLoading = ref<Record<string, string>>({})

async function handleGenStashDesc(id: string) {
  genStashDescLoading.value[id] = true
  try {
    const desc = await generateStashDesc(id)
    if (desc) generatedStashMsg.value = desc
  } catch {
    // 失败则保持输入内容不变
  } finally {
    delete genStashDescLoading.value[id]
  }
}

function handleStashConfirmMsg(id: string, msg: string) {
  safeGitOp("暂存失败", () => doStashSave(id, msg))
}

function handleStashPop(id: string, index: number) {
  showConfirm("恢复 Stash", `确定恢复 stash@{${index}} 并删除该条目？恢复过程中如有冲突会保留该 stash。`, () => {
    safeGitOp("恢复失败", () => doStashPop(id, index))
  })
}

function handleStashApply(id: string, index: number) {
  safeGitOp("应用失败", () => doStashApply(id, index))
}

function handleStashDrop(id: string, index: number) {
  showConfirm("删除 Stash", `确定删除 stash@{${index}}？此操作不可撤销。`, () => {
    safeGitOp("删除失败", () => doStashDrop(id, index))
  })
}

// ── Tag 操作 ──

function handleCreateTag(id: string, name: string, message?: string) {
  safeGitOp("创建 Tag 失败", () => createTagOp(id, name, message).then(() => { loadTags(id) }))
}

function handleDeleteTag(id: string, tag: string) {
  showConfirm("删除 Tag", `确定删除 Tag "${tag}"？此操作不可撤销。`, () => {
    safeGitOp("删除失败", () => deleteTagOp(id, tag).then(() => { loadTags(id) }))
  })
}

async function handlePushTag(id: string, tag: string) {
  const project = projects.value.find((p) => p.id === id)
  if (!project) return
  // 收集所有已配置的远程
  const remoteNames = getProjectRemoteNames(project).map((r) => r.name)
  if (remoteNames.length === 0) { showMessage("未找到远程仓库", 3000, "error"); return }
  tagPushLoading.value = {
    ...tagPushLoading.value,
    [id]: tag,
  }
  try {
    await Promise.all(remoteNames.map((name) => pushTagOp(id, name, tag)))
  } catch (e: any) {
    showMessage(`推送 Tag 失败: ${e?.message || e}`, 5000, "error")
  } finally {
    delete tagPushLoading.value[id]
    // ref<Record> 的 delete 不被 Vue 深层响应式追踪检测到，需手动触发浅拷贝
    tagPushLoading.value = { ...tagPushLoading.value }
  }
}

// ── 冲突操作 ──

function handleAbortMerge(id: string) {
  showConfirm("中止合并", "确定中止合并操作？所有合并进度将丢失。", () => {
    safeGitOp("中止合并失败", () => abortMergeOp(id))
  })
}

function handleResolveConflict(id: string, file: string, strategy: "theirs" | "ours") {
  safeGitOp("解决冲突失败", () => resolveConflictOp(id, file, strategy).then(() => { checkConflicts(id) }))
}

async function handleCommit(id: string, message: string) {
  commitOutputs.value[id] = ""
  try {
    const result = await doCommit(id, message)
    commitOutputs.value[id] = result || "提交成功"
    pruneRecordCache(commitOutputs.value)
    await loadCommitLog(id)
  } catch (e: any) {
    commitOutputs.value[id] = `提交失败: ${e?.message || e}`
  }
}

async function handleGenerateMsg(id: string) {
  generatingMsgs.value = {
    ...generatingMsgs.value,
    [id]: {
      generating: true,
      text: "",
    },
  }
  commitOutputs.value[id] = ""
  try {
    const result = await generateCommitMsg(id)
    generatingMsgs.value = {
      ...generatingMsgs.value,
      [id]: {
        generating: false,
        text: result.message,
      },
    }
    if (result.source === "heuristic") {
      commitOutputs.value[id] = "AI 未返回有效信息，已使用启发式生成。"
    }
  } catch (e: any) {
    commitOutputs.value[id] = `生成失败: ${e?.message || e}`
    generatingMsgs.value = {
      ...generatingMsgs.value,
      [id]: {
        generating: false,
        text: "",
      },
    }
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
  showConfirm("删除分类", `确定删除分类 "${cat.name}"？\n该分类下的项目将移至「未分组」。`, () => {
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
    for (const p of allProjects) {
      if (!pushingAllProjects.value) break
      await pushToAll(p.id)
      pushAllDone.value++
    }
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
  const path = await pickDirectory("选择项目目录")
  if (path) newProjectPath.value = path
}

// ---- 扫描导入 ----

function handleOpenScan() {
  scanError.value = ""
  scanDirInput.value = ""
  scanResults.value = []
  scanSelection.value = {}
  showScanDialog.value = true
}

function handleCloseScan() {
  showScanDialog.value = false
  scanError.value = ""
}

async function handleStartScan() {
  scanError.value = ""
  try {
    await startScan(scanDirInput.value.trim())
    // 扫描成功 → 自动全选未导入项
    const sel: Record<string, boolean> = {}
    for (const repo of scanResults.value) {
      if (!repo.alreadyImported) {
        sel[repo.path] = true
      }
    }
    scanSelection.value = sel
  } catch (e: any) {
    scanError.value = e?.message || (props.i18n.scanError || '扫描失败')
  }
}

function handleToggleSelectAll() {
  const allSelected = scanResults.value.every(
    (r) => r.alreadyImported || scanSelection.value[r.path],
  )
  const sel: Record<string, boolean> = {}
  for (const repo of scanResults.value) {
    if (!repo.alreadyImported) {
      sel[repo.path] = !allSelected
    }
  }
  scanSelection.value = sel
}

function toggleScanItem(path: string) {
  scanSelection.value = {
    ...scanSelection.value,
    [path]: !scanSelection.value[path],
  }
}

async function handleImportSelected() {
  const selected = scanResults.value
    .filter((r) => scanSelection.value[r.path])
    .map((r) => r.path)
  const catId = activeCategory.value || UNGROUPED_ID
  const {
    imported,
    skipped,
  } = await importScanResults(selected, catId)
  // 刷新项目列表以显示新导入的项目
  await loadProjects()
  handleCloseScan()
  if (imported > 0 || skipped > 0) {
    showMessage(`导入完成：成功 ${imported} 个${skipped > 0 ? `，跳过 ${skipped} 个` : ""}`, 3000, "info")
  }
}

/** 扫描目录专用路径选择，结果写入 scanDirInput */
async function selectScanDirectory() {
  const path = await pickDirectory("选择要扫描的目录")
  if (path) scanDirInput.value = path
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
