<!-- S3 备份主面板 — 备份/配置双 Tab 视图，编排子组件、自动备份触发、事件监听 -->
<template>
  <div class="s3-backup-panel">
    <!-- 头部 -->
    <div class="s3-backup-header">
      <span class="s3-backup-header-title">{{ i18n.s3Backup || "S3 备份" }}</span>
      <Button
        variant="ghost"
        size="xsmall"
        icon="close"
        @click="handleClose"
      />
    </div>

    <!-- Tab 栏 -->
    <div class="s3-tab-bar">
      <button
        class="s3-tab-btn"
        :class="{ active: activeTab === 'backup' }"
        @click="activeTab = 'backup'"
      >
        {{ i18n.backupTab || "备份" }}
      </button>
      <button
        class="s3-tab-btn"
        :class="{ active: activeTab === 'config' }"
        @click="activeTab = 'config'"
      >
        {{ i18n.configTab || "配置" }}
      </button>
      <button
        class="s3-tab-btn"
        :class="{ active: activeTab === 'log' }"
        @click="activeTab = 'log'"
      >
        {{ i18n.logTab || "日志" }}
      </button>
      <button
        class="s3-tab-btn"
        :class="{ active: activeTab === 'checksums' }"
        @click="activeTab = 'checksums'"
      >
        {{ i18n.checksumsTab || "校验" }}
      </button>
    </div>

    <!-- Tab: 备份 -->
    <div
      v-if="activeTab === 'backup'"
      class="settings-container"
    >
      <!-- 工作区信息 -->
      <WorkspaceInfoCard
        :workspace-path="workspacePath"
        :workspace-root="workspaceRoot"
        :last-backup-time="lastBackupTime"
        :i18n="i18n"
        @select-path="selectWorkspacePath"
        @open-folder="openWorkspaceFolder"
      />

      <!-- 备份进度（含独立压缩包/增量备份/还原运行期间） -->
      <BackupProgressSection
        v-if="isBackingUp || isZipBackingUp || isIncrementalRunning || isIncrementalRestoring"
        :progress="backupProgress"
        :phase-label="phaseLabel"
        :i18n="i18n"
      />

      <!-- 手动备份 -->
      <ManualBackupCard
        :is-any-task-running="isAnyTaskRunning"
        :is-backing-up="isBackingUp"
        :can-backup="canBackup"
        :is-configured="isConfigured"
        :workspace-path="workspacePath"
        :use-date-folder="useDateFolder"
        :local-backup-dir="localBackupDir"
        :s3-sub-prefix="s3SubPrefix"
        :resolved-local-backup-path="resolvedLocalBackupPath"
        :resolved-s3-path="resolvedS3Path"
        :backup-mode-local-zip="backupModeLocal.localZip"
        :backup-mode-s3-upload="backupModeLocal.s3Upload"
        :backup-mode-s3-incremental="backupModeLocal.s3Incremental"
        :is-zip-backing-up="isZipBackingUp"
        :is-incremental-running="isIncrementalRunning"
        :is-incremental-restoring="isIncrementalRestoring"
        :i18n="i18n"
        @perform-backup="performManualBackup"
        @trigger-zip-backup="triggerZipBackupOnly"
        @trigger-incremental="triggerIncrementalOnly"
        @trigger-incremental-restore="triggerIncrementalRestore"
        @update:use-date-folder="useDateFolder = $event; saveWorkspaceSettings()"
        @update:local-backup-dir="localBackupDir = $event; onLocalBackupDirChanged()"
        @update:s3-sub-prefix="s3SubPrefix = $event; saveWorkspaceSettings()"
      />

      <!-- 本地备份列表 -->
      <BackupListCard
        :title="i18n.localBackups"
        :empty-text="i18n.noLocalBackups"
        :items="localBackupList"
        :disable-refresh="isLoadingLocal || !workspaceRoot"
        :i18n="i18n"
        @refresh="loadLocalBackupList"
      >
        <template #actions="{ item }">
          <Button
            size="xsmall"
            :disabled="!isConfigured || uploadingItems[item.path] || isAlreadyUploaded(item.name)"
            @click="uploadLocalBackup(item)"
          >
            {{ isAlreadyUploaded(item.name) ? i18n.alreadyUploaded : i18n.uploadToS3 }}
          </Button>
          <Button variant="danger" size="xsmall" @click="deleteLocalBackup(item)">
            {{ i18n.delete }}
          </Button>
        </template>
      </BackupListCard>

      <!-- S3 备份列表 -->
      <BackupListCard
        :title="i18n.s3Backups"
        :empty-text="i18n.noBackups"
        :items="backupList"
        :disable-refresh="isLoading || !isConfigured"
        :i18n="i18n"
        :host-map="uploadHostMap"
        @refresh="refreshBackupList"
      >
        <template #actions="{ item }">
          <Button size="xsmall" @click="handleDownload(item)">
            {{ i18n.download }}
          </Button>
          <Button variant="danger" size="xsmall" @click="handleDelete(item)">
            {{ i18n.delete }}
          </Button>
        </template>
      </BackupListCard>
    </div>

    <!-- Tab: 配置 -->
    <div
      v-if="activeTab === 'config'"
      class="settings-container"
    >
      <BackupModeSelector
        :model-value="backupModeLocal"
        :i18n="i18n"
        @update:model-value="onBackupModeChanged"
      />

      <AutoBackupCard
        v-model:auto-backup-enabled="autoBackupEnabled"
        v-model:backup-frequency="backupFrequency"
        v-model:backup-time="backupTime"
        v-model:keep-backup-count="keepBackupCount"
        :i18n="i18n"
        @update:auto-backup-enabled="saveWorkspaceSettings()"
        @update:backup-frequency="saveWorkspaceSettings()"
        @update:backup-time="saveWorkspaceSettings()"
        @update:keep-backup-count="saveWorkspaceSettings()"
      />

      <section class="card-section">
        <S3ConfigForm
          :config="s3ConfigLocal"
          :i18n="i18n"
          :on-test-connection="testConnection"
          @saved="handleConfigSaved"
        />
      </section>
    </div>

    <!-- Tab: 日志 -->
    <div
      v-if="activeTab === 'log'"
      class="settings-container"
    >
      <BackupLogCard
        :logs="backupLogs"
        :i18n="i18n"
        @clear="clearLogs"
      />
    </div>

    <!-- Tab: 校验 -->
    <div
      v-if="activeTab === 'checksums'"
      class="settings-container"
    >
      <FileChecksumsCard
        :stored-items="checksums"
        :workspace-root="workspaceRoot"
        :i18n="i18n"
        @clear="clearChecksums"
        @remove-one="removeOneChecksum"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue"
import { Plugin, showMessage } from "siyuan"
import { getNodeModules } from "@/utils/nodeModules"
import { getErrorMessage } from "@/utils/stringUtils"
import { encryptSetting, decryptSetting } from "@/utils/settingsCrypto"
import { useS3Backup } from "./composables/useS3Backup"
import { useIncrementalBackup } from "./composables/useIncrementalBackup"
import { useBackupLogs } from "./composables/useBackupLogs"
import { useChecksums } from "./composables/useChecksums"
import { useLocalBackupList } from "./composables/useLocalBackupList"
import { useFullS3Upload } from "./composables/useFullS3Upload"
import { useWorkspaceSettings } from "./composables/useWorkspaceSettings"
import { useCloudBackupActions } from "./composables/useCloudBackupActions"
import { BackupManager } from "./modules/BackupManager"
import type { BackupResult } from "./modules/BackupManager"
import { getS3BackupInstance } from "./index"
import { buildS3Key, makeBackupTimestamp, isPluginBackupFile } from "./utils"
import type { S3Config, BackupMode, S3BackupStorage } from "./types"
import { DEFAULT_BACKUP_DIR } from "./types"
import S3ConfigForm from "./components/S3ConfigForm.vue"
import WorkspaceInfoCard from "./components/WorkspaceInfoCard.vue"
import BackupModeSelector from "./components/BackupModeSelector.vue"
import BackupProgressSection from "./components/BackupProgressSection.vue"
import ManualBackupCard from "./components/ManualBackupCard.vue"
import AutoBackupCard from "./components/AutoBackupCard.vue"
import BackupListCard from "./components/BackupListCard.vue"
import BackupLogCard from "./components/BackupLogCard.vue"
import FileChecksumsCard from "./components/FileChecksumsCard.vue"
import Button from "@/components/Button.vue"

// ========== Props ==========

interface Props {
  i18n?: Record<string, string>
  plugin?: Plugin | null
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
  applyConfig,
  uploadFileContent,
  getObjectText,
  deleteObject,
  listBackups,
  listExistingKeys,
  downloadBackup,
  loadConfig,
} = useS3Backup(props.i18n)

// ========== 基础状态 ==========

const activeTab = ref<"backup" | "config" | "log" | "checksums">("backup")
const isZipBackingUp = ref(false)

/** 持久化辅助：统一「获取实例 → 存储槽 save」样板 */
async function persistStorage(save: (storage: S3BackupStorage) => Promise<unknown>): Promise<void> {
  const instance = getS3BackupInstance()
  if (instance) { await save(instance.getStorage()) }
}

// ========== Manager 实例 ==========

let backupManager: BackupManager | null = null

// ========== 日志 / 校验值管理（composable） ==========

const { backupLogs, addLog, clearLogs } = useBackupLogs({ persist: persistStorage })
const { checksums, saveChecksum, persistChecksums, clearChecksums, removeOneChecksum } = useChecksums({ persist: persistStorage })

// ========== 工作区路径与备份设置（composable） ==========

const {
  workspacePath,
  workspaceRoot,
  lastBackupTime,
  useDateFolder,
  localBackupDir,
  s3SubPrefix,
  backupModeLocal,
  autoBackupEnabled,
  backupFrequency,
  backupTime,
  keepBackupCount,
  detectWorkspacePath,
  selectWorkspacePath,
  openWorkspaceFolder,
  loadWorkspaceSettings,
  saveWorkspaceSettings,
  markBackupCompleted,
} = useWorkspaceSettings({ getBackupManager: () => backupManager })

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
  return buildS3Key(s3Config.value?.prefix || "", s3SubPrefix.value, "")
})

// ========== 备份模式 ==========

function onBackupModeChanged(mode: BackupMode): void {
  backupModeLocal.localZip = mode.localZip
  backupModeLocal.s3Upload = mode.s3Upload
  backupModeLocal.s3Incremental = mode.s3Incremental
  saveWorkspaceSettings()
}

// ========== S3 配置本地引用 ==========

const s3ConfigLocal = ref<S3Config | null>(null)

// ========== 本地备份列表管理（composable） ==========

const {
  localBackupList,
  isLoadingLocal,
  uploadingItems,
  uploadHostMap,
  loadLocalBackupList,
  deleteLocalBackup,
  uploadLocalBackup,
  isAlreadyUploaded,
  recordUploadHosts,
} = useLocalBackupList({
  getBackupManager: () => backupManager,
  persist: persistStorage,
  getStorageHistory: async () => {
    const instance = getS3BackupInstance()
    return instance ? instance.getStorage().backupHistory.load() : null
  },
  isConfigured,
  backupList,
  buildUploadKey: (fileName) => buildS3Key(s3Config.value.prefix, s3SubPrefix.value, fileName),
  uploadFileContent,
  refreshBackupList: () => refreshBackupList(),
  addLog: (entry) => addLog(entry),
  i18n: props.i18n,
})

// ========== 计算属性 ==========

/** 是否有任一备份模式被选中 */
const canBackup = computed(() => {
  return backupModeLocal.localZip
    || ((backupModeLocal.s3Upload || backupModeLocal.s3Incremental) && isConfigured.value)
})

/** 是否有任一备份/还原任务正在运行（互斥守卫，防止流程并发写共享进度与 manifest） */
const isAnyTaskRunning = computed(() => {
  return isBackingUp.value || isZipBackingUp.value || isIncrementalRunning.value || isIncrementalRestoring.value
})

// ========== 备份管理器初始化 ==========

function initBackupManager(): void {
  if (workspacePath.value) {
    backupManager = new BackupManager(workspaceRoot.value)
    backupManager.setBackupDir(localBackupDir.value)
  }
}

function onLocalBackupDirChanged(): void {
  if (backupManager) {
    backupManager.setBackupDir(localBackupDir.value)
  }
  saveWorkspaceSettings()
}

// ========== S3 全量上传（逻辑在 useFullS3Upload，此处仅接线） ==========

const { performS3Backup } = useFullS3Upload({
  getBackupManager: () => backupManager,
  isConfigured,
  s3Config,
  s3SubPrefix,
  useDateFolder,
  listExistingKeys,
  uploadFileContent,
  backupProgress,
  addLog: (entry) => addLog(entry),
  saveChecksum,
  persistChecksums,
  recordUploadHosts,
  refreshBackupList: () => refreshBackupList(),
  i18n: props.i18n,
})

// ========== 增量备份（逻辑在 useIncrementalBackup，此处仅接线） ==========

const isIncrementalRunning = ref(false)
const isIncrementalRestoring = ref(false)

const { performIncrementalBackup, performIncrementalRestore } = useIncrementalBackup({
  getBackupManager: () => backupManager,
  uploadFileContent,
  getObjectText,
  deleteObject,
  downloadObject: downloadBackup,
  backupProgress,
  addLog: (entry) => addLog(entry),
  i18n: props.i18n,
})

/** 执行增量备份（传入当前 S3 前缀与子路径） */
async function runIncrementalBackup(): Promise<void> {
  if (!isConfigured.value) {
    throw new Error(props.i18n.s3NotConfigured)
  }
  await performIncrementalBackup(s3Config.value.prefix, s3SubPrefix.value)
}

/** 独立增量备份按钮（不依赖模式开关，单独触发一次增量上传） */
async function triggerIncrementalOnly(): Promise<void> {
  if (isAnyTaskRunning.value || !backupManager) { return }
  if (!workspacePath.value) {
    showMessage(props.i18n.noWorkspace || "请先选择工作区路径", 3000, "info")
    await selectWorkspacePath()
    if (!workspacePath.value) { return }
  }
  isIncrementalRunning.value = true
  try {
    await runIncrementalBackup()
  } catch (err: unknown) {
    showMessage(`${props.i18n.incrementalBackup}: ${getErrorMessage(err)}`, 5000, "error")
  } finally {
    isIncrementalRunning.value = false
  }
}

/** 增量还原：按云端 manifest 下载全部文件到本地备份目录下的时间戳还原文件夹 */
async function triggerIncrementalRestore(): Promise<void> {
  if (isAnyTaskRunning.value || !workspaceRoot.value || !pathModule) { return }
  if (!isConfigured.value) {
    showMessage(props.i18n.s3NotConfigured, 3000, "error")
    return
  }
  const confirmed = confirm(props.i18n.confirmIncrementalRestore)
  if (!confirmed) { return }
  isIncrementalRestoring.value = true
  try {
    const targetDir = pathModule.join(
      workspaceRoot.value,
      localBackupDir.value || DEFAULT_BACKUP_DIR,
      `incremental-restore-${makeBackupTimestamp()}`,
    )
    await performIncrementalRestore(s3Config.value.prefix, s3SubPrefix.value, targetDir)
  } catch (err: unknown) {
    showMessage(`${props.i18n.incrementalRestore}: ${getErrorMessage(err)}`, 5000, "error")
  } finally {
    isIncrementalRestoring.value = false
  }
}


// ========== S3 配置管理 ==========

/** 子组件 saved 事件携带完整配置：同步本地引用 + 应用 + 加密持久化 */
async function handleConfigSaved(config: S3Config): Promise<void> {
  s3ConfigLocal.value = config
  applyConfig(config)

  const instance = getS3BackupInstance()
  if (instance) {
    // A8 修复：S3 凭证加密存储，防止 accessKey/secretKey 明文暴露
    const encrypted: S3Config = {
      ...config,
      accessKey: await encryptSetting(config.accessKey),
      secretKey: await encryptSetting(config.secretKey),
    }
    await instance.getStorage().s3Config.save(encrypted)
  }
  showMessage(props.i18n.configSaved, 2000, "info")
}

// ========== 备份操作 ==========

async function performManualBackup(): Promise<void> {
  // A7 修复：backupManager 为 null 时记录警告日志，避免静默失败
  if (!backupManager) {
    console.warn("[S3备份] backupManager 未初始化，无法执行备份")
    return
  }
  // 互斥守卫：任一备份/还原任务运行中都不启动新的全量流程（防止并发写共享进度与 manifest）
  if (isAnyTaskRunning.value) { return }

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
    if (backupModeLocal.s3Incremental) {
      // 增量上传 data/ 中新增/变更文件（逻辑全部在 useIncrementalBackup）
      await runIncrementalBackup()
    }

    // 更新备份时间并持久化（含定时器防重时间戳同步）
    await markBackupCompleted()
  } catch (err: unknown) {
    console.error("备份失败:", err)
    showMessage(`${props.i18n.backupFailed || "备份失败"}: ${getErrorMessage(err)}`, 5000, "error")
  } finally {
    isBackingUp.value = false
    // B13 修复：移除 finally 中重复的 saveWorkspaceSettings()，try 块已通过 instance 保存
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
    // 仅物理删除插件命名规则（data-*.zip）的文件，用户手工放入的归档只移出列表不动磁盘
    if (localBackupList.value.length > keepBackupCount.value) {
      const toDelete = localBackupList.value.slice(keepBackupCount.value)
      for (const old of toDelete) {
        if (!isPluginBackupFile(old.name)) { continue }
        try {
          await backupManager.deleteBackupFile(old.path)
        } catch (err) {
          console.warn(`删除旧备份失败: ${old.name}`, err)
        }
      }
      localBackupList.value = localBackupList.value.slice(0, keepBackupCount.value)
    }

    await persistStorage((s) => s.backupHistory.save({ list: localBackupList.value }))

    showMessage(`本地备份成功: ${result.fileName}（${result.totalFiles} 文件）`, 3000, "info")
    addLog({
      type: "localZip",
      action: props.i18n.localZipBackup || "本地压缩备份",
      fileName: result.fileName,
      fileSize: result.size,
      success: true,
      message: `${result.totalFiles} 文件`,
    })
    // 计算 ZIP 文件校验值并持久化
    try {
      const hash = await backupManager.computeFileHash(result.filePath)
      await saveChecksum(result.fileName, result.filePath, result.size, hash)
    } catch (hashErr: unknown) {
      console.warn("计算文件校验值失败:", getErrorMessage(hashErr))
    }
    return result
  } catch (err: unknown) {
    addLog({
      type: "localZip",
      action: props.i18n.localZipBackup || "本地压缩备份",
      fileName: "",
      success: false,
      message: getErrorMessage(err),
    })
    throw new Error(`本地备份: ${getErrorMessage(err)}`)
  }
}

/** 独立压缩包备份按钮（不依赖模式开关，直接执行本地 ZIP 打包） */
async function triggerZipBackupOnly(): Promise<void> {
  if (isAnyTaskRunning.value || !backupManager) { return }
  if (!workspacePath.value) {
    showMessage(props.i18n.noWorkspace || "请先选择工作区路径", 3000, "info")
    await selectWorkspacePath()
    if (!workspacePath.value) { return }
  }
  isZipBackingUp.value = true
  try {
    await performLocalBackup()
  } catch (err: unknown) {
    showMessage(`${props.i18n.zipBackup}: ${getErrorMessage(err)}`, 5000, "error")
  } finally {
    isZipBackingUp.value = false
  }
}

// ========== 自动备份触发 ==========

async function handleAutoBackupTrigger(): Promise<void> {
  // 定时触发不经过 UI 按钮禁用，需自行互斥：另一任务运行中时跳过并记日志
  if (isAnyTaskRunning.value) {
    addLog({
      type: "autoBackup",
      action: props.i18n.autoBackup,
      fileName: "",
      success: false,
      message: props.i18n.autoBackupSkippedBusy,
    })
    return
  }
  await performManualBackup()
}

// ========== 定时器重启 ==========

// B14 修复：初始化完成后才允许 watch 触发定时器重启，避免与 initAutoBackup 重复启动
const isInitialLoad = ref(true)

function handleTimerRestart(): void {
  if (isInitialLoad.value) { return }
  const s3Backup = getS3BackupInstance()
  if (s3Backup) {
    s3Backup.restartAutoBackupTimer(autoBackupEnabled.value, backupFrequency.value, backupTime.value)
  }
}

watch(
  [backupFrequency, backupTime, autoBackupEnabled],
  () => handleTimerRestart(),
)

// ========== S3 备份管理 ==========

/** 刷新云端备份列表（listBackups 内部已吞异常，无需再包 try/catch） */
async function refreshBackupList(): Promise<void> {
  if (!isConfigured.value) { return }
  await listBackups()
}

// ========== 云端备份下载 / 删除（composable） ==========

const { handleDownload, handleDelete } = useCloudBackupActions({
  workspaceRoot,
  localBackupDir,
  downloadBackup,
  deleteObject,
  addLog: (entry) => addLog(entry),
  i18n: props.i18n,
})

// ========== 对话框关闭 ==========

function handleClose(): void {
  if (isAnyTaskRunning.value) {
    // 关闭确认："正在备份中，关闭窗口不会中断备份。确定要隐藏窗口吗？"
    if (!confirm(props.i18n.closeWhileBackingUp)) { return }
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

  // 加载工作区设置和路径（加载完成后解除 watch 阻塞）
  await loadWorkspaceSettings()
  await detectWorkspacePath()
  isInitialLoad.value = false

  // 初始化备份管理器
  initBackupManager()

  // 加载本地备份列表
  await loadLocalBackupList()

  // 自动刷新 S3 备份列表
  if (isConfigured.value) {
    await refreshBackupList()
  }

  // 并行加载操作日志 / 校验值 / 上传来源映射（复用同一 instance）
  if (instance) {
    const storage = instance.getStorage()
    await Promise.all([
      storage.backupLogs.load().then((data) => {
        if (data?.logs) { backupLogs.value = data.logs }
      }).catch(() => { /* ignore */ }),
      storage.checksums.load().then((data) => {
        if (data?.items) { checksums.value = data.items }
      }).catch(() => { /* ignore */ }),
      storage.uploadHostMap.load().then((data) => {
        if (data?.map) { uploadHostMap.value = data.map }
      }).catch(() => { /* ignore */ }),
    ])
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
