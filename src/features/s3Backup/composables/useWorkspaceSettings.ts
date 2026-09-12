/**
 * 工作区路径与备份设置管理 composable
 *
 * 拥有工作区路径、备份模式、自动备份设置等持久化状态，
 * 提供路径检测/选择、设置加载/保存与备份完成时间标记能力。
 * 通过 getS3BackupInstance 与插件实例侧的设置存储同步。
 */
import { reactive, ref } from "vue"
import { showMessage } from "siyuan"
import { getWorkspaceDir } from "@/api"
import { pickDirectory, openFolderInExplorer } from "@/utils/electronDialog"
import type { BackupManager } from "../modules/BackupManager"
import type { BackupMode, BackupFrequency } from "../types"
import { DEFAULT_BACKUP_MODE, DEFAULT_BACKUP_DIR } from "../types"
import { getS3BackupInstance } from "../instance"

/** 依赖注入：backupManager 由 index.vue 持有（初始化时机在 onMounted） */
export interface WorkspaceSettingsDeps {
  getBackupManager: () => BackupManager | null
  /** 工作区路径变更后回调：由宿主幂等创建/同步 BackupManager（覆盖启动后首次选择路径场景） */
  onWorkspaceUpdated?: () => void
  i18n: Record<string, string>
}

export function useWorkspaceSettings(deps: WorkspaceSettingsDeps) {
  const { i18n } = deps

  // 工作区根目录为运行时单一事实源（持久化对象的 workspacePath 字段仅作旧数据兼容保留）
  const workspaceRoot = ref("")
  const lastBackupTime = ref("")
  const useDateFolder = ref(true)
  const localBackupDir = ref(DEFAULT_BACKUP_DIR)
  const s3SubPrefix = ref(DEFAULT_BACKUP_DIR)
  const backupModeLocal = reactive<BackupMode>({ ...DEFAULT_BACKUP_MODE })
  const autoBackupEnabled = ref(false)
  const backupFrequency = ref<BackupFrequency>("daily")
  const backupTime = ref("03:00")
  const keepBackupCount = ref(7)

  // ========== 工作区路径 ==========

  function applyWorkspaceRoot(root: string, shouldSave = false): void {
    workspaceRoot.value = root
    // 通知宿主幂等创建/同步 BackupManager（启动时无工作区、之后才选择路径时在此补建）
    deps.onWorkspaceUpdated?.()
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
    // 已有路径（loadWorkspaceSettings 的持久化兜底或此前检测过）时无需重复检测
    if (workspaceRoot.value) { return }
    const apiPath = await fetchWorkspacePath()
    if (apiPath) {
      applyWorkspaceRoot(apiPath)
    }
  }

  async function selectWorkspacePath(): Promise<void> {
    if (!workspaceRoot.value) {
      const wsPath = await fetchWorkspacePath()
      if (wsPath) {
        applyWorkspaceRoot(wsPath, true)
        showMessage(i18n.workspaceAutoDetected, 2000, "info")
        return
      }
    }
    const selectedPath = await pickDirectory(i18n.selectWorkspaceTitle)
    if (selectedPath) {
      applyWorkspaceRoot(selectedPath, true)
      showMessage(i18n.workspacePathSet, 2000, "info")
    }
  }

  async function openWorkspaceFolder(): Promise<void> {
    if (!workspaceRoot.value) { return }
    const opened = await openFolderInExplorer(workspaceRoot.value)
    if (!opened) {
      showMessage(`${i18n.workspacePath}: ${workspaceRoot.value}`, 3000, "info")
    }
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

        // 持久化路径兜底：API 不可用时从设置恢复（detectWorkspacePath 检测到已有路径会跳过 API）
        if (!workspaceRoot.value && data.workspaceRoot) {
          workspaceRoot.value = data.workspaceRoot
        }
      }
    } catch (err) {
      console.error("加载工作区设置失败:", err)
    }
  }

  /** 构建持久化设置对象（消除 markBackupCompleted 与 saveWorkspaceSettings 的参数重复构造） */
  function buildWorkspaceSettings() {
    return {
      lastBackupTime: lastBackupTime.value,
      // 旧数据兼容字段：与 workspaceRoot 恒等，读侧新代码只认 workspaceRoot
      workspacePath: workspaceRoot.value,
      workspaceRoot: workspaceRoot.value,
      useDateFolder: useDateFolder.value,
      autoBackupEnabled: autoBackupEnabled.value,
      backupFrequency: backupFrequency.value,
      backupTime: backupTime.value,
      keepBackupCount: keepBackupCount.value,
      backupMode: { ...backupModeLocal },
      // 备份时间戳以插件实例为运行时单一事实源（markBackupCompleted 先更新实例再落盘）
      lastBackupTimestamp: getS3BackupInstance()?.getLastBackupTimestamp() ?? 0,
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

  /** 备份完成后更新上次备份时间并同步定时器防重时间戳 + 持久化（复用 saveWorkspaceSettings 的错误处理，保存失败不向备份流程抛异常） */
  async function markBackupCompleted(): Promise<void> {
    lastBackupTime.value = new Date().toLocaleString()
    // 时间戳先写入实例（单一事实源），随后 buildWorkspaceSettings 从实例读取一并落盘
    getS3BackupInstance()?.updateLastBackupTime(Date.now())
    await saveWorkspaceSettings()
  }

  return {
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
  }
}
