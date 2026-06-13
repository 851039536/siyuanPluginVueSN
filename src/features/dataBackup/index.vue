<template>
  <div class="data-backup-settings">
    <div class="data-backup-header">
      <span class="data-backup-header-icon">💾</span>
      <span class="data-backup-header-title">{{ i18n.dataBackup || '数据备份' }}</span>
      <button class="data-backup-close-btn" @click="handleClose">✕</button>
    </div>

    <div class="settings-container">
      <!-- 移动端警告 -->
      <div v-if="isMobile" class="mobile-warning">
        <span class="warning-icon">📱</span>
        <span class="warning-text">{{ i18n.mobileBackupDisabled || '检测到移动端环境，备份功能已自动禁用以节省流量和存储空间' }}</span>
      </div>

      <!-- 1. 工作区信息 -->
      <section class="card-section info-section">
        <div class="section-header">
          <span class="section-icon">💾</span>
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
                >📂</button>
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
          <span class="section-icon">📊</span>
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
          <span class="section-icon">📦</span>
          <h4>{{ i18n.manualBackup || '手动备份' }}</h4>
        </div>
        <div class="backup-actions-row">
          <button class="backup-btn primary" :disabled="isBackingUp" @click="performFullBackup">
            <span v-if="isBackingUp" class="loading-spinner" />
            <span v-else>📀</span>
            <span>全量备份</span>
          </button>
          <button
            class="backup-btn secondary"
            :disabled="isBackingUp || isPluginBackup"
            @click="exportPluginSettings"
          >
            <span v-if="isPluginBackup" class="loading-spinner" />
            <span v-else>⚙️</span>
            <span>{{ i18n.pluginSettingsBackup || '插件设置备份' }}</span>
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
          <span class="section-icon">⏰</span>
          <h4>{{ i18n.autoBackupSettings || '自动备份设置' }}</h4>
        </div>
        <div class="settings-form">
          <div class="form-row">
            <label class="form-label">{{ i18n.autoBackup || '自动备份' }}</label>
            <select v-model="autoBackupEnabled" class="form-select" @change="saveSettings">
              <option :value="false">{{ i18n.disabled || '禁用' }}</option>
              <option :value="true">{{ i18n.enabled || '启用' }}</option>
            </select>
          </div>
          <template v-if="autoBackupEnabled">
            <div class="form-row">
              <label class="form-label">{{ i18n.backupFrequency || '备份频率' }}</label>
              <select v-model="backupFrequency" class="form-select" @change="saveSettings">
                <option value="minute">{{ i18n.everyMinute || '每分钟' }}</option>
                <option value="hourly">{{ i18n.everyHour || '每小时' }}</option>
                <option value="daily">{{ i18n.everyDay || '每天' }}</option>
              </select>
            </div>
            <div v-if="backupFrequency === 'daily'" class="form-row">
              <label class="form-label">{{ i18n.backupTime || '备份时间' }}</label>
              <input v-model="backupTime" type="time" class="form-input" @change="saveSettings" />
            </div>
            <div class="form-row">
              <label class="form-label">{{ i18n.keepBackups || '保留备份数' }}</label>
              <input
                v-model="keepBackupCount" type="number" class="form-input small"
                min="1" max="30" @change="saveSettings"
              />
            </div>
            <div class="form-row">
              <label class="form-label">同时备份插件设置</label>
              <select v-model="autoBackupPluginData" class="form-select" @change="saveSettings">
                <option :value="false">禁用</option>
                <option :value="true">启用</option>
              </select>
            </div>
          </template>
        </div>
      </section>

      <!-- 5. 本地备份历史 -->
      <section class="card-section history-section">
        <div class="section-header">
          <span class="section-icon">📋</span>
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
              <!-- 云上传：支持选择目标云 -->
              <div v-if="cloudConfigs.length > 0" class="upload-target-selector">
                <select v-model="uploadTargets[backup.name]" class="mini-select">
                  <option v-for="cfg in cloudConfigs" :key="cfg.id" :value="cfg.id">
                    ☁️ {{ cfg.label }}
                  </option>
                </select>
                <button
                  class="action-btn cloud"
                  @click="uploadToCloud(backup)"
                >上传</button>
              </div>
              <button
                v-else-if="cloudSyncConfigured"
                class="action-btn cloud"
                @click="uploadToCloud(backup)"
              >☁️</button>
              <button class="action-btn delete" @click="deleteBackup(backup)">
                {{ i18n.delete || '删除' }}
              </button>
            </div>
          </div>
        </div>
        <div v-else class="empty-state">
          <span class="empty-icon">📭</span>
          <p>{{ i18n.noBackups || '暂无备份记录' }}</p>
        </div>
      </section>

      <!-- 6. 云备份设置（独立 section） -->
      <section class="card-section cloud-backup-section">
        <div class="section-header">
          <span class="section-icon">☁️</span>
          <h4>云备份设置</h4>
        </div>
        <div class="settings-form">
          <div class="form-row">
            <label class="form-label">云同步</label>
            <select v-model="cloudSyncEnabled" class="form-select" @change="saveSettings">
              <option :value="false">禁用</option>
              <option :value="true">启用</option>
            </select>
          </div>
        </div>

        <template v-if="cloudSyncEnabled">
          <div class="cloud-config-divider" />
          <div class="settings-form">
            <div class="form-row">
              <label class="form-label">云服务商</label>
              <select v-model="cloudConfig.type" class="form-select" @change="onProviderChange">
                <option value="qiniu">七牛云</option>
                <option value="alibaba">阿里云 OSS</option>
                <option value="tencent">腾讯云 COS</option>
              </select>
            </div>
            <div class="form-row">
              <label class="form-label">AccessKey</label>
              <input v-model="cloudConfig.accessKey" type="password" class="form-input" @change="saveCloudConfig" />
            </div>
            <div class="form-row">
              <label class="form-label">SecretKey</label>
              <input v-model="cloudConfig.secretKey" type="password" class="form-input" @change="saveCloudConfig" />
            </div>
            <div class="form-row">
              <label class="form-label">Bucket</label>
              <input v-model="cloudConfig.bucket" type="text" class="form-input" @change="saveCloudConfig" />
            </div>
            <div class="form-row">
              <label class="form-label">{{ regionLabel }}</label>
              <input
                v-model="cloudConfig.region" type="text" class="form-input"
                :placeholder="regionPlaceholder" @change="saveCloudConfig"
              />
            </div>
            <div class="form-row">
              <label class="form-label">存储路径</label>
              <input
                v-model="cloudConfig.prefix" type="text" class="form-input"
                placeholder="siyuan-backup/" @change="saveCloudConfig"
              />
            </div>
            <div class="cloud-actions">
              <button class="backup-btn secondary" :disabled="isTestingCloud" @click="testCloudConnection">
                {{ isTestingCloud ? '测试中...' : '测试连接' }}
              </button>
            </div>
            <div
              v-if="cloudTestResult"
              class="cloud-test-result"
              :class="{ success: cloudTestResult.success, error: !cloudTestResult.success }"
            >
              {{ cloudTestResult.message }}
            </div>
          </div>

          <!-- 云端备份列表 -->
          <div v-if="cloudBackupList.length > 0" class="cloud-backup-list">
            <div class="section-header" style="margin-top: 0.5rem;">
              <h4>云端备份</h4>
              <button class="refresh-btn" @click="loadCloudBackups">刷新</button>
            </div>
            <div v-for="file in cloudBackupList" :key="file.key" class="backup-item">
              <div class="backup-info">
                <span class="backup-name">{{ file.name }}</span>
                <span class="backup-time">{{ file.lastModified }}</span>
                <span class="backup-size">{{ formatFileSize(file.size) }}</span>
              </div>
              <div class="backup-actions">
                <button class="action-btn restore" @click="downloadFromCloud(file)">下载</button>
                <button class="action-btn delete" @click="deleteFromCloud(file)">删除</button>
              </div>
            </div>
          </div>
        </template>
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
import type { CloudFileInfo, CloudProviderConfig } from "./modules/CloudBackupManager"
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
import { CloudBackupManager } from "./modules/CloudBackupManager"
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
const isLoading = ref(false)
const isTestingCloud = ref(false)
const lastBackupTime = ref("")
const autoBackupEnabled = ref(false)
const isMobile = ref(false)
const backupFrequency = ref("daily")
const backupTime = ref("03:00")
const keepBackupCount = ref(7)
const cloudSyncEnabled = ref(false)
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

// ========== 云备份 ==========

const cloudConfig = ref<CloudProviderConfig>({
  type: "qiniu",
  accessKey: "",
  secretKey: "",
  bucket: "",
  region: "",
  prefix: "siyuan-backup/",
})
const cloudTestResult = ref<{ success: boolean, message: string } | null>(null)
const cloudBackupList = ref<CloudFileInfo[]>([])

/** 多云配置列表（用于上传选择） */
const cloudConfigs = ref<Array<{ id: string, label: string, config: CloudProviderConfig }>>([])
const uploadTargets = ref<Record<string, string>>({})
const cloudSyncConfigured = computed(() =>
  cloudConfig.value.accessKey && cloudConfig.value.secretKey && cloudConfig.value.bucket,
)

// ========== 云厂商相关计算属性 ==========

const regionLabel = computed(() => {
  const labels: Record<string, string> = {
    qiniu: "上传域名（可选）",
    alibaba: "Region",
    tencent: "Region",
  }
  return labels[cloudConfig.value.type] || "Region"
})

const regionPlaceholder = computed(() => {
  const placeholders: Record<string, string> = {
    qiniu: "如 https://up.qiniup.com",
    alibaba: "如 oss-cn-hangzhou",
    tencent: "如 ap-guangzhou",
  }
  return placeholders[cloudConfig.value.type] || ""
})

function onProviderChange() {
  // 切换云厂商时重置 region
  cloudConfig.value.region = ""
  saveCloudConfig()
}

// ========== Manager 实例 ==========

let backupManager: BackupManager | null = null
let cloudBackupManager: CloudBackupManager | null = null

function initManagers() {
  backupManager = new BackupManager(workspacePath.value, workspaceRoot.value)
  cloudBackupManager = new CloudBackupManager(props.plugin)
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
  await loadCloudConfig()

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
      cloudSyncEnabled.value = data.cloudSyncEnabled ?? false
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
        cloudSyncEnabled: cloudSyncEnabled.value,
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

// ========== 云配置管理 ==========

async function loadCloudConfig() {
  if (!cloudBackupManager) return
  const config = await cloudBackupManager.loadConfig()
  if (config) {
    cloudConfig.value = config
  }
  if (cloudSyncEnabled.value) {
    await loadCloudBackups()
  }
  // 加载所有已保存的云配置供上传选择
  await refreshCloudConfigs()
}

async function saveCloudConfig() {
  if (!cloudBackupManager) return
  await cloudBackupManager.saveConfig(cloudConfig.value)
}

async function refreshCloudConfigs() {
  if (!cloudBackupManager) return
  const configs: typeof cloudConfigs.value = []

  // 默认配置
  if (cloudSyncConfigured.value) {
    configs.push({
      id: "default",
      label: `${getProviderLabel(cloudConfig.value.type)}`,
      config: cloudConfig.value,
    })
  }

  // 其他已保存配置
  const ids = await cloudBackupManager.listConfigIds()
  for (const id of ids) {
    if (id === "default") continue
    const cfg = await cloudBackupManager.loadConfigById(id)
    if (cfg?.accessKey) {
      configs.push({
        id,
        label: `${getProviderLabel(cfg.type)} (${id})`,
        config: cfg,
      })
    }
  }

  cloudConfigs.value = configs
}

function getProviderLabel(type: string): string {
  const labels: Record<string, string> = {
    qiniu: "七牛云",
    alibaba: "阿里云",
    tencent: "腾讯云",
  }
  return labels[type] || type
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

  // 自动云同步
  if (cloudSyncEnabled.value && cloudBackupManager) {
    try {
      await cloudBackupManager.upload(result.filePath)
      showMessage("已同步至云端", 2000, "info")
    } catch (err: any) {
      console.error("自动云同步失败:", err)
      showMessage(`云同步失败: ${err.message}`, 3000, "error")
    }
  }
}

// ========== 云端操作 ==========

async function uploadToCloud(backup: { name: string, path: string }) {
  if (!cloudBackupManager) return

  try {
    // 支持选择指定云上传
    const targetId = uploadTargets.value[backup.name]
    let targetConfig: CloudProviderConfig | undefined

    if (targetId && targetId !== "default") {
      targetConfig = (await cloudBackupManager.loadConfigById(targetId)) || undefined
    }

    await cloudBackupManager.upload(backup.path, targetConfig ? { cloudConfig: targetConfig } : undefined)
    showMessage(`已上传 ${backup.name} 至云端`, 2000, "info")
    await loadCloudBackups()
  } catch (error: any) {
    console.error("云上传失败:", error)
    showMessage(`上传失败: ${error.message}`, 3000, "error")
  }
}

async function testCloudConnection() {
  if (!cloudBackupManager) return

  isTestingCloud.value = true
  cloudTestResult.value = null

  try {
    await saveCloudConfig()
    cloudTestResult.value = await cloudBackupManager.testConnection(cloudConfig.value)
    if (cloudTestResult.value.success) {
      await refreshCloudConfigs()
    }
  } catch (error: any) {
    cloudTestResult.value = { success: false, message: error.message }
  } finally {
    isTestingCloud.value = false
  }
}

async function loadCloudBackups() {
  if (!cloudBackupManager) return
  try {
    cloudBackupList.value = await cloudBackupManager.listBackups()
  } catch (error) {
    console.error("加载云端备份列表失败:", error)
    cloudBackupList.value = []
  }
}

async function downloadFromCloud(file: CloudFileInfo) {
  if (!cloudBackupManager) return
  try {
    const localPath = `${workspaceRoot.value}/data-backup/${file.name}`
    await cloudBackupManager.download(file.key, localPath)
    showMessage(`已下载 ${file.name}`, 2000, "info")
    await loadBackupList()
  } catch (error: any) {
    showMessage(`下载失败: ${error.message}`, 3000, "error")
  }
}

async function deleteFromCloud(file: CloudFileInfo) {
  if (!cloudBackupManager) return
  const confirmDelete = confirm(`确定要删除云端备份 "${file.name}" 吗？`)
  if (!confirmDelete) return
  try {
    await cloudBackupManager.deleteBackup(file.key)
    showMessage("云端备份已删除", 2000, "info")
    await loadCloudBackups()
  } catch (error: any) {
    showMessage(`删除失败: ${error.message}`, 3000, "error")
  }
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
