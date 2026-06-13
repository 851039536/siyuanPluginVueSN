<template>
  <div class="git-push-panel">
    <!-- 头部 -->
    <div class="gp-header">
      <span class="gp-title">{{ i18n.panelTitle || 'Git 推送' }}</span>
      <div class="gp-header-btns">
        <button class="vp-btn vp-btn--ghost vp-btn--sm" @click="showCatDialog = true">
          <Icon icon="mdi:tag-outline" />
        </button>
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          title="刷新全部"
          :disabled="refreshingAll"
          @click="handleRefreshAll"
        >
          <Icon icon="mdi:sync" :class="{ 'gp-spin': refreshingAll }" />
        </button>
        <button class="vp-btn vp-btn--ghost gp-add-btn" @click="showAddDialog = true">
          <Icon icon="mdi:plus" />
          <span>{{ i18n.addProject || '添加项目' }}</span>
        </button>
      </div>
    </div>

    <div class="gp-divider" />

    <!-- 项目列表 -->
    <div v-if="loading" class="gp-loading">{{ i18n.loading || '加载中...' }}</div>

    <div v-else-if="projects.length === 0" class="gp-empty">
      <div class="gp-empty-icon">
        <Icon icon="mdi:source-repository" width="48" />
      </div>
      <div class="gp-empty-text">{{ i18n.noProjects || '暂无项目，点击上方添加' }}</div>
    </div>

    <div v-else class="gp-list">
      <template v-for="group in groupedProjects" :key="group.category.id">
        <div class="gp-cat-header" :style="{ borderLeftColor: group.category.color }">
          <span class="gp-cat-dot" :style="{ background: group.category.color }" />
          <span class="gp-cat-name">{{ group.category.name }}</span>
          <span class="gp-cat-count">{{ group.projects.length }}</span>
        </div>
        <div
          v-for="project in group.projects"
          :key="project.id"
          class="gp-card"
        >
        <div class="gp-card-top">
          <div class="gp-card-info">
            <div class="gp-card-name">{{ project.name }}</div>
            <div class="gp-card-path" :title="project.path">{{ project.path }}</div>
          </div>
          <div class="gp-card-actions">
            <select
              class="gp-cat-select"
              :value="project.categoryId"
              :title="i18n.moveCategory || '移动分类'"
              @change.stop="handleMoveProject(project.id, ($event.target as HTMLSelectElement).value)"
            >
              <option
                v-for="cat in categories"
                :key="cat.id"
                :value="cat.id"
                :selected="cat.id === project.categoryId"
              >
                {{ cat.name }}
              </option>
            </select>
            <button
              class="vp-btn vp-btn--ghost vp-btn--sm"
              title="打开项目目录"
              @click="handleOpenPath(project.path)"
            >
              <Icon icon="mdi:folder-open" height="14" />
            </button>
            <button
              class="vp-btn vp-btn--ghost vp-btn--sm"
              title="重新检测远程仓库"
              @click="handleRefresh(project.id)"
            >
              <Icon icon="mdi:refresh" :class="{ 'gp-spin': refreshing === project.id }" />
            </button>
            <button
              class="vp-btn vp-btn--ghost vp-btn--sm gp-btn-danger"
              @click="handleRemove(project)"
            >
              <Icon icon="mdi:delete-outline" />
            </button>
          </div>
        </div>

        <!-- 远程仓库状态 -->
        <div class="gp-remotes">
          <div
            v-for="r in REMOTES"
            :key="r.key"
            class="gp-remote-item"
            :class="{ active: !!project[r.remoteProp] }"
          >
            <Icon :icon="r.icon" />
            <span v-if="project[r.remoteProp]">{{ project[r.remoteProp] }}</span>
            <span v-else class="gp-remote-none">{{ i18n.notDetected || '未检测到' }}</span>
            <span
              v-if="pushStatuses[project.id]?.remotes[r.key]"
              class="gp-status-badge"
              :class="statusBadgeClass(project.id, r.key)"
            >
              {{ statusLabel(project.id, r.key) }}
            </span>
          </div>
        </div>

        <!-- 工作区变更状态 -->
        <WorkingTreePanel
          v-if="workingTrees[project.id]"
          :i18n="i18n"
          :tree="workingTrees[project.id]"
          :committing="committing[project.id] || false"
          :generating="generatingMsgs[project.id]?.generating || false"
          :commit-output="commitOutputs[project.id] || ''"
          :generated-msg="generatingMsgs[project.id]?.text || ''"
          :file-diffs="fileDiffsForProject(project.id)"
          :git-op-loading="gitOpLoading[project.id] || false"
          @stage-file="(file) => handleGitOp('暂存失败', () => stageItem(project.id, file), project.id)"
          @unstage-file="(file) => handleGitOp('取消暂存失败', () => unstageItem(project.id, file), project.id)"
          @stage-all="handleGitOp('暂存失败', () => stageAllItems(project.id), project.id)"
          @unstage-all="handleGitOp('取消暂存失败', () => unstageAllItems(project.id), project.id)"
          @commit="(msg) => handleCommit(project.id, msg)"
          @generate-msg="handleGenerateMsg(project.id)"
          @load-diff="(file, staged) => loadFileDiff(project.id, file, staged)"
          @clear-output="commitOutputs[project.id] = ''"
        />

        <!-- 推送按钮组 -->
        <div class="gp-push-group">
          <button
            v-for="r in REMOTES"
            :key="r.key"
            class="vp-btn vp-btn--ghost gp-push-btn"
            :disabled="!project[r.remoteProp] || isPushing(project.id) || !needsPushFor(project.id, r.key)"
            @click="pushSingle(project.id, r.key as 'github' | 'gitee' | 'gitea')"
          >
            <Icon v-if="isPushing(project.id, r.key)" icon="mdi:loading" class="gp-spin" />
            <Icon v-else :icon="r.icon" />
            <span v-if="isPushing(project.id, r.key)">{{ i18n.pushing || '推送中...' }}</span>
            <span v-else>{{ r.label }}</span>
          </button>
          <button
            class="vp-btn vp-btn--primary gp-push-btn"
            :disabled="(!project.githubRemote && !project.giteeRemote && !project.giteaRemote) || isPushing(project.id) || !pushStatuses[project.id]?.needsPush"
            @click="pushToAll(project.id)"
          >
            <Icon v-if="isPushing(project.id, 'all')" icon="mdi:loading" class="gp-spin" />
            <Icon v-else icon="mdi:cloud-upload" />
            <span v-if="isPushing(project.id, 'all')">{{ i18n.pushing || '推送中...' }}</span>
            <span v-else>{{ i18n.pushAll || '推送全部' }}</span>
          </button>
        </div>

        <!-- 推送输出 -->
        <div v-if="pushOutputs[project.id]" class="gp-output">
          <pre>{{ pushOutputs[project.id] }}</pre>
        </div>
        </div>
      </template>
    </div>

    <!-- 添加项目弹窗 -->
    <div v-if="showAddDialog" class="gp-mask" @click.self="showAddDialog = false">
      <div class="gp-dialog">
        <div class="gp-dialog-header">
          <span class="gp-dialog-title">{{ i18n.addProject || '添加项目' }}</span>
          <button class="vp-btn vp-btn--ghost vp-btn--sm" @click="showAddDialog = false">
            <Icon icon="mdi:close" />
          </button>
        </div>
        <div class="gp-dialog-body">
          <div class="gp-form-group">
            <label class="gp-label">{{ i18n.projectName || '项目名称' }}</label>
            <input
              v-model="newProjectName"
              class="gp-input"
              :placeholder="i18n.namePlaceholder || '输入项目名称...'"
              @keyup.enter="handleAdd"
            />
          </div>
          <div class="gp-form-group">
            <label class="gp-label">{{ i18n.projectPath || '项目路径' }}</label>
            <div class="gp-path-row">
              <input
                v-model="newProjectPath"
                class="gp-input"
                :placeholder="i18n.pathPlaceholder || '选择或输入项目路径...'"
                @keyup.enter="handleAdd"
              />
              <button class="vp-btn vp-btn--ghost vp-btn--sm" @click="selectDirectory">
                <Icon icon="mdi:folder-open" />
              </button>
            </div>
          </div>
          <div class="gp-form-group">
            <label class="gp-label">{{ i18n.category || '分类' }}</label>
            <select v-model="newProjectCat" class="gp-select">
              <option
                v-for="cat in categories"
                :key="cat.id"
                :value="cat.id"
              >
                {{ cat.name }}
              </option>
            </select>
          </div>
          <div v-if="addError" class="gp-error">{{ addError }}</div>
          <div v-if="addChecking" class="gp-checking">
            <Icon icon="mdi:loading" class="gp-spin" />
            {{ i18n.checkingGit || '正在检查 git 仓库...' }}
          </div>
          <div v-if="addResult !== null && !addChecking" class="gp-check-result" :class="{ success: addResult }">
            {{ addResult ? (i18n.gitRepoDetected || '✅ 已检测到 git 仓库') : (i18n.notGitRepo || '❌ 未检测到 git 仓库，将仅记录路径') }}
          </div>
        </div>
        <div class="gp-dialog-footer">
          <button class="vp-btn vp-btn--ghost" @click="showAddDialog = false">
            {{ i18n.cancel || '取消' }}
          </button>
          <button class="vp-btn vp-btn--primary" :disabled="!newProjectName || !newProjectPath" @click="handleAdd">
            {{ i18n.add || '添加' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 管理分类弹窗 -->
    <div v-if="showCatDialog" class="gp-mask" @click.self="showCatDialog = false">
      <div class="gp-dialog" style="width: 340px;">
        <div class="gp-dialog-header">
          <span class="gp-dialog-title">{{ i18n.manageCategories || '管理分类' }}</span>
          <button class="vp-btn vp-btn--ghost vp-btn--sm" @click="showCatDialog = false">
            <Icon icon="mdi:close" />
          </button>
        </div>
        <div class="gp-dialog-body">
          <div v-for="cat in categories" :key="cat.id" class="gp-cat-row">
            <span class="gp-cat-dot-sm" :style="{ background: cat.color }" />
            <span class="gp-cat-name-sm">{{ cat.name }}</span>
            <button
              v-if="cat.id !== '__ungrouped__'"
              class="vp-btn vp-btn--ghost vp-btn--sm gp-btn-danger"
              @click="handleDeleteCategory(cat.id)"
            >
              <Icon icon="mdi:delete-outline" height="12" />
            </button>
          </div>
          <div class="gp-cat-add-row">
            <input
              v-model="newCatName"
              class="gp-input"
              :placeholder="i18n.catNamePlaceholder || '分类名称'"
              @keyup.enter="handleAddCategory"
              style="flex:1"
            />
            <input
              v-model="newCatColor"
              type="color"
              class="gp-color-input"
              title="颜色"
            />
            <button
              class="vp-btn vp-btn--primary vp-btn--sm"
              :disabled="!newCatName.trim()"
              @click="handleAddCategory"
            >
              <Icon icon="mdi:plus" height="13" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue"
import { Icon } from "@iconify/vue"
import type { GitPushManager, GitProject } from "./types"
import { useGitPush } from "./composables/useGitPush"
import WorkingTreePanel from "./components/WorkingTreePanel.vue"

type RemoteKey = "github" | "gitee" | "gitea"

/** 远程仓库配置常量（驱动模板 v-for） */
const REMOTES: { key: RemoteKey; icon: string; label: string; remoteProp: keyof GitProject }[] = [
  { key: "github", icon: "mdi:github", label: "GitHub", remoteProp: "githubRemote" },
  { key: "gitee", icon: "mdi:git", label: "Gitee", remoteProp: "giteeRemote" },
  { key: "gitea", icon: "mdi:tea", label: "Gitea", remoteProp: "giteaRemote" },
]

const props = defineProps<{
  i18n: Record<string, any>
  plugin: any
  manager: GitPushManager
}>()

const {
  projects,
  categories,
  groupedProjects,
  loading,
  isPushing,
  pushOutputs,
  pushStatuses,
  workingTrees,
  fileDiffs,
  committing,
  loadProjects,
  loadPushStatus,
  loadWorkingTree,
  loadFileDiff,
  stageItem,
  stageAllItems,
  unstageItem,
  unstageAllItems,
  doCommit,
  generateCommitMsg,
  addProject,
  removeProject,
  refreshRemotes,
  pushToAll,
  pushSingle,
  checkIsGitRepo,
  addCategory: addCategoryFn,
  deleteCategory: deleteCategoryFn,
  moveProject,
} = useGitPush(props.manager)

const showAddDialog = ref(false)
const showCatDialog = ref(false)
const newProjectName = ref("")
const newProjectPath = ref("")
const newProjectCat = ref("__ungrouped__")
const newCatName = ref("")
const newCatColor = ref("#4a9eff")
const addError = ref("")
const addChecking = ref(false)
const addResult = ref<boolean | null>(null)
const refreshing = ref<string | null>(null)
const refreshingAll = ref(false)
/** 提交输出 id → text */
const commitOutputs = ref<Record<string, string>>({})
/** AI 生成状态 id → { generating, text } */
const generatingMsgs = ref<Record<string, { generating: boolean; text: string }>>({})
/** 暂存/取消操作加载中 id → true */
const gitOpLoading = ref<Record<string, boolean>>({})
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

onMounted(() => {
  loadProjects()
  // 自动加载各项目工作区状态
  setTimeout(async () => {
    for (const p of projects.value) {
      await loadWorkingTree(p.id)
    }
  }, 200)
})

async function handleAdd() {
  addError.value = ""
  if (!newProjectName.value.trim()) {
    addError.value = "请输入项目名称"
    return
  }
  if (!newProjectPath.value.trim()) {
    addError.value = "请输入项目路径"
    return
  }

  addChecking.value = true
  addResult.value = null
  try {
    const isGit = await checkIsGitRepo(newProjectPath.value.trim())
    addResult.value = isGit
    // 即使不是 git 仓库也允许添加（用户可能后续初始化）
    await addProject(newProjectName.value.trim(), newProjectPath.value.trim(), newProjectCat.value)
    showAddDialog.value = false
    newProjectName.value = ""
    newProjectPath.value = ""
    newProjectCat.value = "__ungrouped__"
    addResult.value = null
  } catch (e: any) {
    addError.value = e?.message || "添加失败"
  } finally {
    addChecking.value = false
  }
}

async function handleRefresh(id: string) {
  refreshing.value = id
  try {
    await refreshRemotes(id)
    await loadPushStatus(id)
    await loadWorkingTree(id)
  } finally {
    refreshing.value = null
  }
}

async function handleRefreshAll() {
  refreshingAll.value = true
  try {
    for (const p of projects.value) {
      await refreshRemotes(p.id)
      await loadPushStatus(p.id)
      await loadWorkingTree(p.id)
    }
  } finally {
    refreshingAll.value = false
  }
}

/** 在文件管理器中打开项目路径 */
async function handleOpenPath(path: string) {
  if (typeof window.require === "function") {
    try {
      const electron = window.require("electron")
      const shell = electron.shell || electron.remote?.shell
      if (shell?.openPath) {
        await shell.openPath(path)
        return
      }
    } catch {
      // 降级
    }
  }
  // 浏览器环境：无法直接打开本地文件夹
}

function handleRemove(project: any) {
  if (confirm(`确定要删除项目 "${project.name}" 吗？`)) {
    removeProject(project.id)
  }
}

// ---- 工作区操作 ----

/** 统一的 git 操作错误处理包装（含 loading 状态和调试日志） */
async function handleGitOp(label: string, fn: () => Promise<void>, id: string) {
  commitOutputs.value[id] = ""
  gitOpLoading.value[id] = true
  console.log(`[gitPush] ${label} 操作开始`)
  try {
    await fn()
    console.log(`[gitPush] ${label} 操作成功`)
  } catch (e: any) {
    console.error(`[gitPush] ${label} 失败:`, e)
    commitOutputs.value[id] = `${label}: ${e?.message || e}`
  } finally {
    delete gitOpLoading.value[id]
  }
}

async function handleCommit(id: string, message: string) {
  commitOutputs.value[id] = ""
  try {
    const result = await doCommit(id, message)
    commitOutputs.value[id] = result || "提交成功"
  } catch (e: any) {
    commitOutputs.value[id] = `提交失败: ${e?.message || e}`
  }
}

async function handleGenerateMsg(id: string) {
  generatingMsgs.value = { ...generatingMsgs.value, [id]: { generating: true, text: "" } }
  commitOutputs.value[id] = ""
  try {
    const result = await generateCommitMsg(id)
    generatingMsgs.value = { ...generatingMsgs.value, [id]: { generating: false, text: result.message } }
    if (result.source === "heuristic") {
      commitOutputs.value[id] = "⚠️ 未配置 AI API Key，使用启发式生成。可在超级面板设置中配置。"
    }
  } catch (e: any) {
    commitOutputs.value[id] = `❌ 生成失败: ${e?.message || e}`
    generatingMsgs.value = { ...generatingMsgs.value, [id]: { generating: false, text: "" } }
  }
}

// ---- 分类管理 ----

async function handleAddCategory() {
  const name = newCatName.value.trim()
  if (!name) return
  await addCategoryFn(name, newCatColor.value)
  newCatName.value = ""
}

async function handleDeleteCategory(id: string) {
  const cat = categories.value.find(c => c.id === id)
  if (!cat || !confirm(`确定删除分类 "${cat.name}"？\n该分类下的项目将移至「未分组」。`)) return
  await deleteCategoryFn(id)
}

async function handleMoveProject(projectId: string, categoryId: string) {
  await moveProject(projectId, categoryId)
}

/** 获取远程推送状态标签文案 */
function statusLabel(projectId: string, remoteKey: string): string {
  const status = pushStatuses.value[projectId]
  const rs = status?.remotes[remoteKey]
  if (!rs) return ""
  if (rs.noUpstream) return `+${rs.ahead}`
  if (rs.ahead > 0) return `↑${rs.ahead}`
  if (rs.behind > 0) return `↓${rs.behind}`
  return "✓"
}

/** 获取状态 badge 的 CSS 类 */
function statusBadgeClass(projectId: string, remoteKey: string): string {
  const status = pushStatuses.value[projectId]
  const rs = status?.remotes[remoteKey]
  if (!rs) return ""
  if (rs.noUpstream || rs.ahead > 0) return "gp-ahead"
  if (rs.behind > 0) return "gp-behind"
  return "gp-synced"
}

/** 判断某个远程是否需要推送（本地超前或从未推送） */
function needsPushFor(projectId: string, remoteKey: string): boolean {
  const status = pushStatuses.value[projectId]
  const rs = status?.remotes[remoteKey]
  if (!rs) return true // 尚未检测，允许点击
  return rs.noUpstream || rs.ahead > 0
}

async function selectDirectory() {
  // 优先使用 Electron 原生目录选择对话框（路径可靠）
  if (typeof window.require === "function") {
    try {
      let remote: any
      // 兼容新旧 Electron：先尝试 @electron/remote（Electron 14+），再回退 electron.remote
      try {
        remote = window.require("@electron/remote")
      } catch {
        const electron = window.require("electron")
        remote = electron.remote || electron
      }
      if (remote?.dialog?.showOpenDialog) {
        const result = await remote.dialog.showOpenDialog({
          properties: ["openDirectory"],
          title: "选择项目目录",
        })
        if (!result.canceled && result.filePaths[0]) {
          newProjectPath.value = result.filePaths[0]
          return
        }
      }
    } catch {
      // 降级到 webkitdirectory 方案
    }
  }
  // 降级方案：浏览器环境使用 input[webkitdirectory]
  try {
    const input = document.createElement("input")
    input.type = "file"
    input.setAttribute("webkitdirectory", "")
    input.setAttribute("directory", "")
    input.onchange = (e: any) => {
      const files = e.target?.files
      if (files && files.length > 0) {
        const relativePath = files[0].webkitRelativePath
        const dirName = relativePath.split("/")[0]
        if (files[0].path) {
          const fullPath = files[0].path
          const dirPath = fullPath.substring(0, fullPath.lastIndexOf(dirName) + dirName.length)
          newProjectPath.value = dirPath
        }
      }
    }
    input.click()
  } catch {
    // 最终降级：用户手动输入
  }
}
</script>

<style lang="scss">
@use "@/index.scss" as *;

$vp-mono: "JetBrains Mono", "Fira Code", "Consolas", monospace;

.git-push-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px;
  overflow-y: auto;
}

.gp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.gp-header-btns {
  display: flex;
  gap: 4px;
}

.gp-title {
  font-size: 14px;
  font-weight: 600;
}

.gp-divider {
  border-bottom: 1px solid var(--b3-border-color);
  margin: 10px 0;
}

.gp-loading,
.gp-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: var(--b3-theme-on-surface-light);
  font-size: 13px;
}

.gp-empty-icon {
  opacity: 0.3;
  margin-bottom: 8px;
}

.gp-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.gp-card {
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
  padding: 10px 12px;
  transition: border-color 0.15s;

  &:hover {
    border-color: var(--b3-theme-primary);
  }
}

.gp-cat-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 0 2px;
  border-left: 3px solid transparent;
  padding-left: 8px;
}

.gp-cat-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.gp-cat-name {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  opacity: 0.5;
}

.gp-cat-count {
  font-size: 10px;
  font-weight: 600;
  font-family: $vp-mono;
  opacity: 0.35;
}

.gp-card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.gp-card-info {
  flex: 1;
  min-width: 0;
}

.gp-card-name {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 2px;
}

.gp-card-path {
  font-size: 10px;
  font-family: $vp-mono;
  opacity: 0.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 280px;
}

.gp-card-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.gp-btn-danger {
  &:hover {
    color: var(--b3-theme-error);
  }
}

.gp-remotes {
  display: flex;
  gap: 16px;
  margin: 8px 0;
}

.gp-remote-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-family: $vp-mono;
  opacity: 0.35;
  text-transform: uppercase;
  letter-spacing: 0.04em;

  &.active {
    opacity: 1;
    color: var(--b3-theme-primary);
  }
}

.gp-remote-none {
  opacity: 0.35;
}

.gp-status-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 3px;
  margin-left: 4px;
  letter-spacing: 0;

  &.gp-ahead {
    background: var(--b3-theme-primary-lightest);
    color: var(--b3-theme-primary);
  }

  &.gp-behind {
    background: var(--b3-theme-warning-lightest);
    color: var(--b3-theme-warning);
  }

  &.gp-synced {
    background: var(--b3-theme-success-lightest);
    color: var(--b3-theme-success);
  }
}

.gp-push-group {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}

.gp-push-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 12px;
  padding: 6px 4px;

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.gp-output {
  margin-top: 8px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  padding: 8px;
  max-height: 150px;
  overflow: auto;

  pre {
    margin: 0;
    font-size: 10px;
    font-family: $vp-mono;
    white-space: pre-wrap;
    word-break: break-all;
    color: var(--b3-theme-on-surface);
  }
}

.gp-spin {
  animation: gp-spin 1s linear infinite;
}

@keyframes gp-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

// 弹窗
.gp-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gp-dialog {
  background: var(--b3-theme-background);
  border-radius: 8px;
  width: 420px;
  max-width: 90vw;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.gp-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--b3-border-color);
}

.gp-dialog-title {
  font-size: 14px;
  font-weight: 600;
}

.gp-dialog-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.gp-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--b3-border-color);
}

.gp-form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.gp-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.45;
}

.gp-input {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  font-size: 12px;
  font-family: $vp-mono;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;

  &:focus {
    border-color: var(--b3-theme-primary);
    box-shadow: 0 0 0 2px var(--b3-theme-primary-lightest);
  }

  &::placeholder {
    opacity: 0.35;
  }
}

.gp-path-row {
  display: flex;
  gap: 4px;
}

.gp-error {
  font-size: 11px;
  color: var(--b3-theme-error);
}

.gp-checking {
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 6px;
  opacity: 0.6;
}

.gp-check-result {
  font-size: 11px;

  &.success {
    color: var(--b3-theme-primary);
  }

  &:not(.success) {
    opacity: 0.5;
  }
}

// 分类管理弹窗
.gp-cat-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  border-bottom: 1px solid var(--b3-border-color);

  &:last-of-type {
    border-bottom: none;
  }
}

.gp-cat-dot-sm {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.gp-cat-name-sm {
  flex: 1;
  font-size: 11px;
}

.gp-cat-add-row {
  display: flex;
  gap: 4px;
  margin-top: 8px;
}

.gp-color-input {
  width: 28px;
  height: 28px;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  cursor: pointer;
  padding: 2px;
  background: none;
}

// 分类选择框（卡片内联）
.gp-cat-select {
  background: transparent;
  border: 1px solid var(--b3-border-color);
  border-radius: 3px;
  color: var(--b3-theme-on-surface);
  font-size: 10px;
  padding: 1px 2px;
  cursor: pointer;
  max-width: 60px;
  opacity: 0.5;

  &:hover {
    opacity: 1;
  }
}

// 添加弹窗中的分类下拉
.gp-select {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  font-size: 12px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  outline: none;
  cursor: pointer;

  &:focus {
    border-color: var(--b3-theme-primary);
    box-shadow: 0 0 0 2px var(--b3-theme-primary-lightest);
  }
}

// 按钮样式
.vp-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s;

  &--sm {
    padding: 3px 6px;
    font-size: 11px;
  }

  &--primary {
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
    border-color: var(--b3-theme-primary);

    &:hover {
      opacity: 0.85;
    }
  }

  &--ghost {
    background: transparent;
    border-color: var(--b3-border-color);
    color: var(--b3-theme-on-surface);

    &:hover {
      background: var(--b3-list-hover);
    }
  }
}
</style>
