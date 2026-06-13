<template>
  <div class="data-backup-settings">
    <div class="data-backup-header">
      <span class="data-backup-header-title">{{ i18n.dataBackup || '数据备份' }}</span>
      <button class="data-backup-close-btn" @click="handleClose">×</button>
    </div>

    <div class="settings-container">
      <!-- 移动端警告 -->
      <div v-if="isMobile" class="mobile-warning">
        <span class="warning-text">{{ i18n.mobileBackupDisabled || '检测到移动端环境，备份功能已自动禁用以节省流量和存储空间' }}</span>
      </div>

      <!-- 1. 工作区信息 -->
      <section class="card-section info-section">
        <div class="section-header">
          <h4>{{ i18n.workspaceInfo || '工作区信息' }}</h4>
        </div>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">{{ i18n.workspacePath || '工作区路径' }}</span>
            <div class="workspace-path-row">
              <span class="info-value workspace-path">{{ workspacePath || i18n.notSet || '未设置' }}</span>
              <div class="path-actions">
                <button class="select-path-btn" @click="selectWorkspacePath">
                  {{ i18n.selectPath || '选择路径' }}
                </button>
                <button
                  class="open-folder-btn"
                  :disabled="!workspaceRoot"
                  :title="i18n.openInExplorer || '在文件管理器中打开'"
                  @click="openWorkspaceFolder"
                >打开</button>
              </div>
            </div>
          </div>
          <div class="info-item">
            <span class="info-label">{{ i18n.lastBackup || '上次备份' }}</span>
            <span class="info-value">{{ lastBackupTime || i18n.never || '从未' }}</span>
          </div>
        </div>
      </section>

      <!-- 2. 备份进度（条件渲染） -->
      <section v-if="isBackingUp" class="card-section progress-section">
        <div class="section-header">
          <h4>备份进度</h4>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar" :style="{ width: `${backupProgress.percent}%` }" />
        </div>
        <div class="progress-info">
          <span class="progress-phase">{{ phaseLabel }}</span>
          <span class="progress-percent">{{ backupProgress.percent }}%</span>
        </div>
        <div v-if="backupProgress.currentFile" class="progress-current-file">
          {{ backupProgress.currentFile }}
        </div>
      </section>

      <!-- 3. 手动备份 -->
      <section class="card-section backup-section">
        <div class="section-header">
          <h4>{{ i18n.manualBackup || '手动备份' }}</h4>
        </div>
        <div class="backup-actions-row">
          <button
            class="vp-btn vp-btn--primary vp-btn--sm"
            :disabled="isBackingUp || isBackupAll"
            @click="performFullBackup"
          >
            <span v-if="isBackingUp" class="vp-spin" />
            <span>全量备份</span>
          </button>
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm"
            :disabled="isBackingUp || isPluginBackup || isBackupAll"
            @click="exportPluginSettings"
          >
            <span v-if="isPluginBackup" class="vp-spin" />
            <span>{{ i18n.pluginSettingsBackup || '插件设置备份' }}</span>
          </button>
          <button
            class="vp-btn vp-btn--primary vp-btn--sm"
            :disabled="isBackingUp || isBackupAll"
            @click="performBackupAll"
          >
            <span v-if="isBackupAll" class="vp-spin" />
            <span>备份所有</span>
          </button>
        </div>
        <p v-if="pluginExportPath" class="export-path" :title="pluginExportPath">
          <span class="export-path-label">备份路径：</span>
          <span class="export-path-value">{{ pluginExportPath }}</span>
        </p>
        <p class="backup-hint">
          全量备份包含工作区所有文件；插件设置备份仅打包插件配置，可用于跨设备迁移
        </p>
      </section>

      <!-- 4. 自动备份设置 -->
      <section class="card-section auto-backup-section">
        <div class="section-header">
          <h4>{{ i18n.autoBackupSettings || '自动备份设置' }}</h4>
        </div>
        <div class="settings-row">
          <span class="inline-label">{{ i18n.autoBackup || '自动备份' }}</span>
          <select v-model="autoBackupEnabled" class="form-select narrow" @change="saveSettings">
            <option :value="false">{{ i18n.disabled || '禁用' }}</option>
            <option :value="true">{{ i18n.enabled || '启用' }}</option>
          </select>
          <template v-if="autoBackupEnabled">
            <span class="inline-label">{{ i18n.backupFrequency || '频率' }}</span>
            <select v-model="backupFrequency" class="form-select narrow" @change="saveSettings">
              <option value="minute">{{ i18n.everyMinute || '每分钟' }}</option>
              <option value="hourly">{{ i18n.everyHour || '每小时' }}</option>
              <option value="daily">{{ i18n.everyDay || '每天' }}</option>
            </select>
            <template v-if="backupFrequency === 'daily'">
              <span class="inline-label">{{ i18n.backupTime || '时间' }}</span>
              <input v-model="backupTime" type="time" class="form-input narrow" @change="saveSettings" />
            </template>
            <span class="inline-label">保留</span>
            <input
              v-model="keepBackupCount" type="number" class="form-input narrow" style="width: 3rem;"
              min="1" max="30" @change="saveSettings"
            />
            <span class="inline-label">份</span>
            <span class="inline-label">含插件</span>
            <select v-model="autoBackupPluginData" class="form-select narrow" @change="saveSettings">
              <option :value="false">否</option>
              <option :value="true">是</option>
            </select>
          </template>
        </div>
      </section>

      <!-- 5. 本地备份历史 -->
      <section class="card-section history-section">
        <div class="section-header">
          <h4>{{ i18n.backupHistory || '备份历史' }}</h4>
          <button class="refresh-btn" :disabled="isLoading" @click="refreshBackupList">
            {{ i18n.refresh || '刷新' }}
          </button>
        </div>
        <div v-if="backupList.length > 0" class="backup-list">
          <div v-for="(backup, index) in backupList" :key="index" class="backup-item">
            <div class="backup-info">
              <span class="backup-name">{{ backup.name }}</span>
              <span class="backup-time">{{ backup.time }}</span>
              <span class="backup-size">{{ formatFileSize(backup.size) }}</span>
            </div>
            <div class="backup-actions">
              <button class="action-btn delete" @click="deleteBackup(backup)">
                {{ i18n.delete || '删除' }}
              </button>
            </div>
          </div>
        </div>
        <div v-else class="empty-state">
          <p>{{ i18n.noBackups || '暂无备份记录' }}</p>
        </div>
      </section>
    </div>

    <!-- 自定义输入对话框 -->
    <div v-if="showInputDialog" class="input-dialog-overlay" @click.self="cancelInputDialog">
      <div class="input-dialog">
        <div class="input-dialog-header">
          <h4>{{ i18n.enterWorkspacePath || '请输入思源工作区路径' }}</h4>
        </div>
        <div class="input-dialog-body">
          <input
            ref="dialogInputRef" v-model="inputDialogValue" type="text"
            class="input-dialog-field" :placeholder="inputDialogPlaceholder"
            @keyup.enter="confirmInputDialog" @keyup.esc="cancelInputDialog"
          />
        </div>
        <div class="input-dialog-footer">
          <button class="input-dialog-btn cancel" @click="cancelInputDialog">
            {{ i18n.cancel || '取消' }}
          </button>
          <button class="input-dialog-btn confirm" @click="confirmInputDialog">
            {{ i18n.confirm || '确定' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { BackupProgress, BackupResult } from "./modules/BackupManager"
import { showMessage } from "siyuan"
import { getWorkspaceDir } from "@/api"
import { getNodeModules } from "@/utils/nodeModules"
import { formatFileSize } from "@/utils/format"
import { backupPluginData } from "@/utils/settingsBackup"
import { useStatusBarTask } from "../statusBar/composables/useStatusBarTask"
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue"
import { BackupManager } from "./modules/BackupManager"
import { DataBackupStorage } from "./types"
import { checkIsMobile } from "../generalSettings/utils/styles"

// ========== Props ==========

interface Props {
  i18n?: any
  plugin?: any
  onClose?: () => void
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
  plugin: null,
  onClose: () => {},
})

// ========== 存储实例（一次性初始化） ==========

let dbStorage: DataBackupStorage | null = null

// ========== 基础状态 ==========

const workspacePath = ref("")
const workspaceRoot = ref("")
const isBackingUp = ref(false)
const isBackupAll = ref(false)
const isLoading = ref(false)
const lastBackupTime = ref("")
const autoBackupEnabled = ref(false)
const isMobile = ref(false)
const backupFrequency = ref("daily")
const backupTime = ref("03:00")
const keepBackupCount = ref(7)
const autoBackupPluginData = ref(false)
const isPluginBackup = ref(false)
const pluginExportPath = ref("")
const backupList = ref<
  Array<{ name: string, path: string, time: string, size: number }>
>([])

let lastBackupTimestamp = 0

const backupTask = useStatusBarTask("dataBackup", "ph:archive")

// ========== 备份进度 ==========

const backupProgress = ref<BackupProgress>({
  phase: "scanning",
  currentFile: "",
  filesProcessed: 0,
  totalFiles: 0,
  percent: 0,
})

const phaseLabel = computed(() => {
  const labels: Record<string, string> = {
    scanning: "扫描文件",
    packing: "打包文件",
    compressing: "压缩数据",
    saving: "保存备份",
    uploading: "上传云端",
  }
  return labels[backupProgress.value.phase] || backupProgress.value.phase
})

// ========== Manager 实例 ==========

let backupManager: BackupManager | null = null

function initManagers() {
  backupManager = new BackupManager(workspacePath.value, workspaceRoot.value)
}

// ========== 工作区路径管理 ==========

function updateWorkspacePath(root: string, shouldSave = false) {
  workspaceRoot.value = root
  workspacePath.value = `${root}/data`
  localStorage.setItem("siyuan-workspace-root", root)
  localStorage.setItem("siyuan-workspace-path", `${root}/data`)
  if (backupManager) {
    backupManager.updateWorkspacePaths(workspacePath.value, workspaceRoot.value)
  }
  if (shouldSave) {
    saveSettings()
  }
}

async function fetchWorkspacePath(): Promise<string | null> {
  try {
    const dir = await getWorkspaceDir()
    return dir || null
  } catch (e) {
    console.error("通过 API 获取工作区路径失败:", e)
  }
  return null
}

// ========== 初始化 ==========

onMounted(async () => {
  isMobile.value = checkIsMobile()

  // 一次性初始化存储实例
  if (props.plugin) {
    dbStorage = new DataBackupStorage(props.plugin)
  }

  await loadSettings()

  if (isMobile.value && autoBackupEnabled.value) {
    autoBackupEnabled.value = false
    await saveSettings()
  }

  await detectWorkspacePath()
  initManagers()
  await loadBackupList()

  window.addEventListener("autoBackupTrigger", handleAutoBackupTrigger)
})

onUnmounted(() => {
  window.removeEventListener("autoBackupTrigger", handleAutoBackupTrigger)
  window.removeEventListener("workspacePathDetected", handleWorkspacePathDetected)
})

async function handleAutoBackupTrigger() {
  await performFullBackup()
  if (autoBackupPluginData.value) {
    await exportPluginSettings()
  }
}

// ========== 定时器重启（合并 watch） ==========

function handleTimerRestart() {
  const dataBackup = props.plugin?.__dataBackup
  if (dataBackup && typeof dataBackup.restartAutoBackupTimer === "function") {
    dataBackup.restartAutoBackupTimer(autoBackupEnabled.value, backupFrequency.value, backupTime.value)
  }
}

watch(
  [backupFrequency, backupTime, autoBackupEnabled],
  () => handleTimerRestart(),
)

// ========== 设置持久化 ==========

async function loadSettings() {
  try {
    if (dbStorage) {
      const data = await dbStorage.backup.loadOrDefault()
      autoBackupEnabled.value = data.autoBackupEnabled ?? false
      backupFrequency.value = data.backupFrequency ?? "daily"
      backupTime.value = data.backupTime ?? "03:00"
      keepBackupCount.value = data.keepBackupCount ?? 7
      autoBackupPluginData.value = data.autoBackupPluginData ?? false
      lastBackupTime.value = data.lastBackupTime ?? ""
      lastBackupTimestamp = data.lastBackupTimestamp ?? 0
      if (data.workspacePath) {
        workspacePath.value = data.workspacePath
        workspaceRoot.value = data.workspaceRoot || data.workspacePath.replace(/\/data$/, "")
      }
    }
  } catch (error) {
    console.error("加载备份设置失败:", error)
  }
}

async function saveSettings() {
  try {
    if (dbStorage) {
      await dbStorage.backup.save({
        autoBackupEnabled: autoBackupEnabled.value,
        backupFrequency: backupFrequency.value,
        backupTime: backupTime.value,
        keepBackupCount: keepBackupCount.value,
        autoBackupPluginData: autoBackupPluginData.value,
        lastBackupTime: lastBackupTime.value,
        lastBackupTimestamp,
        workspacePath: workspacePath.value,
        workspaceRoot: workspaceRoot.value,
      })
    }
  } catch (error) {
    console.error("保存备份设置失败:", error)
  }
}

// ========== 工作区检测 ==========

async function detectWorkspacePath() {
  const envRoot = (window as any).__SIYUAN_WORKSPACE__ || (window as any).SIYUAN_WORKSPACE
  if (envRoot) {
    updateWorkspacePath(envRoot)
    return
  }

  const savedRoot = localStorage.getItem("siyuan-workspace-root")
  if (savedRoot) {
    updateWorkspacePath(savedRoot)
    return
  }

  try {
    if (props.plugin?.dataPath) {
      updateWorkspacePath(props.plugin.dataPath)
      return
    }
  } catch {
    /* 忽略错误 */
  }

  const apiPath = await fetchWorkspacePath()
  if (apiPath) {
    updateWorkspacePath(apiPath)
    return
  }

  window.addEventListener("workspacePathDetected", handleWorkspacePathDetected)
}

function handleWorkspacePathDetected(event: CustomEvent) {
  updateWorkspacePath(event.detail.path)
}

// ========== 输入对话框 ==========

const showInputDialog = ref(false)
const inputDialogValue = ref("")
const inputDialogPlaceholder = ref("")
const inputDialogResolve = ref<((value: string | null) => void) | null>(null)
const dialogInputRef = ref<HTMLInputElement | null>(null)

function showInputDialogHelper(placeholder: string): Promise<string | null> {
  return new Promise((resolve) => {
    inputDialogPlaceholder.value = placeholder
    inputDialogValue.value = workspaceRoot.value || ""
    inputDialogResolve.value = resolve
    showInputDialog.value = true
    nextTick(() => {
      dialogInputRef.value?.focus()
      dialogInputRef.value?.select()
    })
  })
}

function confirmInputDialog() {
  const value = inputDialogValue.value.trim()
  showInputDialog.value = false
  inputDialogResolve.value?.(value || null)
  inputDialogResolve.value = null
}

function cancelInputDialog() {
  showInputDialog.value = false
  inputDialogResolve.value?.(null)
  inputDialogResolve.value = null
}

// ========== 文件夹操作 ==========

async function openWorkspaceFolder() {
  if (!workspaceRoot.value) {
    showMessage(props.i18n.pleaseSelectWorkspace || "请先选择工作区路径", 3000, "info")
    return
  }
  try {
    const node = getNodeModules()
    if (node) {
      // Electron 环境：使用 shell.openPath
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { shell } = require("electron")
        if (shell?.openPath) {
          await shell.openPath(workspaceRoot.value)
          return
        }
      } catch {
        // Electron shell 不可用
      }
    }
    // 降级：通过 API 告知用户
    showMessage(props.i18n.workspacePathIs || `工作区路径: ${workspaceRoot.value}`, 3000, "info")
  } catch (error) {
    console.error("打开工作区文件夹失败:", error)
    showMessage(props.i18n.openFolderFailed || "打开文件夹失败", 3000, "error")
  }
}

async function selectWorkspacePath() {
  if (!workspaceRoot.value) {
    const wsPath = await fetchWorkspacePath()
    if (wsPath) {
      updateWorkspacePath(wsPath, true)
      showMessage(props.i18n.workspacePathSet || "工作区路径已自动获取", 2000, "info")
      return
    }
  }
  // 尝试 Electron 文件夹选择器
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { dialog } = require("electron")
    if (dialog?.showOpenDialog) {
      const result = await dialog.showOpenDialog({
        properties: ["openDirectory"],
        title: props.i18n.selectWorkspace || "选择思源工作区",
        defaultPath: workspaceRoot.value || undefined,
      })
      if (!result.canceled && result.filePaths[0]) {
        updateWorkspacePath(result.filePaths[0], true)
        showMessage(props.i18n.workspacePathSet || "工作区路径已设置", 2000, "info")
        return
      }
    }
  } catch {
    /* Electron dialog 不可用 */
  }
  // 降级到手动输入
  const inputPath = await showInputDialogHelper(props.i18n.enterWorkspacePath || "请输入思源工作区路径:")
  if (inputPath) {
    updateWorkspacePath(inputPath, true)
    showMessage(props.i18n.workspacePathSet || "工作区路径已设置", 2000, "info")
  }
}

// ========== 备份操作 ==========

async function performFullBackup() {
  if (isBackingUp.value || !backupManager) return

  if (!workspacePath.value) {
    showMessage(props.i18n.pleaseSelectWorkspace || "请先选择工作区路径", 3000, "info")
    await selectWorkspacePath()
    if (!workspacePath.value) return
  }

  isBackingUp.value = true
  backupProgress.value = {
    phase: "scanning",
    currentFile: "",
    filesProcessed: 0,
    totalFiles: 0,
    percent: 0,
  }

  try {
    const result = await backupManager.performFullBackup({
      onProgress: (p) => {
        backupProgress.value = { ...p }
        backupTask.progress({ label: "备份中", percent: p.percent, phase: p.phase })
      },
    })

    await onBackupComplete(result)
  } catch (error: any) {
    console.error("备份失败:", error)
    showMessage(`${props.i18n.backupFailed || "备份失败"}: ${error.message}`, 5000, "error")
  } finally {
    isBackingUp.value = false
  }
}

async function onBackupComplete(result: BackupResult) {
  lastBackupTime.value = new Date().toLocaleString()
  lastBackupTimestamp = Date.now()
  await saveSettings()

  props.plugin?.__dataBackup?.updateLastBackupTime?.(lastBackupTimestamp)

  backupList.value.unshift({
    name: result.fileName,
    path: result.filePath,
    time: lastBackupTime.value,
    size: result.size,
  })

  if (backupList.value.length > keepBackupCount.value) {
    backupList.value = backupList.value.slice(0, keepBackupCount.value)
  }

  await dbStorage?.backupHistory.save({ list: backupList.value })

  showMessage(`备份成功: ${result.fileName}（${result.totalFiles} 文件）`, 3000, "info")
  backupTask.complete("备份完成", `${result.fileName} · ${result.totalFiles} 文件`)
}

// ========== 本地备份管理 ==========

async function loadBackupList() {
  backupList.value = []
  try {
    if (backupManager) {
      const scanned = await backupManager.scanBackupDir()
      if (scanned.length > 0) {
        backupList.value = scanned
        await dbStorage?.backupHistory.save({ list: backupList.value })
        return
      }
    }
    const backupHistory = await dbStorage?.backupHistory.load()
    if (backupHistory?.list) {
      backupList.value = backupHistory.list
    }
  } catch (error) {
    console.error("加载备份列表失败:", error)
  }
}

async function refreshBackupList() {
  isLoading.value = true
  try {
    await loadBackupList()
  } finally {
    isLoading.value = false
  }
}

async function deleteBackup(backup: { name: string, path: string }) {
  try {
    const confirmDelete = confirm(props.i18n.confirmDelete || "确定要删除此备份吗？")
    if (!confirmDelete) return
    if (backupManager) {
      await backupManager.deleteBackupFile(backup.path)
    }
    backupList.value = backupList.value.filter((b) => b.name !== backup.name)
    await dbStorage?.backupHistory.save({ list: backupList.value })
    showMessage(props.i18n.deleteSuccess || "删除成功", 2000, "info")
  } catch (error) {
    console.error("删除备份失败:", error)
    showMessage(props.i18n.deleteFailed || "删除失败", 3000, "error")
  }
}

// ========== 插件设置导出 ==========

async function exportPluginSettings() {
  if (!props.plugin || isPluginBackup.value || !workspaceRoot.value) return
  isPluginBackup.value = true
  try {
    const result = await backupPluginData(props.plugin, workspaceRoot.value)
    pluginExportPath.value = result.filePath
    showMessage(`${props.i18n.exportSuccess || "备份成功"}: ${result.filePath}`, 5000, "info")
  } catch (error: any) {
    console.error("导出设置失败:", error)
    showMessage(`${props.i18n.exportFailed || "导出失败"}: ${error.message}`, 5000, "error")
  } finally {
    isPluginBackup.value = false
  }
}

async function performBackupAll() {
  if (isBackupAll.value || isBackingUp.value) return
  isBackupAll.value = true
  try {
    await performFullBackup()
    await exportPluginSettings()
    showMessage("全量备份 + 插件设置备份已完成", 3000, "info")
  } catch (error: any) {
    console.error("备份所有失败:", error)
    showMessage(`备份所有失败: ${error.message}`, 5000, "error")
  } finally {
    isBackupAll.value = false
  }
}

function handleClose() {
  if (isBackingUp.value) {
    if (!confirm("正在备份中，关闭窗口不会中断备份。确定要隐藏窗口吗？")) return
  }
  props.onClose?.()
}

defineExpose({
  loadSettings,
  saveSettings,
  performFullBackup,
  refreshBackupList,
})
</script>

<style scoped lang="scss">
@use './styles/index.scss';
</style>
