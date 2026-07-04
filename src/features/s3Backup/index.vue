<template>
  <div class="s3-backup-panel">
    <!-- 头部 -->
    <div class="s3-backup-header">
      <span class="s3-backup-header-title">{{ i18n.s3Backup || "S3 备份" }}</span>
      <button
        class="s3-backup-close-btn"
        @click="handleClose"
      >
        ×
      </button>
    </div>

    <div class="settings-container">
      <!-- 1. 工作区信息 -->
      <section class="card-section info-section">
        <div class="section-header">
          <h4>{{ i18n.workspaceInfo || "工作区信息" }}</h4>
        </div>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">{{ i18n.workspacePath || "工作区路径" }}</span>
            <div class="workspace-path-row">
              <span class="info-value workspace-path">{{ workspacePath || (i18n.notSet || "未设置") }}</span>
              <div class="path-actions">
                <button
                  class="select-path-btn"
                  @click="selectWorkspacePath"
                >
                  {{ i18n.selectPath || "选择路径" }}
                </button>
                <button
                  class="open-folder-btn"
                  :disabled="!workspaceRoot"
                  @click="openWorkspaceFolder"
                >打开</button>
              </div>
            </div>
          </div>
          <div class="info-item">
            <span class="info-label">{{ i18n.lastBackup || "上次备份" }}</span>
            <span class="info-value">{{ lastBackupTime || (i18n.never || "从未") }}</span>
          </div>
        </div>
      </section>

      <!-- 2. S3 配置 -->
      <section class="card-section config-section">
        <S3ConfigForm
          :config="s3ConfigLocal"
          :i18n="i18n"
          :on-test-connection="handleTestConnection"
          @config-changed="handleConfigChanged"
          @saved="handleConfigSaved"
        />
      </section>

      <!-- 3. 备份进度 -->
      <section
        v-if="isBackingUp"
        class="card-section progress-section"
      >
        <div class="section-header">
          <h4>{{ i18n.backupProgress || "备份进度" }}</h4>
        </div>
        <div class="progress-bar-container">
          <div
            class="progress-bar"
            :style="{ width: `${backupProgress.percent}%` }"
          />
        </div>
        <div class="progress-info">
          <span class="progress-phase">{{ phaseLabel }}</span>
          <span class="progress-percent">{{ backupProgress.percent }}%</span>
        </div>
        <div
          v-if="backupProgress.currentFile"
          class="progress-current-file"
        >
          {{ backupProgress.currentFile }}
        </div>
      </section>

      <!-- 4. 手动备份 -->
      <section class="card-section backup-section">
        <div class="section-header">
          <h4>{{ i18n.manualBackup || "手动备份" }}</h4>
        </div>
        <div class="backup-actions-row">
          <button
            class="vp-btn vp-btn--primary vp-btn--sm"
            :disabled="isBackingUp || !isConfigured || !workspacePath"
            @click="performManualBackup"
          >
            <span
              v-if="isBackingUp"
              class="vp-spin"
            />
            <span>{{ i18n.backupNow || "立即备份" }}</span>
          </button>
        </div>
        <p class="backup-hint">
          {{ i18n.backupHint || "备份将打包为 zip 后上传到 S3" }}
        </p>
      </section>

      <!-- 5. 自动备份设置 -->
      <section class="card-section auto-backup-section">
        <div class="section-header">
          <h4>{{ i18n.autoBackup || "自动备份" }}</h4>
        </div>
        <div class="settings-row">
          <span class="inline-label">{{ i18n.autoBackup || "自动备份" }}</span>
          <select
            v-model="autoBackupEnabled"
            class="form-select narrow"
            @change="saveAutoBackupSettings"
          >
            <option :value="false">
              {{ i18n.disabled || "禁用" }}
            </option>
            <option :value="true">
              {{ i18n.enabled || "启用" }}
            </option>
          </select>
          <template v-if="autoBackupEnabled">
            <span class="inline-label">{{ i18n.backupFrequency || "频率" }}</span>
            <select
              v-model="backupFrequency"
              class="form-select narrow"
              @change="saveAutoBackupSettings"
            >
              <option value="minute">
                {{ i18n.everyMinute || "每分钟" }}
              </option>
              <option value="hourly">
                {{ i18n.everyHour || "每小时" }}
              </option>
              <option value="daily">
                {{ i18n.everyDay || "每天" }}
              </option>
            </select>
            <template v-if="backupFrequency === 'daily'">
              <span class="inline-label">{{ i18n.backupTime || "时间" }}</span>
              <input
                v-model="backupTime"
                type="time"
                class="form-input narrow"
                @change="saveAutoBackupSettings"
              />
            </template>
            <span class="inline-label">{{ i18n.keepBackups || "保留" }}</span>
            <input
              v-model="keepBackupCount"
              type="number"
              class="form-input narrow"
              style="width: 3rem;"
              min="1"
              max="30"
              @change="saveAutoBackupSettings"
            />
            <span class="inline-label">份</span>
          </template>
        </div>
      </section>

      <!-- 6. S3 备份列表 -->
      <section class="card-section history-section">
        <div class="section-header">
          <h4>{{ i18n.s3Backups || "云端备份列表" }}</h4>
          <button
            class="refresh-btn"
            :disabled="isLoading || !isConfigured"
            @click="refreshBackupList"
          >
            {{ i18n.refresh || "刷新" }}
          </button>
        </div>
        <div
          v-if="backupList.length > 0"
          class="backup-list"
        >
          <div
            v-for="(backup, index) in backupList"
            :key="index"
            class="backup-item"
          >
            <div class="backup-info">
              <span class="backup-name">{{ backup.name }}</span>
              <span class="backup-time">{{ backup.lastModified }}</span>
              <span class="backup-size">{{ formatFileSize(backup.size) }}</span>
            </div>
            <div class="backup-actions">
              <button
                class="action-btn download"
                @click="handleDownload(backup)"
              >
                {{ i18n.download || "下载" }}
              </button>
              <button
                class="action-btn restore"
                @click="handleRestore(backup)"
              >
                {{ i18n.restore || "恢复" }}
              </button>
              <button
                class="action-btn delete"
                @click="handleDelete(backup)"
              >
                {{ i18n.delete || "删除" }}
              </button>
            </div>
          </div>
        </div>
        <div
          v-else
          class="empty-state"
        >
          <p>{{ i18n.noBackups || "暂无云端备份" }}</p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue"
import { showMessage } from "siyuan"
import { getWorkspaceDir } from "@/api"
import { formatFileSize } from "@/utils/format"
import { getNodeModules } from "@/utils/nodeModules"
import { checkIsMobile } from "../generalSettings/utils/styles"
import { useS3Backup } from "./composables/useS3Backup"
import { BackupManager } from "./modules/BackupManager"
import { S3BackupStorage } from "./types"
import type { S3Config, S3FileInfo } from "./types"
import S3ConfigForm from "./components/S3ConfigForm.vue"

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

// ========== Composable ==========

const {
  s3Config,
  isConfigured,
  isConnected,
  isConnecting,
  isBackingUp,
  isLoading,
  backupProgress,
  backupList,
  error,
  phaseLabel,
  testConnection,
  saveConfig,
  performBackup: uploadToS3,
  listBackups,
  downloadBackup,
  deleteBackup,
  loadConfig,
} = useS3Backup()

// ========== 存储实例 ==========

let dbStorage: S3BackupStorage | null = null

// ========== 基础状态 ==========

const workspacePath = ref("")
const workspaceRoot = ref("")
const lastBackupTime = ref("")
const autoBackupEnabled = ref(false)
const backupFrequency = ref("daily")
const backupTime = ref("03:00")
const keepBackupCount = ref(7)
const s3ConfigLocal = ref<S3Config | null>(null)

let lastBackupTimestamp = 0
let backupManager: BackupManager | null = null

// ========== 计算 ==========

function initManagers(): void {
  if (workspacePath.value) {
    backupManager = new BackupManager(workspacePath.value, workspaceRoot.value)
  }
}

// ========== 工作区路径管理 ==========

function updateWorkspacePath(root: string, shouldSave = false): void {
  workspaceRoot.value = root
  workspacePath.value = `${root}/data`
  localStorage.setItem("siyuan-workspace-root-s3", root)
  localStorage.setItem("siyuan-workspace-path-s3", `${root}/data`)
  if (backupManager) {
    backupManager.updateWorkspacePaths(workspacePath.value, workspaceRoot.value)
  }
  if (shouldSave) {
    saveAutoBackupSettings()
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

async function detectWorkspacePath(): Promise<void> {
  const envRoot = (window as any).__SIYUAN_WORKSPACE__ || (window as any).SIYUAN_WORKSPACE
  if (envRoot) {
    updateWorkspacePath(envRoot)
    return
  }

  const savedRoot = localStorage.getItem("siyuan-workspace-root-s3")
  if (savedRoot) {
    updateWorkspacePath(savedRoot)
    return
  }

  try {
    if (props.plugin?.dataPath) {
      updateWorkspacePath(props.plugin.dataPath)
      return
    }
  } catch { /* ignore */ }

  const apiPath = await fetchWorkspacePath()
  if (apiPath) {
    updateWorkspacePath(apiPath)
    return
  }
}

// ========== S3 配置管理 ==========

function handleTestConnection(config: S3Config): Promise<{ success: boolean; message: string }> {
  return testConnection(config)
}

function handleConfigChanged(config: S3Config): void {
  s3ConfigLocal.value = config
}

async function handleConfigSaved(): Promise<void> {
  if (!s3ConfigLocal.value) return
  saveConfig(s3ConfigLocal.value)

  // 持久化配置
  if (dbStorage) {
    await dbStorage.s3Config.save(s3ConfigLocal.value)
  }
  showMessage(props.i18n.configSaved || "配置已保存", 2000, "info")
}

// ========== 备份操作 ==========

async function performManualBackup(): Promise<void> {
  if (isBackingUp.value || !backupManager) return

  if (!workspacePath.value) {
    showMessage(props.i18n.noWorkspace || "请先选择工作区路径", 3000, "info")
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
    // 阶段 1-4: 本地备份打包
    const result = await backupManager.performFullBackup({
      onProgress: (p) => {
        backupProgress.value = { ...p }
      },
    })

    // 阶段 5: 上传到 S3
    const prefix = s3Config.value.prefix || "siyuan-backup/"
    const s3Key = `${prefix}${result.fileName}`

    backupProgress.value = {
      phase: "uploading",
      currentFile: result.fileName,
      filesProcessed: result.totalFiles,
      totalFiles: result.totalFiles,
      percent: 80,
    }

    await uploadToS3(result.filePath, s3Key, (percent) => {
      backupProgress.value = {
        ...backupProgress.value,
        percent: 80 + Math.round(percent * 0.2),
      }
    })

    // 更新备份记录
    lastBackupTime.value = new Date().toLocaleString()
    lastBackupTimestamp = Date.now()
    await saveAutoBackupSettings()

    showMessage(`${props.i18n.backupSuccess || "备份上传成功"}: ${result.fileName}`, 3000, "info")

    // 刷新列表
    await refreshBackupList()
  } catch (err: any) {
    console.error("备份失败:", err)
    showMessage(`${props.i18n.backupFailed || "备份失败"}: ${err.message}`, 5000, "error")
  } finally {
    isBackingUp.value = false
  }
}

// ========== S3 备份管理 ==========

async function refreshBackupList(): Promise<void> {
  if (!isConfigured.value) return
  try {
    await listBackups()
  } catch (err: any) {
    console.error("刷新备份列表失败:", err)
  }
}

async function handleDownload(backup: S3FileInfo): Promise<void> {
  try {
    const { fs, path } = (() => {
      const node = getNodeModules()
      return { fs: node!.fs.promises, path: node!.path }
    })()

    const downloadDir = `${workspaceRoot.value}/data-backup`
    await fs.mkdir(downloadDir, { recursive: true })
    const localPath = path.join(downloadDir, backup.name)

    await downloadBackup(backup.key, localPath)
    showMessage(props.i18n.downloadSuccess || "下载成功", 2000, "info")
  } catch (err: any) {
    showMessage(`${props.i18n.downloadFailed || "下载失败"}: ${err.message}`, 5000, "error")
  }
}

async function handleRestore(backup: S3FileInfo): Promise<void> {
  const confirmed = confirm(props.i18n.confirmRestore || "确定要恢复此备份吗？当前数据将被覆盖。")
  if (!confirmed) return

  try {
    const { fs, path } = (() => {
      const node = getNodeModules()
      return { fs: node!.fs.promises, path: node!.path }
    })()

    const downloadDir = `${workspaceRoot.value}/data-backup`
    await fs.mkdir(downloadDir, { recursive: true })
    const localPath = path.join(downloadDir, backup.name)

    await downloadBackup(backup.key, localPath)
    showMessage(props.i18n.restoreSuccess || "恢复完成，备份已下载到本地备份目录", 3000, "info")
  } catch (err: any) {
    showMessage(`${props.i18n.restoreFailed || "恢复失败"}: ${err.message}`, 5000, "error")
  }
}

async function handleDelete(backup: S3FileInfo): Promise<void> {
  const confirmed = confirm(props.i18n.confirmDelete || "确定要删除此备份吗？")
  if (!confirmed) return

  try {
    await deleteBackup(backup.key)
    showMessage(props.i18n.deleteSuccess || "删除成功", 2000, "info")
  } catch (err: any) {
    showMessage(`${props.i18n.deleteFailed || "删除失败"}: ${err.message}`, 5000, "error")
  }
}

// ========== 自动备份设置 ==========

async function loadAutoBackupSettings(): Promise<void> {
  try {
    if (dbStorage) {
      const data = await dbStorage.backupSettings.loadOrDefault()
      autoBackupEnabled.value = data.autoBackupEnabled ?? false
      backupFrequency.value = data.backupFrequency ?? "daily"
      backupTime.value = data.backupTime ?? "03:00"
      keepBackupCount.value = data.keepBackupCount ?? 7
      lastBackupTime.value = data.lastBackupTime ?? ""
      lastBackupTimestamp = data.lastBackupTimestamp ?? 0
      if (data.workspacePath) {
        workspacePath.value = data.workspacePath
        workspaceRoot.value = data.workspaceRoot || data.workspacePath.replace(/\/data$/, "")
      }
    }
  } catch (err) {
    console.error("加载自动备份设置失败:", err)
  }
}

async function saveAutoBackupSettings(): Promise<void> {
  try {
    if (dbStorage) {
      await dbStorage.backupSettings.save({
        autoBackupEnabled: autoBackupEnabled.value,
        backupFrequency: backupFrequency.value,
        backupTime: backupTime.value,
        keepBackupCount: keepBackupCount.value,
        lastBackupTimestamp,
        lastBackupTime: lastBackupTime.value,
        workspacePath: workspacePath.value,
        workspaceRoot: workspaceRoot.value,
      })
    }
  } catch (err) {
    console.error("保存自动备份设置失败:", err)
  }
}

// ========== 文件夹操作 ==========

async function openWorkspaceFolder(): Promise<void> {
  if (!workspaceRoot.value) return
  try {
    const node = getNodeModules()
    if (node) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { shell } = require("electron")
        if (shell?.openPath) {
          await shell.openPath(workspaceRoot.value)
          return
        }
      } catch { /* ignore */ }
    }
    showMessage(`工作区路径: ${workspaceRoot.value}`, 3000, "info")
  } catch (err) {
    console.error("打开文件夹失败:", err)
  }
}

async function selectWorkspacePath(): Promise<void> {
  // 尝试自动获取
  if (!workspaceRoot.value) {
    const wsPath = await fetchWorkspacePath()
    if (wsPath) {
      updateWorkspacePath(wsPath, true)
      showMessage("工作区路径已自动获取", 2000, "info")
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
        title: "选择思源工作区",
        defaultPath: workspaceRoot.value || undefined,
      })
      if (!result.canceled && result.filePaths[0]) {
        updateWorkspacePath(result.filePaths[0], true)
        showMessage("工作区路径已设置", 2000, "info")
        return
      }
    }
  } catch { /* ignore */ }
}

// ========== 对话框关闭 ==========

function handleClose(): void {
  if (isBackingUp.value) {
    if (!confirm("正在备份中，关闭窗口不会中断备份。确定要隐藏窗口吗？")) return
  }
  props.onClose?.()
}

// ========== 初始化 ==========

onMounted(async () => {
  // 初始化存储
  if (props.plugin) {
    dbStorage = new S3BackupStorage(props.plugin)
  }

  // 加载保存的 S3 配置
  try {
    if (dbStorage) {
      const savedConfig = await dbStorage.s3Config.load()
      if (savedConfig) {
        loadConfig(savedConfig)
        s3ConfigLocal.value = savedConfig
      }
    }
  } catch (err) {
    console.error("加载 S3 配置失败:", err)
  }

  // 加载自动备份设置和工作区
  await loadAutoBackupSettings()
  await detectWorkspacePath()

  // 初始化备份管理器
  initManagers()

  // 自动刷新备份列表
  if (isConfigured.value) {
    await refreshBackupList()
  }
})

onUnmounted(() => {
  // 清理
})
</script>

<style scoped lang="scss">
@use "./styles/index.scss";
</style>
