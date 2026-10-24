/**
 * 备份记录状态 composable
 *
 * 统一持有操作日志与文件校验值，并提供从存储槽水合的能力；
 * 水合仅在内存为空时写入，避免覆盖初始化期间新产生的记录。
 */
import { getErrorMessage } from "@/utils/stringUtils"
import { getS3BackupInstance, persistS3BackupStorage } from "../instance"
import { useBackupLogs } from "./useBackupLogs"
import { useChecksums } from "./useChecksums"

export function useBackupRecords() {
  const { backupLogs, addLog, clearLogs } = useBackupLogs({ persist: persistS3BackupStorage })
  const { checksums, saveChecksum, persistChecksums, clearChecksums, removeOneChecksum } = useChecksums({ persist: persistS3BackupStorage })

  /** 从存储水合日志/校验值；仅在内存为空时写入，避免覆盖初始化期间的新记录 */
  async function hydrate(): Promise<void> {
    const instance = getS3BackupInstance()
    if (!instance) { return }
    const storage = instance.getStorage()
    const [logData, checksumData] = await Promise.all([
      storage.backupLogs.load().catch((err: unknown) => {
        console.warn("[S3备份] 加载操作日志失败:", getErrorMessage(err))
        return null
      }),
      storage.checksums.load().catch((err: unknown) => {
        console.warn("[S3备份] 加载校验值失败:", getErrorMessage(err))
        return null
      }),
    ])
    if (logData?.logs && backupLogs.value.length === 0) {
      backupLogs.value = logData.logs
    }
    if (checksumData?.items && checksums.value.length === 0) {
      checksums.value = checksumData.items
    }
  }

  return {
    backupLogs,
    addLog,
    clearLogs,
    checksums,
    saveChecksum,
    persistChecksums,
    clearChecksums,
    removeOneChecksum,
    hydrate,
  }
}
