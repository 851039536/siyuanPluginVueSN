/**
 * 本地备份列表管理 composable
 *
 * 维护本地备份列表 / 上传状态 / 上传来源设备映射，
 * 提供列表扫描加载（含存储兜底）、删除、单文件上传至 S3 与防重判断。
 * 防重与 hostMap 均按 basename 比较（列表条目 name 可能含日期子目录前缀）。
 */
import { ref } from "vue"
import type { Ref } from "vue"
import { showMessage } from "siyuan"
import { getNodeModules } from "@/utils/nodeModules"
import { getErrorMessage } from "@/utils/stringUtils"
import type { BackupManager } from "../modules/BackupManager"
import type { BackupLog, LocalBackupInfo, PersistFn, S3FileInfo } from "../types"
import { MAX_LOCAL_BACKUP_COUNT } from "../types"
import { getBaseName, getHostname } from "../utils"

/** 依赖注入：全部来自 index.vue 已有的状态与方法 */
export interface LocalBackupListDeps {
  getBackupManager: () => BackupManager | null
  persist: PersistFn
  getStorageHistory: () => Promise<{ list: LocalBackupInfo[] } | null>
  isConfigured: Ref<boolean>
  /** 云端备份列表（防重判断的比对来源） */
  backupList: Ref<S3FileInfo[]>
  /** 由文件 basename 构建 S3 上传 key */
  buildUploadKey: (fileName: string) => string
  uploadFileContent: (buffer: Buffer, key: string) => Promise<void>
  refreshBackupList: () => Promise<void>
  addLog: (entry: Omit<BackupLog, "id" | "time" | "hostname">) => void
  i18n: Record<string, string>
}

export function useLocalBackupList(deps: LocalBackupListDeps) {
  const { i18n } = deps

  const localBackupList = ref<LocalBackupInfo[]>([])
  const isLoadingLocal = ref(false)
  const uploadingItems = ref<Record<string, boolean>>({})
  /** 文件 basename → 上传来源设备名映射（云端列表展示用） */
  const uploadHostMap = ref<Record<string, string>>({})

  async function loadLocalBackupList(): Promise<void> {
    localBackupList.value = []
    try {
      const backupManager = deps.getBackupManager()
      if (backupManager) {
        const scanned = await backupManager.scanBackupDir()
        if (scanned.length > 0) {
          localBackupList.value = scanned.slice(0, MAX_LOCAL_BACKUP_COUNT)
          await deps.persist((s) => s.backupHistory.save({ list: localBackupList.value }))
          return
        }
      }
      const history = await deps.getStorageHistory()
      if (history?.list) {
        localBackupList.value = history.list.slice(0, MAX_LOCAL_BACKUP_COUNT)
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
      const confirmDelete = confirm(i18n.confirmDelete || "确定要删除此备份吗？")
      if (!confirmDelete) { return }
      const backupManager = deps.getBackupManager()
      if (backupManager) {
        await backupManager.deleteBackupFile(backup.path)
      }
      // A11 修复：按 path 过滤而非 name，避免同名文件误删
      localBackupList.value = localBackupList.value.filter((b) => b.path !== backup.path)
      await deps.persist((s) => s.backupHistory.save({ list: localBackupList.value }))
      showMessage(i18n.deleteSuccess || "删除成功", 2000, "info")
    } catch (error) {
      console.error("删除本地备份失败:", error)
      showMessage(i18n.deleteFailed || "删除失败", 3000, "error")
    }
  }

  /** 检查文件是否已存在于 S3 备份列表（按 basename 比较，兼容日期子目录条目） */
  function isAlreadyUploaded(fileName: string): boolean {
    const base = getBaseName(fileName)
    return deps.backupList.value.some((f) => f.name === base || f.key.endsWith(`/${base}`))
  }

  /** 批量记录上传来源设备名并持久化（仅传入实际上传成功的文件） */
  async function recordUploadHosts(fileNames: string[]): Promise<void> {
    const hostname = getHostname()
    if (!hostname || fileNames.length === 0) { return }
    const next = { ...uploadHostMap.value }
    for (const name of fileNames) {
      next[getBaseName(name)] = hostname
    }
    uploadHostMap.value = next
    await deps.persist((s) => s.uploadHostMap.save({ map: uploadHostMap.value }))
  }

  async function uploadLocalBackup(backup: Record<string, any>): Promise<void> {
    const node = getNodeModules()
    if (!node || !deps.isConfigured.value) { return }
    // 检查 S3 上是否已存在同名文件，已存在则提示并跳过
    if (isAlreadyUploaded(backup.name)) {
      showMessage(i18n.alreadyUploaded || "该文件已上传过，无需重复上传", 3000, "info")
      return
    }
    uploadingItems.value = { ...uploadingItems.value, [backup.path]: true }
    try {
      const content = await node.fs.promises.readFile(backup.path)
      // 上传 key 使用 basename：日期子目录条目上云后与顶层文件保持同一层级规则
      const s3Key = deps.buildUploadKey(getBaseName(backup.name))
      await deps.uploadFileContent(content, s3Key)
      await recordUploadHosts([backup.name])
      deps.addLog({ type: "s3Upload", action: i18n.uploadToS3 || "上传到 S3", fileName: backup.name, success: true })
      showMessage(i18n.uploadSuccess || "上传成功", 2000, "info")
      await deps.refreshBackupList()
    } catch (err: unknown) {
      deps.addLog({ type: "s3Upload", action: i18n.uploadToS3 || "上传到 S3", fileName: backup.name, success: false, message: getErrorMessage(err) })
      showMessage(`${i18n.uploadFailed || "上传失败"}: ${getErrorMessage(err)}`, 5000, "error")
    } finally {
      uploadingItems.value = { ...uploadingItems.value, [backup.path]: false }
    }
  }

  return {
    localBackupList,
    isLoadingLocal,
    uploadingItems,
    uploadHostMap,
    loadLocalBackupList,
    refreshLocalBackupList,
    deleteLocalBackup,
    uploadLocalBackup,
    isAlreadyUploaded,
    recordUploadHosts,
  }
}
