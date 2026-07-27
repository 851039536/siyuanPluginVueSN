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
        :title="i18n.localBackups || '本地备份列表'"
        :empty-text="i18n.noLocalBackups || '暂无本地备份'"
        :items="localBackupList"
        :disable-refresh="isLoadingLocal || !workspaceRoot"
        :i18n="i18n"
        @refresh="refreshLocalBackupList"
      >
        <template #actions="{ item }">
          <Button
            size="xsmall"
            :disabled="!isConfigured || uploadingItems[item.path] || isAlreadyUploaded(item.name)"
            @click="uploadLocalBackup(item)"
          >
            {{ isAlreadyUploaded(item.name) ? (i18n.alreadyUploaded || '已上传') : i18n.uploadToS3 }}
          </Button>
          <Button variant="danger" size="xsmall" @click="deleteLocalBackup(item)">
            {{ i18n.delete }}
          </Button>
        </template>
      </BackupListCard>

      <!-- S3 备份列表 -->
      <BackupListCard
        :title="i18n.s3Backups || '云端备份列表'"
        :empty-text="i18n.noBackups || '暂无云端备份'"
        :items="backupList"
        time-key="lastModified"
        :disable-refresh="isLoading || !isConfigured"
        :i18n="i18n"
        :host-map="uploadHostMap"
        @refresh="refreshBackupList"
      >
        <template #actions="{ item }">
          <Button size="xsmall" @click="handleDownload(item)">
            {{ i18n.download || "下载" }}
          </Button>
          <Button variant="danger" size="xsmall" @click="handleDelete(item)">
            {{ i18n.delete || "删除" }}
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
        :auto-backup-enabled="autoBackupEnabled"
        :backup-frequency="backupFrequency"
        :backup-time="backupTime"
        :keep-backup-count="keepBackupCount"
        :i18n="i18n"
        @update:auto-backup-enabled="autoBackupEnabled = $event; saveWorkspaceSettings()"
        @update:backup-frequency="backupFrequency = $event; saveWorkspaceSettings()"
        @update:backup-time="backupTime = $event; saveWorkspaceSettings()"
        @update:keep-backup-count="keepBackupCount = $event; saveWorkspaceSettings()"
      />

      <section class="card-section">
        <S3ConfigForm
          :config="s3ConfigLocal"
          :i18n="i18n"
          :on-test-connection="testConnection"
          @config-changed="handleConfigChanged"
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
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue"
import { Plugin, showMessage } from "siyuan"
import { getWorkspaceDir } from "@/api"
import { pickDirectory, openFolderInExplorer } from "@/utils/electronDialog"
import { getNodeModules } from "@/utils/nodeModules"
import { getErrorMessage } from "@/utils/stringUtils"
import { encryptSetting, decryptSetting } from "@/utils/settingsCrypto"
import { useS3Backup } from "./composables/useS3Backup"
import { useIncrementalBackup } from "./composables/useIncrementalBackup"
import { BackupManager } from "./modules/BackupManager"
import type { BackupResult, WorkspaceFile } from "./modules/BackupManager"
import { getS3BackupInstance } from "./index"
import { buildS3Key, makeBackupTimestamp, getHostname } from "./utils"
import type { S3Config, LocalBackupInfo, BackupMode, BackupLog, FileChecksum, S3BackupStorage } from "./types"
import { DEFAULT_BACKUP_MODE, DEFAULT_BACKUP_DIR, MAX_LOG_COUNT, MAX_LOCAL_BACKUP_COUNT } from "./types"
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
  saveConfig,
  uploadFileContent,
  getObjectText,
  deleteObject,
  listBackups,
  listExistingKeys,
  downloadBackup,
  deleteBackup,
  loadConfig,
} = useS3Backup(props.i18n)

// ========== 基础状态 ==========

const activeTab = ref<"backup" | "config" | "log" | "checksums">("backup")
const workspacePath = ref("")
const workspaceRoot = ref("")
const lastBackupTime = ref("")
const useDateFolder = ref(true)
const localBackupDir = ref("data-backup")
const s3SubPrefix = ref("data-backup")
const isZipBackingUp = ref(false)
const backupLogs = ref<BackupLog[]>([])
const checksums = ref<FileChecksum[]>([])
const uploadHostMap = ref<Record<string, string>>({})

/** 持久化辅助：统一「获取实例 → 存储槽 save」样板 */
async function persistStorage(save: (storage: S3BackupStorage) => Promise<unknown>): Promise<void> {
  const instance = getS3BackupInstance()
  if (instance) { await save(instance.getStorage()) }
}

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

const backupModeLocal = reactive<BackupMode>({ ...DEFAULT_BACKUP_MODE })

function onBackupModeChanged(mode: BackupMode): void {
  backupModeLocal.localZip = mode.localZip
  backupModeLocal.s3Upload = mode.s3Upload
  backupModeLocal.s3Incremental = mode.s3Incremental
  saveWorkspaceSettings()
}

// ========== 自动备份设置 ==========

const autoBackupEnabled = ref(false)
const backupFrequency = ref("daily")
const backupTime = ref("03:00")
const keepBackupCount = ref(7)

// ========== 本地备份列表 ==========

const localBackupList = ref<LocalBackupInfo[]>([])
const isLoadingLocal = ref(false)
const uploadingItems = ref<Record<string, boolean>>({})

let lastBackupTimestamp = 0

// ========== S3 配置本地引用 ==========

const s3ConfigLocal = ref<S3Config | null>(null)

// ========== Manager 实例 ==========

let backupManager: BackupManager | null = null

// ========== 计算属性 ==========

/** 是否有任一备份模式被选中 */
const canBackup = computed(() => {
  return backupModeLocal.localZip
    || ((backupModeLocal.s3Upload || backupModeLocal.s3Incremental) && isConfigured.value)
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
    throw new Error("S3 未配置，请先完成 S3 连接配置")
  }
  await performIncrementalBackup(s3Config.value.prefix, s3SubPrefix.value)
}

/** 独立增量备份按钮（不依赖模式开关，单独触发一次增量上传） */
async function triggerIncrementalOnly(): Promise<void> {
  if (isIncrementalRunning.value || !backupManager) { return }
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
  if (isIncrementalRestoring.value || !workspaceRoot.value || !pathModule) { return }
  if (!isConfigured.value) {
    showMessage("S3 未配置，请先完成 S3 连接配置", 3000, "error")
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

// ========== 工作区路径管理 ==========

function updateWorkspacePath(root: string, shouldSave = false): void {
  workspaceRoot.value = root
  workspacePath.value = root
  if (backupManager) {
    backupManager.updateWorkspacePaths(workspaceRoot.value)
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
    if (backupModeLocal.s3Incremental) {
      // 增量上传 data/ 中新增/变更文件（逻辑全部在 useIncrementalBackup）
      await runIncrementalBackup()
    }

    // 更新备份时间
    lastBackupTime.value = new Date().toLocaleString()
    lastBackupTimestamp = Date.now()
    const instance = getS3BackupInstance()
    if (instance) {
      instance.updateLastBackupTime(lastBackupTimestamp)
      await instance.saveWorkspaceSettings(buildWorkspaceSettings())
    }
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
      saveChecksum(result.fileName, result.filePath, result.size, hash)
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

/** 构建 S3 对象 key（复用 utils.buildS3Key，日期子文件夹由 useDateFolder 控制） */
function makeS3Key(relativePath: string, timestamp: string): string {
  return buildS3Key(s3Config.value.prefix, s3SubPrefix.value, relativePath, useDateFolder.value ? timestamp : "")
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

  const timestamp = makeBackupTimestamp()
  // B10 修复：复用顶层缓存的 node 实例
  if (!node) {
    throw new Error("无法访问文件系统，请使用桌面版思源笔记")
  }
  const fs = node.fs.promises

  // 去重优化：上传前先获取 S3 已有文件列表，已存在的文件跳过上传
  let existingKeys: Set<string> = new Set()
  // fetchBackupList 成功时已同步更新 backupList，无需备份结束后再次拉取
  let listFailed = false
  try {
    existingKeys = await listExistingKeys()
    console.log(`[S3备份] 去重检查：S3 已有 ${existingKeys.size} 个文件`)
    if (existingKeys.size > 0 && files.length > 0) {
      // 打印前 3 个已有 key 和前 3 个待上传 key 供诊断对比
      const sampleExisting = [...existingKeys].slice(0, 3)
      const sampleNew: string[] = []
      for (let i = 0; i < Math.min(3, files.length); i++) {
        sampleNew.push(makeS3Key(files[i].relativePath, timestamp))
      }
      console.log("[S3备份] S3 已有 key 示例:", sampleExisting)
      console.log("[S3备份] 待上传 key 示例:", sampleNew)
    }
  } catch (err: unknown) {
    listFailed = true
    console.warn("[S3备份] 无法获取 S3 文件列表，将上传全部文件:", err)
  }

  let skippedCount = 0
  let uploadedCount = 0
  let processedCount = 0 // 已处理文件数（含跳过 + 上传）

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const s3Key = makeS3Key(file.relativePath, timestamp)

    // 去重：S3 上已存在的文件跳过上传
    if (existingKeys.has(s3Key)) {
      skippedCount++
      processedCount++
      console.log(`[S3备份] 跳过已存在: ${s3Key}`)
      backupProgress.value = {
        phase: "uploading",
        currentFile: `${file.relativePath} (已跳过)`,
        filesProcessed: processedCount,
        totalFiles: files.length,
        percent: Math.round((processedCount / files.length) * 100),
      }
      continue
    }

    backupProgress.value = {
      phase: "uploading",
      currentFile: file.relativePath,
      filesProcessed: processedCount + 1,
      totalFiles: files.length,
      percent: Math.round((processedCount / files.length) * 100),
    }

    let content
    try {
      content = await fs.readFile(file.fullPath)
    } catch (readErr: unknown) {
      console.warn(`跳过无法读取的文件: ${file.relativePath}`, getErrorMessage(readErr))
      processedCount++
      continue
    }
    await uploadFileContent(content, s3Key)
    // 上传成功后计算并保存校验值
    try {
      const hash = await backupManager.computeFileHash(file.fullPath)
      saveChecksum(file.relativePath, file.fullPath, content.length, hash)
    } catch (hashErr: unknown) {
      console.warn("计算校验值失败:", file.relativePath, getErrorMessage(hashErr))
    }
    uploadedCount++
    processedCount++
  }

  backupProgress.value = {
    phase: "uploading",
    currentFile: "",
    filesProcessed: processedCount,
    totalFiles: files.length,
    percent: 100,
  }

  // 构建结果消息
  let msg = `${props.i18n.backupSuccess || "备份上传成功"}: 上传 ${uploadedCount} 个文件`
  if (skippedCount > 0) {
    msg += `，跳过 ${skippedCount} 个已存在文件`
  }
  showMessage(msg, 3000, "info")

  addLog({
    type: "s3Upload",
    action: props.i18n.s3Upload || "S3 上传",
    fileName: uploadedCount > 1 ? `${uploadedCount} 个文件` : (files[0]?.relativePath || ""),
    success: true,
    message: skippedCount > 0 ? `跳过 ${skippedCount}` : undefined,
  })

  // 批量记录上传来源：以时间戳前缀为 key 标记本机上传
  const batchHostname = getHostname()
  if (batchHostname && uploadedCount > 0) {
    for (const file of files) {
      const fileName = file.relativePath.split("/").pop() || file.relativePath
      uploadHostMap.value[fileName] = batchHostname
    }
    await persistStorage((s) => s.uploadHostMap.save({ map: uploadHostMap.value }))
  }

  // 列表已在去重检查时刷新；仅当去重列举失败时兜底刷新一次
  if (listFailed) {
    await refreshBackupList()
  }
}

/** 独立压缩包备份按钮（不依赖模式开关，直接执行本地 ZIP 打包） */
async function triggerZipBackupOnly(): Promise<void> {
  if (isZipBackingUp.value || isBackingUp.value || !backupManager) { return }
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

// ========== 本地备份管理 ==========

async function loadLocalBackupList(): Promise<void> {
  localBackupList.value = []
  try {
    if (backupManager) {
      const scanned = await backupManager.scanBackupDir()
      if (scanned.length > 0) {
        localBackupList.value = scanned.slice(0, MAX_LOCAL_BACKUP_COUNT)
        await persistStorage((s) => s.backupHistory.save({ list: localBackupList.value }))
        return
      }
    }
    const instance = getS3BackupInstance()
    if (instance) {
      const history = await instance.getStorage().backupHistory.load()
      if (history?.list) {
        localBackupList.value = history.list.slice(0, MAX_LOCAL_BACKUP_COUNT)
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

async function deleteLocalBackup(backup: Record<string, any>): Promise<void> {
  try {
    const confirmDelete = confirm(props.i18n.confirmDelete || "确定要删除此备份吗？")
    if (!confirmDelete) { return }
    if (backupManager) {
      await backupManager.deleteBackupFile(backup.path)
    }
    // A11 修复：按 path 过滤而非 name，避免同名文件误删
    localBackupList.value = localBackupList.value.filter((b) => b.path !== backup.path)
    await persistStorage((s) => s.backupHistory.save({ list: localBackupList.value }))
    showMessage(props.i18n.deleteSuccess || "删除成功", 2000, "info")
  } catch (error) {
    console.error("删除本地备份失败:", error)
    showMessage(props.i18n.deleteFailed || "删除失败", 3000, "error")
  }
}

async function uploadLocalBackup(backup: Record<string, any>): Promise<void> {
  if (!node || !isConfigured.value) { return }
  // 检查 S3 上是否已存在同名文件，已存在则提示并跳过
  if (isAlreadyUploaded(backup.name)) {
    showMessage(props.i18n.alreadyUploaded || "该文件已上传过，无需重复上传", 3000, "info")
    return
  }
  uploadingItems.value = { ...uploadingItems.value, [backup.path]: true }
  try {
    const content = await node.fs.promises.readFile(backup.path)
    const s3Key = buildS3Key(s3Config.value.prefix, s3SubPrefix.value, backup.name)
    await uploadFileContent(content, s3Key)
    await recordUploadHost(backup.name)
    addLog({ type: "s3Upload", action: props.i18n.uploadToS3 || "上传到 S3", fileName: backup.name, success: true })
    showMessage(props.i18n.uploadSuccess || "上传成功", 2000, "info")
    await refreshBackupList()
  } catch (err: unknown) {
    addLog({ type: "s3Upload", action: props.i18n.uploadToS3 || "上传到 S3", fileName: backup.name, success: false, message: getErrorMessage(err) })
    showMessage(`${props.i18n.uploadFailed || "上传失败"}: ${getErrorMessage(err)}`, 5000, "error")
  } finally {
    uploadingItems.value = { ...uploadingItems.value, [backup.path]: false }
  }
}

/** 检查文件名是否已存在于 S3 备份列表 */
function isAlreadyUploaded(fileName: string): boolean {
  return backupList.value.some((f) => f.name === fileName || f.key.endsWith(`/${fileName}`))
}

/** 记录文件上传来源设备名并持久化 */
async function recordUploadHost(fileName: string): Promise<void> {
  const hostname = getHostname()
  if (!hostname) { return }
  uploadHostMap.value = { ...uploadHostMap.value, [fileName]: hostname }
  await persistStorage((s) => s.uploadHostMap.save({ map: uploadHostMap.value }))
}

// ========== S3 备份管理 ==========

async function refreshBackupList(): Promise<void> {
  if (!isConfigured.value) { return }
  try {
    await listBackups()
  } catch (err: unknown) {
    console.error("刷新备份列表失败:", err)
  }
}

// B7 修复：提取公共方法，消除 handleDownload/handleRestore 核心逻辑重复
async function downloadToLocalDir(backup: Record<string, any>): Promise<string> {
  if (!node) { throw new Error("无法访问文件系统，请使用桌面版思源笔记") }
  const fs = node.fs.promises
  const pathModule = node.path

  const downloadDir = `${workspaceRoot.value}/${localBackupDir.value || "data-backup"}`
  await fs.mkdir(downloadDir, { recursive: true })
  const localPath = pathModule.join(downloadDir, backup.name)

  await downloadBackup(backup.key, localPath)
  return localPath
}

async function handleDownload(backup: Record<string, any>): Promise<void> {
  try {
    await downloadToLocalDir(backup)
    addLog({
      type: "s3Download",
      action: props.i18n.download || "下载",
      fileName: backup.name,
      success: true,
    })
    showMessage(props.i18n.downloadSuccess || "下载成功", 2000, "info")
  } catch (err: unknown) {
    addLog({
      type: "s3Download",
      action: props.i18n.download || "下载",
      fileName: backup.name,
      success: false,
      message: getErrorMessage(err),
    })
    showMessage(`${props.i18n.downloadFailed || "下载失败"}: ${getErrorMessage(err)}`, 5000, "error")
  }
}

async function handleDelete(backup: Record<string, any>): Promise<void> {
  const confirmed = confirm(props.i18n.confirmDelete || "确定要删除此备份吗？")
  if (!confirmed) { return }

  try {
    await deleteBackup(backup.key)
    addLog({
      type: "s3Delete",
      action: props.i18n.delete || "删除",
      fileName: backup.name,
      success: true,
    })
    showMessage(props.i18n.deleteSuccess || "删除成功", 2000, "info")
  } catch (err: unknown) {
    addLog({
      type: "s3Delete",
      action: props.i18n.delete || "删除",
      fileName: backup.name,
      success: false,
      message: getErrorMessage(err),
    })
    showMessage(`${props.i18n.deleteFailed || "删除失败"}: ${getErrorMessage(err)}`, 5000, "error")
  }
}

// ========== 日志管理 ==========

function addLog(entry: Omit<BackupLog, "id" | "time" | "hostname">): void {
  const log: BackupLog = {
    ...entry,
    id: Date.now().toString(),
    time: new Date().toISOString(),
    hostname: getHostname(),
  }
  backupLogs.value.unshift(log)
  if (backupLogs.value.length > MAX_LOG_COUNT) {
    backupLogs.value = backupLogs.value.slice(0, MAX_LOG_COUNT)
  }
  saveLogs()
}

async function saveLogs(): Promise<void> {
  await persistStorage((s) => s.backupLogs.save({ logs: backupLogs.value }))
}

async function clearLogs(): Promise<void> {
  backupLogs.value = []
  await saveLogs()
}

// ========== 校验值管理 ==========

function saveChecksum(fileName: string, filePath: string, fileSize: number, checksum: string): void {
  const item: FileChecksum = {
    fileName,
    filePath,
    checksum,
    fileSize,
    time: new Date().toISOString(),
  }
  // 同名覆盖
  const idx = checksums.value.findIndex((c) => c.fileName === fileName)
  if (idx >= 0) {
    checksums.value[idx] = item
  } else {
    checksums.value.unshift(item)
  }
  saveChecksums()
}

async function saveChecksums(): Promise<void> {
  await persistStorage((s) => s.checksums.save({ items: checksums.value }))
}

async function clearChecksums(): Promise<void> {
  checksums.value = []
  await saveChecksums()
}

async function removeOneChecksum(fileName: string): Promise<void> {
  checksums.value = checksums.value.filter((c) => c.fileName !== fileName)
  await saveChecksums()
}

// ========== 设置持久化 ==========

async function loadWorkspaceSettings(): Promise<void> {
  try {
    const instance = getS3BackupInstance()
    if (instance) {
      // loadOrDefault 已与 DEFAULT_BACKUP_SETTINGS 浅合并，字段保证完整，无需逐字段兜底
      const data = await instance.loadWorkspaceSettings()
      lastBackupTime.value = data.lastBackupTime
      useDateFolder.value = data.useDateFolder
      autoBackupEnabled.value = data.autoBackupEnabled
      backupFrequency.value = data.backupFrequency
      backupTime.value = data.backupTime
      keepBackupCount.value = data.keepBackupCount
      lastBackupTimestamp = data.lastBackupTimestamp
      // 空字符串视为未设置，回退默认目录
      localBackupDir.value = data.localBackupDir || DEFAULT_BACKUP_DIR
      s3SubPrefix.value = data.s3SubPrefix || DEFAULT_BACKUP_DIR

      // 备份模式（同一份数据，无需二次读取存储）
      if (data.backupMode) {
        backupModeLocal.localZip = data.backupMode.localZip ?? true
        backupModeLocal.s3Upload = data.backupMode.s3Upload ?? false
        // 旧数据缺 s3Incremental 字段（浅合并不补嵌套字段），显式兜底为关闭
        backupModeLocal.s3Incremental = data.backupMode.s3Incremental ?? false
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

/** 构建持久化设置对象（消除 performManualBackup 与 saveWorkspaceSettings 的参数重复构造） */
function buildWorkspaceSettings() {
  return {
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
  }
}

async function saveWorkspaceSettings(): Promise<void> {
  try {
    const instance = getS3BackupInstance()
    if (instance) {
      await instance.saveWorkspaceSettings(buildWorkspaceSettings())
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
