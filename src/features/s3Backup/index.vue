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
          :on-test-connection="testConnection"
          @config-changed="handleConfigChanged"
          @saved="handleConfigSaved"
        />
      </section>

      <!-- 3. 备份模式选择 -->
      <section class="card-section backup-mode-section">
        <div class="section-header">
          <h4>{{ i18n.backupMode || "备份模式" }}</h4>
        </div>
        <div class="form-group form-group-checkbox">
          <label class="form-checkbox-label">
            <input
              v-model="backupModeLocal.localZip"
              type="checkbox"
              class="form-checkbox"
              @change="saveWorkspaceSettings"
            />
            <span>{{ i18n.localZipBackup || "本地 ZIP 备份" }}</span>
          </label>
          <span class="form-hint">{{ i18n.localZipHint || "打包为 data-*.zip 保存到工作区 data-backup/ 目录" }}</span>
        </div>
        <div class="form-group form-group-checkbox">
          <label class="form-checkbox-label">
            <input
              v-model="backupModeLocal.s3Upload"
              type="checkbox"
              class="form-checkbox"
              @change="saveWorkspaceSettings"
            />
            <span>{{ i18n.s3Upload || "上传到 S3" }}</span>
          </label>
          <span class="form-hint">{{ i18n.s3UploadHint || "逐文件上传到 S3 兼容存储（需先完成 S3 配置）" }}</span>
        </div>
        <p class="backup-hint">
          {{ i18n.backupModeHint || "可同时勾选两项，本地 ZIP 和 S3 上传将顺序执行" }}
        </p>
      </section>

      <!-- 4. 备份进度 -->
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

      <!-- 5. 手动备份 -->
      <section class="card-section backup-section">
        <div class="section-header">
          <h4>{{ i18n.manualBackup || "手动备份" }}</h4>
        </div>
        <div class="backup-actions-row">
          <button
            class="vp-btn vp-btn--primary vp-btn--sm"
            :disabled="isBackingUp || !canBackup || !workspacePath"
            @click="performManualBackup"
          >
            <span
              v-if="isBackingUp"
              class="vp-spin"
            />
            <span>{{ i18n.backupNow || "立即备份" }}</span>
          </button>
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm"
            :disabled="isBackingUp || !isConfigured || !workspacePath"
            @click="triggerS3OnlyUpload"
          >
            <span
              v-if="isS3OnlyBackingUp"
              class="vp-spin"
            />
            <span>{{ i18n.uploadToS3 || "上传到 S3" }}</span>
          </button>
        </div>
        <div class="form-group form-group-checkbox">
          <label class="form-checkbox-label">
            <input
              v-model="useDateFolder"
              type="checkbox"
              class="form-checkbox"
              @change="saveWorkspaceSettings"
            />
            <span>{{ i18n.useDateFolder || "生成日期子文件夹" }}</span>
          </label>
          <span class="form-hint">{{ i18n.useDateFolderHint || "勾选后按日期分类存储" }}</span>
        </div>
        <!-- 本地备份目录 -->
        <div class="form-group">
          <label class="form-label">{{ i18n.localBackupDir || "本地备份目录" }}</label>
          <span class="form-label-desc">{{ i18n.localBackupDirDesc || "ZIP 压缩包保存到本地的哪个文件夹" }}</span>
          <div class="path-input-row">
            <input
              v-model="localBackupDir"
              type="text"
              class="form-input form-input--sm"
              placeholder="data-backup"
              @change="onLocalBackupDirChanged"
            />
          </div>
          <div
            v-if="resolvedLocalBackupPath"
            class="path-preview"
          >
            <span class="path-preview-label">{{ i18n.pathPreview || "实际路径" }}</span>
            <code class="path-preview-value">{{ resolvedLocalBackupPath }}</code>
          </div>
        </div>
        <!-- S3 上传子路径 -->
        <div class="form-group">
          <label class="form-label">{{ i18n.s3SubPath || "S3 上传子路径" }}</label>
          <span class="form-label-desc">{{ i18n.s3SubPathDesc || "上传到云存储时，在目录前缀之后追加的路径段" }}</span>
          <input
            v-model="s3SubPrefix"
            type="text"
            class="form-input form-input--sm"
            placeholder="data-backup"
            @change="saveWorkspaceSettings"
          />
          <div
            v-if="resolvedS3Path"
            class="path-preview"
          >
            <span class="path-preview-label">{{ i18n.pathPreview || "云存储路径" }}</span>
            <code class="path-preview-value">{{ resolvedS3Path }}</code>
          </div>
        </div>
        <p class="backup-hint">
          {{ backupModeLocal.localZip && backupModeLocal.s3Upload
            ? (i18n.backupHintBoth || "将先打包本地 ZIP 再上传 S3")
            : backupModeLocal.localZip
              ? (i18n.backupHintLocal || "备份将打包为 data-*.zip 保存到本地备份目录")
              : (i18n.backupHint || "备份将逐文件上传到 S3")
          }}
        </p>
      </section>

      <!-- 6. 自动备份设置 -->
      <section class="card-section auto-backup-section">
        <div class="section-header">
          <h4>{{ i18n.autoBackupSettings || "自动备份设置" }}</h4>
        </div>
        <div class="settings-row">
          <span class="inline-label">{{ i18n.autoBackup || "自动备份" }}</span>
          <select
            v-model="autoBackupEnabled"
            class="form-select narrow"
            @change="saveWorkspaceSettings"
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
              @change="saveWorkspaceSettings"
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
                @change="saveWorkspaceSettings"
              />
            </template>
            <span class="inline-label">{{ i18n.keepBackupCount || "保留" }}</span>
            <input
              v-model="keepBackupCount"
              type="number"
              class="form-input narrow"
              style="width: 3rem;"
              min="1"
              max="30"
              @change="saveWorkspaceSettings"
            />
            <span class="inline-label">{{ i18n.keepBackupCountHint || "份" }}</span>
          </template>
        </div>
        <p class="backup-hint">
          {{ autoBackupEnabled
            ? (i18n.autoBackupEnabledHint || "自动备份已启用，将按设定频率自动执行")
            : (i18n.autoBackupDisabledHint || "启用后按设定频率自动备份工作区")
          }}
        </p>
      </section>

      <!-- 7. 本地备份历史 -->
      <section class="card-section history-section">
        <div class="section-header">
          <h4>{{ i18n.localBackups || "本地备份列表" }}</h4>
          <button
            class="refresh-btn"
            :disabled="isLoadingLocal || !workspaceRoot"
            @click="refreshLocalBackupList"
          >
            {{ i18n.refresh || "刷新" }}
          </button>
        </div>
        <div
          v-if="localBackupList.length > 0"
          class="backup-list"
        >
          <div
            v-for="(backup, index) in localBackupList"
            :key="index"
            class="backup-item"
          >
            <div class="backup-info">
              <span class="backup-name">{{ backup.name }}</span>
              <span class="backup-time">{{ backup.time }}</span>
              <span class="backup-size">{{ formatFileSize(backup.size) }}</span>
            </div>
            <div class="backup-actions">
              <button
                class="action-btn delete"
                @click="deleteLocalBackup(backup)"
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
          <p>{{ i18n.noLocalBackups || "暂无本地备份" }}</p>
        </div>
      </section>

      <!-- 8. S3 备份列表 -->
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
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue"
import { showMessage } from "siyuan"
import { getWorkspaceDir } from "@/api"
import { formatFileSize } from "@/utils/format"
import { pickDirectory, openFolderInExplorer } from "@/utils/electronDialog"
import { getNodeModules } from "@/utils/nodeModules"
import { encryptSetting, decryptSetting } from "@/utils/settingsCrypto"
import { useS3Backup } from "./composables/useS3Backup"
import { BackupManager } from "./modules/BackupManager"
import type { BackupResult, WorkspaceFile } from "./modules/BackupManager"
import { getS3BackupInstance } from "./index"
import type { S3Config, S3FileInfo, LocalBackupInfo, BackupMode } from "./types"
import { DEFAULT_BACKUP_MODE } from "./types"
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
const useDateFolder = ref(true)
const localBackupDir = ref("data-backup")
const s3SubPrefix = ref("data-backup")
const isS3OnlyBackingUp = ref(false)

// ========== 路径预览 ==========

const node = getNodeModules()
const pathModule = node?.path

/** 本地备份 ZIP 文件保存的完整路径预览 */
const resolvedLocalBackupPath = computed(() => {
  if (!workspaceRoot.value || !localBackupDir.value) { return "" }
  if (pathModule) {
    return pathModule.join(workspaceRoot.value, localBackupDir.value)
  }
  return `${workspaceRoot.value}/${localBackupDir.value}`
})

/** S3 上传在桶中的完整路径预览 */
const resolvedS3Path = computed(() => {
  const prefix = s3Config.value?.prefix || "siyuan-backup/"
  const sub = s3SubPrefix.value || "data-backup"
  return `${prefix.replace(/\/+$/, "")}/${sub}/`
})

// ========== 备份模式 ==========

const backupModeLocal = reactive<BackupMode>({ ...DEFAULT_BACKUP_MODE })

// ========== 自动备份设置 ==========

const autoBackupEnabled = ref(false)
const backupFrequency = ref("daily")
const backupTime = ref("03:00")
const keepBackupCount = ref(7)

// ========== 本地备份列表 ==========

const localBackupList = ref<LocalBackupInfo[]>([])
const isLoadingLocal = ref(false)

let lastBackupTimestamp = 0

// ========== S3 配置本地引用 ==========

const s3ConfigLocal = ref<S3Config | null>(null)

// ========== Manager 实例 ==========

let backupManager: BackupManager | null = null

// ========== 计算属性 ==========

/** 是否有任一备份模式被选中 */
const canBackup = computed(() => {
  return backupModeLocal.localZip || (backupModeLocal.s3Upload && isConfigured.value)
})

// ========== 备份管理器初始化 ==========

function initBackupManager(): void {
  if (workspacePath.value) {
    backupManager = new BackupManager(workspacePath.value, workspaceRoot.value)
    backupManager.setBackupDir(localBackupDir.value)
  }
}

function onLocalBackupDirChanged(): void {
  if (backupManager) {
    backupManager.setBackupDir(localBackupDir.value)
  }
  saveWorkspaceSettings()
}

// ========== 工作区路径管理 ==========

function updateWorkspacePath(root: string, shouldSave = false): void {
  workspaceRoot.value = root
  workspacePath.value = root
  // 同步写入 localStorage，便于下次启动快速恢复
  localStorage.setItem("siyuan-workspace-root", root)
  if (backupManager) {
    backupManager.updateWorkspacePaths(workspacePath.value, workspaceRoot.value)
  }
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
  const instance = getS3BackupInstance()
  if (instance) {
    const root = instance.getWorkspaceRoot()
    if (root) {
      updateWorkspacePath(root)
      return
    }
  }
  const apiPath = await fetchWorkspacePath()
  if (apiPath) {
    updateWorkspacePath(apiPath)
    return
  }
}

// ========== S3 配置管理 ==========

function handleConfigChanged(config: S3Config): void {
  s3ConfigLocal.value = config
}

async function handleConfigSaved(): Promise<void> {
  if (!s3ConfigLocal.value) { return }
  saveConfig(s3ConfigLocal.value)

  const instance = getS3BackupInstance()
  if (instance) {
    // A8 修复：S3 凭证加密存储，防止 accessKey/secretKey 明文暴露
    const plain = s3ConfigLocal.value
    const encrypted: S3Config = {
      ...plain,
      accessKey: await encryptSetting(plain.accessKey),
      secretKey: await encryptSetting(plain.secretKey),
    }
    await instance.getStorage().s3Config.save(encrypted)
  }
  showMessage(props.i18n.configSaved || "配置已保存", 2000, "info")
}

// ========== 备份操作 ==========

async function performManualBackup(): Promise<void> {
  // A7 修复：backupManager 为 null 时记录警告日志，避免静默失败
  if (!backupManager) {
    console.warn("[S3备份] backupManager 未初始化，无法执行备份")
    return
  }
  if (isBackingUp.value) { return }

  if (!workspacePath.value) {
    showMessage(props.i18n.noWorkspace || "请先选择工作区路径", 3000, "info")
    await selectWorkspacePath()
    if (!workspacePath.value) { return }
  }

  isBackingUp.value = true

  try {
    // 根据备份模式分发
    let localResult: BackupResult | null = null
    if (backupModeLocal.localZip) {
      localResult = await performLocalBackup()
    }
    if (backupModeLocal.s3Upload) {
      // 同时勾选本地+S3 时，只上传本次生成的 ZIP，避免重复上传历史备份（A4 修复）
      await performS3Backup(localResult)
    }

    // 更新备份时间
    lastBackupTime.value = new Date().toLocaleString()
    lastBackupTimestamp = Date.now()
    const instance = getS3BackupInstance()
    if (instance) {
      instance.updateLastBackupTime(lastBackupTimestamp)
      await instance.saveWorkspaceSettings({
        lastBackupTime: lastBackupTime.value,
        workspacePath: workspacePath.value,
        workspaceRoot: workspaceRoot.value,
        useDateFolder: useDateFolder.value,
        autoBackupEnabled: autoBackupEnabled.value,
        backupFrequency: backupFrequency.value,
        backupTime: backupTime.value,
        keepBackupCount: keepBackupCount.value,
        backupMode: { ...backupModeLocal },
        lastBackupTimestamp,
        localBackupDir: localBackupDir.value,
        s3SubPrefix: s3SubPrefix.value,
      })
    }
  } catch (err: any) {
    console.error("备份失败:", err)
    showMessage(`${props.i18n.backupFailed || "备份失败"}: ${err.message}`, 5000, "error")
  } finally {
    isBackingUp.value = false
    saveWorkspaceSettings()
  }
}

/** 本地 ZIP 备份，返回备份结果（含文件路径，供 S3 上传使用） */
async function performLocalBackup(): Promise<BackupResult | null> {
  if (!backupManager) { return null }

  backupProgress.value = {
    phase: "scanning",
    currentFile: "",
    filesProcessed: 0,
    totalFiles: 0,
    percent: 0,
  }

  try {
    const result = await backupManager.performFullBackup({
      // A2 修复：传递 useDateFolder 配置，支持按日期创建子文件夹
      useDateFolder: useDateFolder.value,
      onProgress: (p) => {
        backupProgress.value = { ...p }
      },
    })

    // A3 修复：使用当前时间而非 lastBackupTime.value（后者尚未更新）
    const backupTime = new Date().toLocaleString()
    localBackupList.value.unshift({
      name: result.fileName,
      path: result.filePath,
      time: backupTime,
      size: result.size,
    })

    // A1 修复：超出保留数量时删除磁盘上的旧备份文件
    if (localBackupList.value.length > keepBackupCount.value) {
      const toDelete = localBackupList.value.slice(keepBackupCount.value)
      for (const old of toDelete) {
        try {
          await backupManager.deleteBackupFile(old.path)
        } catch (err) {
          console.warn(`删除旧备份失败: ${old.name}`, err)
        }
      }
      localBackupList.value = localBackupList.value.slice(0, keepBackupCount.value)
    }

    const instance = getS3BackupInstance()
    if (instance) {
      await instance.getStorage().backupHistory.save({ list: localBackupList.value })
    }

    showMessage(`本地备份成功: ${result.fileName}（${result.totalFiles} 文件）`, 3000, "info")
    return result
  } catch (err: any) {
    throw new Error(`本地备份: ${err.message}`)
  }
}

/** S3 备份
 * @param latestZip 若提供则只上传该 ZIP 文件（用于本地+S3 同时备份场景，避免重复上传历史备份）
 */
async function performS3Backup(latestZip?: BackupResult | null): Promise<void> {
  if (!backupManager) { return }

  if (!isConfigured.value) {
    throw new Error("S3 未配置，请先完成 S3 连接配置")
  }

  let files: WorkspaceFile[]
  if (latestZip) {
    // A4 修复：仅上传刚生成的 ZIP 文件，避免每次重复上传 data-backup/ 中的全部历史备份
    files = [{ fullPath: latestZip.filePath, relativePath: latestZip.fileName }]
  } else {
    files = await backupManager.getWorkspaceFiles((p) => {
      backupProgress.value = { ...p }
    })
  }

  if (files.length === 0) {
    showMessage("工作区没有可备份的文件", 3000, "info")
    return
  }

  const prefix = s3Config.value.prefix || "siyuan-backup/"
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  const timestamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  // B10 修复：复用顶层缓存的 node 实例
  const fs = node!.fs.promises

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const datePath = useDateFolder.value ? `${timestamp}/` : ""
    const sub = s3SubPrefix.value || "data-backup"
    // 使用路径段数组拼接，避免 prefix 缺少尾部 / 或 sub 为空导致的粘连/双斜杠问题
    const keyParts: string[] = [prefix.replace(/\/+$/, ""), sub]
    if (datePath) { keyParts.push(datePath.replace(/\/+$/, "")) }
    keyParts.push(file.relativePath.replace(/^\/+/, ""))
    const s3Key = keyParts.join("/")
    const percent = Math.round((i / files.length) * 100)

    backupProgress.value = {
      phase: "uploading",
      currentFile: file.relativePath,
      filesProcessed: i + 1,
      totalFiles: files.length,
      percent,
    }

    let content
    try {
      content = await fs.readFile(file.fullPath)
    } catch (readErr: any) {
      console.warn(`跳过无法读取的文件: ${file.relativePath}`, readErr.message)
      continue
    }
    await uploadFileContent(content, s3Key)
  }

  backupProgress.value = {
    phase: "uploading",
    currentFile: "",
    filesProcessed: files.length,
    totalFiles: files.length,
    percent: 100,
  }

  showMessage(`${props.i18n.backupSuccess || "备份上传成功"}: ${files.length} 个文件`, 3000, "info")

  await refreshBackupList()
}

/** 触发独立 S3 上传（按钮直接调用，无需额外包装） */
async function triggerS3OnlyUpload(): Promise<void> {
  if (isS3OnlyBackingUp.value || !backupManager) { return }
  if (!workspacePath.value) {
    showMessage(props.i18n.noWorkspace || "请先选择工作区路径", 3000, "info")
    await selectWorkspacePath()
    if (!workspacePath.value) { return }
  }
  isS3OnlyBackingUp.value = true
  try {
    await performS3Backup()
  } catch (err: any) {
    showMessage(`S3 上传失败: ${err.message}`, 5000, "error")
  } finally {
    isS3OnlyBackingUp.value = false
  }
}

// ========== 自动备份触发 ==========

async function handleAutoBackupTrigger(): Promise<void> {
  await performManualBackup()
}

// ========== 定时器重启 ==========

function handleTimerRestart(): void {
  const s3Backup = props.plugin?.__s3Backup
  if (s3Backup && typeof s3Backup.restartAutoBackupTimer === "function") {
    s3Backup.restartAutoBackupTimer(autoBackupEnabled.value, backupFrequency.value, backupTime.value)
  }
}

watch(
  [backupFrequency, backupTime, autoBackupEnabled],
  () => handleTimerRestart(),
)

// ========== 本地备份管理 ==========

async function loadLocalBackupList(): Promise<void> {
  localBackupList.value = []
  try {
    if (backupManager) {
      const scanned = await backupManager.scanBackupDir()
      if (scanned.length > 0) {
        localBackupList.value = scanned
        const instance = getS3BackupInstance()
        if (instance) {
          await instance.getStorage().backupHistory.save({ list: localBackupList.value })
        }
        return
      }
    }
    const instance = getS3BackupInstance()
    if (instance) {
      const history = await instance.getStorage().backupHistory.load()
      if (history?.list) {
        localBackupList.value = history.list
      }
    }
  } catch (error) {
    console.error("加载本地备份列表失败:", error)
  }
}

async function refreshLocalBackupList(): Promise<void> {
  isLoadingLocal.value = true
  try {
    await loadLocalBackupList()
  } finally {
    isLoadingLocal.value = false
  }
}

async function deleteLocalBackup(backup: { name: string; path: string }): Promise<void> {
  try {
    const confirmDelete = confirm(props.i18n.confirmDelete || "确定要删除此备份吗？")
    if (!confirmDelete) { return }
    if (backupManager) {
      await backupManager.deleteBackupFile(backup.path)
    }
    // A11 修复：按 path 过滤而非 name，避免同名文件误删
    localBackupList.value = localBackupList.value.filter((b) => b.path !== backup.path)
    const instance = getS3BackupInstance()
    if (instance) {
      await instance.getStorage().backupHistory.save({ list: localBackupList.value })
    }
    showMessage(props.i18n.deleteSuccess || "删除成功", 2000, "info")
  } catch (error) {
    console.error("删除本地备份失败:", error)
    showMessage(props.i18n.deleteFailed || "删除失败", 3000, "error")
  }
}

// ========== S3 备份管理 ==========

async function refreshBackupList(): Promise<void> {
  if (!isConfigured.value) { return }
  try {
    await listBackups()
  } catch (err: any) {
    console.error("刷新备份列表失败:", err)
  }
}

// B7 修复：提取公共方法，消除 handleDownload/handleRestore 核心逻辑重复
async function downloadToLocalDir(backup: S3FileInfo): Promise<string> {
  if (!node) { throw new Error("无法访问文件系统，请使用桌面版思源笔记") }
  const fs = node.fs.promises
  const pathModule = node.path

  const downloadDir = `${workspaceRoot.value}/${localBackupDir.value || "data-backup"}`
  await fs.mkdir(downloadDir, { recursive: true })
  const localPath = pathModule.join(downloadDir, backup.name)

  await downloadBackup(backup.key, localPath)
  return localPath
}

async function handleDownload(backup: S3FileInfo): Promise<void> {
  try {
    await downloadToLocalDir(backup)
    showMessage(props.i18n.downloadSuccess || "下载成功", 2000, "info")
  } catch (err: any) {
    showMessage(`${props.i18n.downloadFailed || "下载失败"}: ${err.message}`, 5000, "error")
  }
}

async function handleRestore(backup: S3FileInfo): Promise<void> {
  const confirmed = confirm(props.i18n.confirmRestore || "确定要下载此备份到本地备份目录吗？如需恢复请手动解压替换。")
  if (!confirmed) { return }

  try {
    await downloadToLocalDir(backup)
    showMessage(props.i18n.downloadToLocalSuccess || "备份已下载到本地备份目录，请手动解压恢复", 4000, "info")
  } catch (err: any) {
    showMessage(`${props.i18n.restoreFailed || "下载失败"}: ${err.message}`, 5000, "error")
  }
}

async function handleDelete(backup: S3FileInfo): Promise<void> {
  const confirmed = confirm(props.i18n.confirmDelete || "确定要删除此备份吗？")
  if (!confirmed) { return }

  try {
    await deleteBackup(backup.key)
    showMessage(props.i18n.deleteSuccess || "删除成功", 2000, "info")
  } catch (err: any) {
    showMessage(`${props.i18n.deleteFailed || "删除失败"}: ${err.message}`, 5000, "error")
  }
}

// ========== 设置持久化 ==========

async function loadWorkspaceSettings(): Promise<void> {
  try {
    const instance = getS3BackupInstance()
    if (instance) {
      const data = await instance.loadWorkspaceSettings()
      lastBackupTime.value = data.lastBackupTime
      useDateFolder.value = data.useDateFolder ?? true
      autoBackupEnabled.value = data.autoBackupEnabled ?? false
      backupFrequency.value = data.backupFrequency ?? "daily"
      backupTime.value = data.backupTime ?? "03:00"
      keepBackupCount.value = data.keepBackupCount ?? 7
      localBackupDir.value = data.localBackupDir || "data-backup"
      s3SubPrefix.value = data.s3SubPrefix || "data-backup"

      // 加载备份模式
      const bs = await instance.getStorage().backupSettings.loadOrDefault()
      if (bs.backupMode) {
        backupModeLocal.localZip = bs.backupMode.localZip ?? true
        backupModeLocal.s3Upload = bs.backupMode.s3Upload ?? false
      }

      const root = instance.getWorkspaceRoot()
      if (root && !workspaceRoot.value) {
        workspaceRoot.value = root
        workspacePath.value = root
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
        useDateFolder: useDateFolder.value,
        autoBackupEnabled: autoBackupEnabled.value,
        backupFrequency: backupFrequency.value,
        backupTime: backupTime.value,
        keepBackupCount: keepBackupCount.value,
        backupMode: { ...backupModeLocal },
        lastBackupTimestamp,
        localBackupDir: localBackupDir.value,
        s3SubPrefix: s3SubPrefix.value,
      })
    }
  } catch (err) {
    console.error("保存工作区设置失败:", err)
  }
}

// ========== 文件夹操作 ==========

async function openWorkspaceFolder(): Promise<void> {
  if (!workspaceRoot.value) { return }
  const opened = await openFolderInExplorer(workspaceRoot.value)
  if (!opened) {
    showMessage(`工作区路径: ${workspaceRoot.value}`, 3000, "info")
  }
}

async function selectWorkspacePath(): Promise<void> {
  if (!workspaceRoot.value) {
    const wsPath = await fetchWorkspacePath()
    if (wsPath) {
      updateWorkspacePath(wsPath, true)
      showMessage("工作区路径已自动获取", 2000, "info")
      return
    }
  }
  const selectedPath = await pickDirectory("选择思源工作区")
  if (selectedPath) {
    updateWorkspacePath(selectedPath, true)
    showMessage("工作区路径已设置", 2000, "info")
  }
}

// ========== 对话框关闭 ==========

function handleClose(): void {
  if (isBackingUp.value) {
    if (!confirm("正在备份中，关闭窗口不会中断备份。确定要隐藏窗口吗？")) { return }
  }
  props.onClose?.()
}

// ========== 初始化 ==========

onMounted(async () => {
  // 加载保存的 S3 配置
  const instance = getS3BackupInstance()
  try {
    if (instance) {
      const savedConfig = await instance.getStorage().s3Config.load()
      if (savedConfig) {
        // A8 修复：解密 S3 凭证（旧数据无 enc: 前缀则原样返回，向后兼容）
        const decrypted: S3Config = {
          ...savedConfig,
          accessKey: await decryptSetting(savedConfig.accessKey),
          secretKey: await decryptSetting(savedConfig.secretKey),
        }
        loadConfig(decrypted)
        s3ConfigLocal.value = decrypted
      }
    }
  } catch (err) {
    console.error("加载 S3 配置失败:", err)
  }

  // 加载工作区设置和路径
  await loadWorkspaceSettings()
  await detectWorkspacePath()

  // 初始化备份管理器
  initBackupManager()

  // 加载本地备份列表
  await loadLocalBackupList()

  // 自动刷新 S3 备份列表
  if (isConfigured.value) {
    await refreshBackupList()
  }

  // 注册自动备份事件监听
  window.addEventListener("autoBackupTrigger", handleAutoBackupTrigger)
})

onUnmounted(() => {
  window.removeEventListener("autoBackupTrigger", handleAutoBackupTrigger)
})
</script>

<style scoped lang="scss">
@use "./styles/index.scss";
</style>
