/**
 * S3 备份编排 composable
 *
 * 聚合 useS3Backup/useWorkspaceSettings/useLocalBackupList/useFullS3Upload/
 * useIncrementalPanel/useCloudBackupActions 六个领域 composable，
 * 统一持有备份管理器初始化、四入口互斥守卫（进入即置位、finally 复位）、
 * 自动备份触发与状态栏进度上报，以 reactive 聚合对象供面板与各 Tab 绑定。
 * 增量备份/还原的触发入口与实验 Tab 专属状态（清单信息/还原目录）由 useIncrementalPanel 提供。
 */
import { computed, reactive, ref, watch } from "vue"
import { showMessage } from "siyuan"
import { getNodeModules } from "@/utils/nodeModules"
import { getErrorMessage } from "@/utils/stringUtils"
import { useS3Backup } from "./useS3Backup"
import { useIncrementalPanel } from "./useIncrementalPanel"
import { useLocalBackupList } from "./useLocalBackupList"
import { useFullS3Upload } from "./useFullS3Upload"
import { useWorkspaceSettings } from "./useWorkspaceSettings"
import { useCloudBackupActions } from "./useCloudBackupActions"
import { useAutoBackupTrigger } from "./useAutoBackupTrigger"
import { useLocalZipBackup } from "./useLocalZipBackup"
import { useStatusBarTask } from "@/features/statusBar/composables/useStatusBarTask"
import { BackupManager } from "../modules/BackupManager"
import type { BackupResult } from "../modules/BackupManager"
import { getS3BackupInstance } from "../instance"
import { buildBackupUploadKey, makeBackupTimestamp } from "../utils"
import type { BackupLog, BackupMode, S3BackupStorage } from "../types"

/** 依赖注入：日志与校验值状态由宿主（index.vue）持有，编排层仅回调 */
export interface BackupOrchestratorDeps {
  i18n: Record<string, string>
  addLog: (entry: Omit<BackupLog, "id" | "time" | "hostname">) => void
  saveChecksum: (fileName: string, filePath: string, fileSize: number, checksum: string, persistNow?: boolean) => Promise<void>
  persistChecksums: () => Promise<void>
}

export function useBackupOrchestrator(deps: BackupOrchestratorDeps) {
  const { i18n, addLog } = deps

  // ========== 领域 composable 组合 ==========

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
    uploadFileSmart,
    getObjectText,
    deleteObject,
    listBackups,
    listExistingKeys,
    downloadBackup,
    loadConfig,
    getListPrefix,
  } = useS3Backup({
    i18n,
    // 惰性读取当前工作区子路径：s3SubPrefix 在下方 useWorkspaceSettings 中声明，
    // 该 getter 仅在运行时（刷新列表/去重）才求值，setup 阶段无 TDZ 风险
    getSubPrefix: () => s3SubPrefix.value,
  })

  // ========== 基础状态 ==========

  const isZipBackingUp = ref(false)

  // 状态栏后台任务：备份/还原进度显示在底部状态栏（自动备份时弹窗隐藏，状态栏是唯一可见反馈）
  const statusTask = useStatusBarTask("s3Backup", "mdi:cloud-upload")

  /** 持久化辅助：统一「获取实例 → 存储槽 save」样板 */
  async function persistStorage(save: (storage: S3BackupStorage) => Promise<unknown>): Promise<void> {
    const instance = getS3BackupInstance()
    if (instance) { await save(instance.getStorage()) }
  }

  // ========== Manager 实例 ==========

  let backupManager: BackupManager | null = null

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
  } = useWorkspaceSettings({
    getBackupManager: () => backupManager,
    // 路径变更时幂等创建/同步 BackupManager（覆盖启动时无工作区、之后才选择路径的场景）
    onWorkspaceUpdated: () => initBackupManager(),
    i18n,
  })

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

  /** S3 上传在桶中的完整路径预览（复用 useS3Backup.getListPrefix，消除重复拼接） */
  const resolvedS3Path = computed(() => {
    return getListPrefix()
  })

  // ========== 增量面板（运行标志+触发入口+清单信息/还原目录，实验 Tab 专属状态） ==========

  const {
    isIncrementalRunning,
    isIncrementalRestoring,
    lastRestoreDir,
    manifestInfo,
    isLoadingManifest,
    manifestLoadFailed,
    runIncrementalBackup,
    triggerIncrementalOnly,
    triggerIncrementalRestore,
    refreshIncrementalManifest,
    openRestoreFolder,
  } = useIncrementalPanel({
    i18n,
    addLog: (entry) => addLog(entry),
    getBackupManager: () => backupManager,
    uploadFileSmart,
    uploadFileContent,
    getObjectText,
    deleteObject,
    downloadObject: downloadBackup,
    isConfigured,
    s3Config,
    s3SubPrefix,
    workspaceRoot,
    localBackupDir,
    backupProgress,
    statusTask,
    // 互斥守卫惰性求值：isAnyTaskRunning 依赖本块解构的运行标志，构造期不可直接读值
    isAnyTaskRunning: () => isAnyTaskRunning.value,
    ensureWorkspaceReady,
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

  /** 幂等初始化/同步备份管理器：工作区路径就绪后可随时调用（含启动后首次选择路径场景） */
  function initBackupManager(): void {
    if (!workspaceRoot.value) { return }
    if (backupManager) {
      backupManager.updateWorkspacePaths(workspaceRoot.value)
    } else {
      backupManager = new BackupManager(workspaceRoot.value)
    }
    backupManager.setBackupDir(localBackupDir.value)
  }

  function onLocalBackupDirChanged(): void {
    if (backupManager) {
      backupManager.setBackupDir(localBackupDir.value)
    }
    saveWorkspaceSettings()
  }

  /** 备份模式变更：逐字段同步（reactive 定义模型）并持久化 */
  function onBackupModeChanged(mode: BackupMode): void {
    backupModeLocal.localZip = mode.localZip
    backupModeLocal.s3Upload = mode.s3Upload
    backupModeLocal.s3Incremental = mode.s3Incremental
    saveWorkspaceSettings()
  }

  /** 确保工作区路径就绪：未设置时提示并弹出目录选择，返回是否就绪（含用户取消） */
  async function ensureWorkspaceReady(): Promise<boolean> {
    if (workspacePath.value) { return true }
    showMessage(i18n.noWorkspace, 3000, "info")
    await selectWorkspacePath()
    return !!workspacePath.value
  }

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
    // 与自动上传共用 buildBackupUploadKey 统一 key 规则（日期段取备份文件自身日期），消除两套规则
    buildUploadKey: (fileName) => buildBackupUploadKey(
      s3Config.value.prefix,
      s3SubPrefix.value,
      fileName,
      useDateFolder.value,
      makeBackupTimestamp().slice(0, 8),
    ),
    uploadFileSmart,
    refreshBackupList: () => refreshBackupList(),
    addLog: (entry) => addLog(entry),
    i18n,
  })

  // ========== 本地 ZIP 备份流程（composable） ==========

  const { performLocalBackup, triggerZipBackupOnly } = useLocalZipBackup({
    i18n,
    addLog: (entry) => addLog(entry),
    getBackupManager: () => backupManager,
    backupProgress,
    useDateFolder,
    keepBackupCount,
    localBackupList,
    persistStorage,
    saveChecksum: deps.saveChecksum,
    isAnyTaskRunning,
    isZipBackingUp,
    ensureWorkspaceReady,
    statusTask,
  })

  // ========== S3 全量上传 / 云端操作（仅接线） ==========

  const { performS3Backup } = useFullS3Upload({
    getBackupManager: () => backupManager,
    isConfigured,
    s3Config,
    s3SubPrefix,
    useDateFolder,
    listExistingKeys,
    uploadFileSmart,
    backupProgress,
    addLog: (entry) => addLog(entry),
    saveChecksum: deps.saveChecksum,
    persistChecksums: deps.persistChecksums,
    recordUploadHosts,
    refreshBackupList: () => refreshBackupList(),
    i18n,
  })

  const { handleDownload, handleDelete } = useCloudBackupActions({
    workspaceRoot,
    localBackupDir,
    downloadBackup,
    deleteObject,
    addLog: (entry) => addLog(entry),
    i18n,
  })

  // 任务运行中实时同步进度到状态栏（还原与备份区分标签）；结束时的 complete/fail 由各入口函数显式调用
  // 注：watch 会在 setup 阶段立即求值源 computed，必须放在 isIncrementalRunning/isIncrementalRestoring 声明之后，否则触发 TDZ 错误
  watch([isAnyTaskRunning, backupProgress], () => {
    if (!isAnyTaskRunning.value) { return }
    statusTask.progress({
      // 状态栏主文本："还原中" / "备份中"
      label: isIncrementalRestoring.value ? i18n.statusRestoring : i18n.statusBackingUp,
      percent: backupProgress.value.percent,
      phase: phaseLabel.value,
    })
  })

  /** 刷新云端备份列表（listBackups 内部已吞异常，无需再包 try/catch） */
  async function refreshBackupList(): Promise<void> {
    if (!isConfigured.value) { return }
    await listBackups()
  }

  // ========== 备份操作 ==========

  /** 备份主流程；isAuto 为 true 时为定时触发（无人值守，不弹交互对话框）。返回是否成功，供自动路径失败时回滚防重标记 */
  async function performManualBackup(isAuto = false): Promise<boolean> {
    // backupManager 为 null 时记录警告日志，避免静默失败
    if (!backupManager) {
      console.warn("[S3备份] backupManager 未初始化，无法执行备份")
      return false
    }
    // 互斥守卫：任一备份/还原任务运行中都不启动新的全量流程（防止并发写共享进度与 manifest）
    if (isAnyTaskRunning.value) { return false }
    // 三个备份模式全关（或 S3 模式未配置）时直接跳过，避免空跑却更新备份时间并显示"备份完成"
    if (!canBackup.value) { return false }

    // 进入即置位：目录对话框挂起期间也纳入互斥范围，防止自动备份 tick 穿透空窗并发执行
    isBackingUp.value = true
    try {
      if (!workspacePath.value) {
        if (isAuto) {
          // 定时触发无人值守，不弹目录选择框，仅记日志跳过
          addLog({
            type: "autoBackup",
            action: i18n.autoBackup,
            fileName: "",
            success: false,
            message: i18n.noWorkspace,
          })
          return false
        }
        if (!(await ensureWorkspaceReady())) { return false }
      }

      // 根据备份模式分发
      let localResult: BackupResult | null = null
      if (backupModeLocal.localZip) {
        localResult = await performLocalBackup()
      }
      if (backupModeLocal.s3Upload) {
        // 同时勾选本地+S3 时，只上传本次生成的 ZIP，避免重复上传历史备份
        await performS3Backup(localResult)
      }
      if (backupModeLocal.s3Incremental) {
        // 增量上传 data/ 中新增/变更文件（逻辑全部在 useIncrementalBackup）
        await runIncrementalBackup()
      }

      // 更新备份时间并持久化（含定时器防重时间戳同步）
      await markBackupCompleted()
      // 状态栏："备份完成"
      statusTask.complete(i18n.statusBackupDone)
      return true
    } catch (err: unknown) {
      console.error("备份失败:", err)
      // 状态栏："备份失败"
      statusTask.fail(i18n.statusBackupFailed)
      showMessage(`${i18n.backupFailed}: ${getErrorMessage(err)}`, 5000, "error")
      return false
    } finally {
      isBackingUp.value = false
    }
  }

  // ========== 自动备份触发与定时器重启（composable） ==========

  const { handleAutoBackupTrigger, isInitialLoad } = useAutoBackupTrigger({
    i18n,
    isAnyTaskRunning,
    autoBackupEnabled,
    backupFrequency,
    backupTime,
    addLog: (entry) => addLog(entry),
    runAutoBackup: async () => {
      // performManualBackup 内部吞掉所有错误并返回是否成功；失败/跳过时回滚标记，允许下一 tick 重试
      const ok = await performManualBackup(true)
      if (!ok) {
        getS3BackupInstance()?.resetExecutionMarks()
      }
      return ok
    },
  })

  // ========== 初始化序列 ==========

  /** 面板挂载后的初始化：加载设置 → 检测路径 → 解除 watch 阻塞 → 初始化管理器与列表 */
  async function init(): Promise<void> {
    await loadWorkspaceSettings()
    await detectWorkspacePath()
    isInitialLoad.value = false
    initBackupManager()
    await loadLocalBackupList()
    if (isConfigured.value) {
      await refreshBackupList()
    }
  }

  // ========== 聚合导出 ==========

  return reactive({
    // 状态（ref 由 reactive 自动解包，模板/双向绑定可直接读写）
    s3Config,
    isConfigured,
    isBackingUp,
    isLoading,
    backupProgress,
    backupList,
    phaseLabel,
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
    resolvedLocalBackupPath,
    resolvedS3Path,
    canBackup,
    isAnyTaskRunning,
    isZipBackingUp,
    isIncrementalRunning,
    isIncrementalRestoring,
    // 增量实验 Tab 专属状态（来自 useIncrementalPanel）
    lastRestoreDir,
    manifestInfo,
    isLoadingManifest,
    manifestLoadFailed,
    localBackupList,
    isLoadingLocal,
    uploadingItems,
    uploadHostMap,
    // 方法
    testConnection,
    loadConfig,
    applyConfig,
    selectWorkspacePath,
    openWorkspaceFolder,
    saveWorkspaceSettings,
    onLocalBackupDirChanged,
    onBackupModeChanged,
    initBackupManager,
    loadLocalBackupList,
    deleteLocalBackup,
    uploadLocalBackup,
    isAlreadyUploaded,
    refreshBackupList,
    handleDownload,
    handleDelete,
    performManualBackup,
    triggerZipBackupOnly,
    triggerIncrementalOnly,
    triggerIncrementalRestore,
    // 增量实验 Tab 专属方法（来自 useIncrementalPanel）
    refreshIncrementalManifest,
    openRestoreFolder,
    handleAutoBackupTrigger,
    init,
    statusTask,
  })
}

/** 备份编排聚合对象类型（reactive 解包后），供 BackupTab/index.vue 的 props 与模板绑定 */
export type BackupOrchestrator = ReturnType<typeof useBackupOrchestrator>
