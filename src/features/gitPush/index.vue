<template>
  <div class="git-push-panel">
    <!-- 头部 -->
    <div class="gp-header">
      <span class="gp-title">{{ i18n.panelTitle || 'Git 推送' }}</span>
      <button class="vp-btn vp-btn--ghost gp-add-btn" @click="showAddDialog = true">
        <Icon icon="mdi:plus" />
        <span>{{ i18n.addProject || '添加项目' }}</span>
      </button>
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
      <div
        v-for="project in projects"
        :key="project.id"
        class="gp-card"
      >
        <div class="gp-card-top">
          <div class="gp-card-info">
            <div class="gp-card-name">{{ project.name }}</div>
            <div class="gp-card-path" :title="project.path">{{ project.path }}</div>
          </div>
          <div class="gp-card-actions">
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
          <div class="gp-remote-item" :class="{ active: !!project.githubRemote }">
            <Icon icon="mdi:github" />
            <span v-if="project.githubRemote">{{ project.githubRemote }}</span>
            <span v-else class="gp-remote-none">{{ i18n.notDetected || '未检测到' }}</span>
            <!-- 推送状态指示 -->
            <span v-if="pushStatuses[project.id]?.remotes.github" class="gp-status-badge" :class="statusBadgeClass(project.id, 'github')">
              {{ statusLabel(project.id, 'github') }}
            </span>
          </div>
          <div class="gp-remote-item" :class="{ active: !!project.giteeRemote }">
            <Icon icon="mdi:git" />
            <span v-if="project.giteeRemote">{{ project.giteeRemote }}</span>
            <span v-else class="gp-remote-none">{{ i18n.notDetected || '未检测到' }}</span>
            <span v-if="pushStatuses[project.id]?.remotes.gitee" class="gp-status-badge" :class="statusBadgeClass(project.id, 'gitee')">
              {{ statusLabel(project.id, 'gitee') }}
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
          @stage-file="(file) => handleStageFile(project.id, file)"
          @unstage-file="(file) => handleUnstageFile(project.id, file)"
          @stage-all="handleStageAll(project.id)"
          @unstage-all="handleUnstageAll(project.id)"
          @commit="(msg) => handleCommit(project.id, msg)"
          @generate-msg="handleGenerateMsg(project.id)"
          @load-diff="(file, staged) => handleLoadDiff(project.id, file, staged)"
        />

        <!-- 推送按钮组 -->
        <div class="gp-push-group">
          <button
            class="vp-btn vp-btn--ghost gp-push-btn"
            :disabled="!project.githubRemote || isPushing(project.id) || !needsPushFor(project.id, 'github')"
            @click="handlePushSingle(project.id, 'github')"
          >
            <Icon v-if="isPushing(project.id, 'github')" icon="mdi:loading" class="gp-spin" />
            <Icon v-else icon="mdi:github" />
            <span v-if="isPushing(project.id, 'github')">{{ i18n.pushing || '推送中...' }}</span>
            <span v-else>GitHub</span>
          </button>
          <button
            class="vp-btn vp-btn--ghost gp-push-btn"
            :disabled="!project.giteeRemote || isPushing(project.id) || !needsPushFor(project.id, 'gitee')"
            @click="handlePushSingle(project.id, 'gitee')"
          >
            <Icon v-if="isPushing(project.id, 'gitee')" icon="mdi:loading" class="gp-spin" />
            <Icon v-else icon="mdi:git" />
            <span v-if="isPushing(project.id, 'gitee')">{{ i18n.pushing || '推送中...' }}</span>
            <span v-else>Gitee</span>
          </button>
          <button
            class="vp-btn vp-btn--primary gp-push-btn"
            :disabled="(!project.githubRemote && !project.giteeRemote) || isPushing(project.id) || !pushStatuses[project.id]?.needsPush"
            @click="handlePushBoth(project.id)"
          >
            <Icon v-if="isPushing(project.id, 'both')" icon="mdi:loading" class="gp-spin" />
            <Icon v-else icon="mdi:cloud-upload" />
            <span v-if="isPushing(project.id, 'both')">{{ i18n.pushing || '推送中...' }}</span>
            <span v-else>{{ i18n.pushBoth || '双平台' }}</span>
          </button>
        </div>

        <!-- 推送输出 -->
        <div v-if="pushOutputs[project.id]" class="gp-output">
          <pre>{{ pushOutputs[project.id] }}</pre>
        </div>
      </div>
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
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue"
import { Icon } from "@iconify/vue"
import type { GitPushManager } from "./types"
import { useGitPush } from "./composables/useGitPush"
import WorkingTreePanel from "./components/WorkingTreePanel.vue"

const props = defineProps<{
  i18n: Record<string, any>
  plugin: any
  manager: GitPushManager
}>()

const {
  projects,
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
  pushToBoth,
  pushSingle,
  checkIsGitRepo,
} = useGitPush(props.manager)

const showAddDialog = ref(false)
const newProjectName = ref("")
const newProjectPath = ref("")
const addError = ref("")
const addChecking = ref(false)
const addResult = ref<boolean | null>(null)
const refreshing = ref<string | null>(null)
/** 提交输出 id → text */
const commitOutputs = ref<Record<string, string>>({})
/** AI 生成状态 id → { generating, text } */
const generatingMsgs = ref<Record<string, { generating: boolean; text: string }>>({})

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
    await addProject(newProjectName.value.trim(), newProjectPath.value.trim())
    showAddDialog.value = false
    newProjectName.value = ""
    newProjectPath.value = ""
    addResult.value = null
  } catch (e: any) {
    addError.value = e?.message || "添加失败"
  } finally {
    addChecking.value = false
  }
}

async function handlePushBoth(id: string) {
  await pushToBoth(id)
}

async function handlePushSingle(id: string, target: "github" | "gitee") {
  await pushSingle(id, target)
}

async function handleRefresh(id: string) {
  refreshing.value = id
  try {
    await refreshRemotes(id)
    // 刷新后重新检测推送状态
    await loadPushStatus(id)
    // 同时刷新工作区状态
    await loadWorkingTree(id)
  } finally {
    refreshing.value = null
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

async function handleStageFile(id: string, file: string) {
  try {
    await stageItem(id, file)
  } catch (e: any) {
    commitOutputs.value[id] = `暂存失败: ${e?.message || e}`
  }
}

async function handleUnstageFile(id: string, file: string) {
  try {
    await unstageItem(id, file)
  } catch (e: any) {
    commitOutputs.value[id] = `取消暂存失败: ${e?.message || e}`
  }
}

async function handleStageAll(id: string) {
  try {
    await stageAllItems(id)
  } catch (e: any) {
    commitOutputs.value[id] = `暂存失败: ${e?.message || e}`
  }
}

async function handleUnstageAll(id: string) {
  try {
    await unstageAllItems(id)
  } catch (e: any) {
    commitOutputs.value[id] = `取消暂存失败: ${e?.message || e}`
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
  // 设置生成中状态
  generatingMsgs.value = { ...generatingMsgs.value, [id]: { generating: true, text: "" } }
  commitOutputs.value[id] = ""
  try {
    const msg = await generateCommitMsg(id)
    // 通过 prop 传递给 WorkingTreePanel，由 watch 自动填入文本框
    generatingMsgs.value = { ...generatingMsgs.value, [id]: { generating: false, text: msg } }
  } catch (e: any) {
    commitOutputs.value[id] = `AI 生成失败: ${e?.message || e}，可手动输入`
    generatingMsgs.value = { ...generatingMsgs.value, [id]: { generating: false, text: "" } }
  }
}

async function handleLoadDiff(id: string, file: string, staged: boolean) {
  await loadFileDiff(id, file, staged)
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
  font-family: "JetBrains Mono", "Fira Code", "Consolas", monospace;
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
  font-family: "JetBrains Mono", "Fira Code", "Consolas", monospace;
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
    font-family: "JetBrains Mono", "Fira Code", "Consolas", monospace;
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
  font-family: "JetBrains Mono", "Fira Code", "Consolas", monospace;
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
