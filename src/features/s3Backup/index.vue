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
          {{ i18n.backupHint || "备份将直接上传文件到 S3" }}
        </p>
      </section>

      <!-- 5. S3 备份列表 -->
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
import { onMounted, ref } from "vue"
import { showMessage } from "siyuan"
import { getWorkspaceDir } from "@/api"
import { formatFileSize } from "@/utils/format"
import { pickDirectory, openFolderInExplorer } from "@/utils/electronDialog"
import { getNodeModules } from "@/utils/nodeModules"
import { useS3Backup } from "./composables/useS3Backup"
import { BackupManager } from "./modules/BackupManager"
import { getS3BackupInstance } from "./index"
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
  isBackingUp,
  isLoading,
  backupProgress,
  backupList,
  phaseLabel,
  testConnection,
  saveConfig,
  uploadFileContent,
  listBackups,
  downloadBackup,
  deleteBackup,
  loadConfig,
} = useS3Backup()

// ========== 基础状态 ==========

const workspacePath = ref("")
const workspaceRoot = ref("")
const lastBackupTime = ref("")
const s3ConfigLocal = ref<S3Config | null>(null)

let backupManager: BackupManager | null = null

// ========== 计算 ==========

function initBackupManager(): void {
  if (workspacePath.value) {
    backupManager = new BackupManager(workspacePath.value, workspaceRoot.value)
  }
}

// ========== 工作区路径管理 ==========

function updateWorkspacePath(root: string, shouldSave = false): void {
  workspaceRoot.value = root
  workspacePath.value = root
  if (backupManager) {
    backupManager.updateWorkspacePaths(workspacePath.value, workspaceRoot.value)
  }
  // 同步更新 S3Backup 类内部的工作区路径
  const instance = getS3BackupInstance()
  if (instance) {
    instance.setWorkspacePaths(root)
  }
  if (shouldSave) {
    saveWorkspaceSettings()
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
  // 优先使用 S3Backup 类已检测到的路径
  const instance = getS3BackupInstance()
  if (instance) {
    const root = instance.getWorkspaceRoot()
    if (root) {
      updateWorkspacePath(root)
      return
    }
  }

  // 兜底：直接尝试 API 获取
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

  // 持久化配置（使用 S3Backup 类共享的存储实例）
  const instance = getS3BackupInstance()
  if (instance) {
    await instance.getStorage().s3Config.save(s3ConfigLocal.value)
  }
  showMessage(props.i18n.configSaved || "配置已保存", 2000, "info")
}

// ========== 备份操作 ==========

async function performManualBackup(): Promise<void> {
  if (isBackingUp.value || !backupManager) {
    return
  }

  if (!workspacePath.value) {
    showMessage(props.i18n.noWorkspace || "请先选择工作区路径", 3000, "info")
    await selectWorkspacePath()
    if (!workspacePath.value) {
      return
    }
  }

  isBackingUp.value = true

  try {
    // 阶段 1: 扫描文件
    const files = await backupManager.getWorkspaceFiles((p) => {
      backupProgress.value = { ...p }
    })

    if (files.length === 0) {
      showMessage("工作区没有可备份的文件", 3000, "info")
      return
    }

    // 阶段 2: 逐文件上传到 S3
    const prefix = s3Config.value.prefix || "siyuan-backup/"
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
    const node = getNodeModules()
    const fs = node!.fs.promises

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const s3Key = `${prefix}${timestamp}/${file.relativePath}`
      const percent = Math.round((i / files.length) * 100)

      backupProgress.value = {
        phase: "uploading",
        currentFile: file.relativePath,
        filesProcessed: i + 1,
        totalFiles: files.length,
        percent,
      }

      const content = await fs.readFile(file.fullPath)
      await uploadFileContent(content, s3Key)
    }

    // 完成
    backupProgress.value = {
      phase: "uploading",
      currentFile: "",
      filesProcessed: files.length,
      totalFiles: files.length,
      percent: 100,
    }

    // 更新备份记录
    lastBackupTime.value = new Date().toLocaleString()
    const instance = getS3BackupInstance()
    if (instance) {
      await instance.saveWorkspaceSettings({
        lastBackupTime: lastBackupTime.value,
        workspacePath: workspacePath.value,
        workspaceRoot: workspaceRoot.value,
      })
    }

    showMessage(`${props.i18n.backupSuccess || "备份上传成功"}: ${files.length} 个文件`, 3000, "info")

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
    const node = getNodeModules()
    if (!node) throw new Error("无法访问文件系统，请使用桌面版思源笔记")
    const fs = node.fs.promises
    const path = node.path

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
  const confirmed = confirm(props.i18n.confirmRestore || "确定要下载此备份到本地备份目录吗？如需恢复请手动解压替换。")
  if (!confirmed) return

  try {
    const node = getNodeModules()
    if (!node) throw new Error("无法访问文件系统，请使用桌面版思源笔记")
    const fs = node.fs.promises
    const path = node.path

    const downloadDir = `${workspaceRoot.value}/data-backup`
    await fs.mkdir(downloadDir, { recursive: true })
    const localPath = path.join(downloadDir, backup.name)

    await downloadBackup(backup.key, localPath)
    showMessage(props.i18n.downloadToLocalSuccess || "备份已下载到本地备份目录，请手动解压恢复", 4000, "info")
  } catch (err: any) {
    showMessage(`${props.i18n.restoreFailed || "下载失败"}: ${err.message}`, 5000, "error")
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

async function loadWorkspaceSettings(): Promise<void> {
  try {
    const instance = getS3BackupInstance()
    if (instance) {
      const data = await instance.loadWorkspaceSettings()
      lastBackupTime.value = data.lastBackupTime

      // 同步工作区路径
      const root = instance.getWorkspaceRoot()
      if (root && !workspaceRoot.value) {
        workspaceRoot.value = root
        workspacePath.value = instance.getWorkspacePath()
      }
    }
  } catch (err) {
    console.error("加载工作区设置失败:", err)
  }
}

async function saveWorkspaceSettings(): Promise<void> {
  try {
    const instance = getS3BackupInstance()
    if (instance) {
      await instance.saveWorkspaceSettings({
        lastBackupTime: lastBackupTime.value,
        workspacePath: workspacePath.value,
        workspaceRoot: workspaceRoot.value,
      })
    }
  } catch (err) {
    console.error("保存工作区设置失败:", err)
  }
}

// ========== 文件夹操作 ==========

async function openWorkspaceFolder(): Promise<void> {
  if (!workspaceRoot.value) {
    return
  }
  const opened = await openFolderInExplorer(workspaceRoot.value)
  if (!opened) {
    showMessage(`工作区路径: ${workspaceRoot.value}`, 3000, "info")
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
  // Electron 原生文件夹选择器
  const selectedPath = await pickDirectory("选择思源工作区")
  if (selectedPath) {
    updateWorkspacePath(selectedPath, true)
    showMessage("工作区路径已设置", 2000, "info")
  }
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
  // 加载保存的 S3 配置（通过 S3Backup 类共享的存储实例）
  const instance = getS3BackupInstance()
  try {
    if (instance) {
      const savedConfig = await instance.getStorage().s3Config.load()
      if (savedConfig) {
        loadConfig(savedConfig)
        s3ConfigLocal.value = savedConfig
      }
    }
  } catch (err) {
    console.error("加载 S3 配置失败:", err)
  }

  // 加载工作区设置和路径
  await loadWorkspaceSettings()
  await detectWorkspacePath()

  // 初始化备份管理器（用于手动备份）
  initBackupManager()

  // 自动刷新备份列表
  if (isConfigured.value) {
    await refreshBackupList()
  }
})
</script>

<style scoped lang="scss">
@use "./styles/index.scss";
</style>
