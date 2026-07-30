/**
 * 云端备份列表操作 composable
 *
 * 提供云端备份文件的下载到本地备份目录与删除（确认 + 日志 + 消息提示）能力。
 * 依赖注入方式接入 index.vue，不接触其他 composable 的内部状态。
 */
import type { Ref } from "vue"
import { showMessage } from "siyuan"
import { getNodeModules } from "@/utils/nodeModules"
import { getErrorMessage } from "@/utils/stringUtils"
import type { BackupLog, S3FileInfo } from "../types"
import { DEFAULT_BACKUP_DIR, MSG_DESKTOP_ONLY } from "../types"

/** 依赖注入：全部来自 index.vue 已有的状态与方法 */
export interface CloudBackupActionsDeps {
  workspaceRoot: Ref<string>
  localBackupDir: Ref<string>
  downloadBackup: (s3Key: string, localPath: string) => Promise<void>
  deleteObject: (key: string, syncList?: boolean) => Promise<void>
  addLog: (entry: Omit<BackupLog, "id" | "time" | "hostname">) => void
  i18n: Record<string, string>
}

export function useCloudBackupActions(deps: CloudBackupActionsDeps) {
  const { addLog, i18n } = deps

  /** 下载云端对象到本地备份目录 */
  async function downloadToLocalDir(backup: S3FileInfo): Promise<void> {
    const node = getNodeModules()
    if (!node) { throw new Error(MSG_DESKTOP_ONLY) }
    const fs = node.fs.promises
    const pathModule = node.path

    const downloadDir = pathModule.join(
      deps.workspaceRoot.value,
      deps.localBackupDir.value || DEFAULT_BACKUP_DIR,
    )
    await fs.mkdir(downloadDir, { recursive: true })
    const localPath = pathModule.join(downloadDir, backup.name)

    await deps.downloadBackup(backup.key, localPath)
  }

  async function handleDownload(backup: S3FileInfo): Promise<void> {
    try {
      await downloadToLocalDir(backup)
      addLog({
        type: "s3Download",
        action: i18n.download,
        fileName: backup.name,
        success: true,
      })
      showMessage(i18n.downloadSuccess, 2000, "info")
    } catch (err: unknown) {
      addLog({
        type: "s3Download",
        action: i18n.download,
        fileName: backup.name,
        success: false,
        message: getErrorMessage(err),
      })
      showMessage(`${i18n.downloadFailed}: ${getErrorMessage(err)}`, 5000, "error")
    }
  }

  async function handleDelete(backup: S3FileInfo): Promise<void> {
    const confirmed = confirm(i18n.confirmDelete)
    if (!confirmed) { return }

    try {
      // syncList: 删除成功后同步从云端列表移除
      await deps.deleteObject(backup.key, true)
      addLog({
        type: "s3Delete",
        action: i18n.delete,
        fileName: backup.name,
        success: true,
      })
      showMessage(i18n.deleteSuccess, 2000, "info")
    } catch (err: unknown) {
      addLog({
        type: "s3Delete",
        action: i18n.delete,
        fileName: backup.name,
        success: false,
        message: getErrorMessage(err),
      })
      showMessage(`${i18n.deleteFailed}: ${getErrorMessage(err)}`, 5000, "error")
    }
  }

  return { handleDownload, handleDelete }
}
