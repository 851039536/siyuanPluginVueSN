/**
 * 本地 ZIP 备份流程 composable
 *
 * 承载 performFullBackup 调用、备份列表维护与保留数清理、
 * 校验值计算保存与操作日志记录，供编排层在「立即备份」与「压缩包备份」入口复用。
 */
import { showMessage } from "siyuan"
import type { Ref } from "vue"
import { getErrorMessage } from "@/utils/stringUtils"
import type { TaskHandle } from "@/features/statusBar/composables/useStatusBarTask"
import { toLocalBackupInfo } from "../modules/BackupManager"
import type { BackupManager, BackupProgress, BackupResult } from "../modules/BackupManager"
import { isPluginBackupFile } from "../utils"
import type { BackupLog, LocalBackupInfo, S3BackupStorage } from "../types"

/** 依赖注入：互斥守卫、入口检查与状态栏由编排层持有 */
export interface LocalZipBackupDeps {
  i18n: Record<string, string>
  addLog: (entry: Omit<BackupLog, "id" | "time" | "hostname">) => void
  getBackupManager: () => BackupManager | null
  backupProgress: Ref<BackupProgress>
  useDateFolder: Ref<boolean>
  keepBackupCount: Ref<number>
  localBackupList: Ref<LocalBackupInfo[]>
  persistStorage: (save: (storage: S3BackupStorage) => Promise<unknown>) => Promise<void>
  saveChecksum: (fileName: string, filePath: string, fileSize: number, checksum: string, persistNow?: boolean) => Promise<void>
  isAnyTaskRunning: Ref<boolean>
  isZipBackingUp: Ref<boolean>
  ensureWorkspaceReady: () => Promise<boolean>
  statusTask: TaskHandle
}

export function useLocalZipBackup(deps: LocalZipBackupDeps) {
  const { i18n, addLog } = deps

  /** 本地 ZIP 备份，返回备份结果（含文件路径，供 S3 上传使用） */
  async function performLocalBackup(): Promise<BackupResult | null> {
    const backupManager = deps.getBackupManager()
    if (!backupManager) { return null }

    deps.backupProgress.value = {
      phase: "scanning",
      currentFile: "",
      filesProcessed: 0,
      totalFiles: 0,
      percent: 0,
    }

    try {
      const result = await backupManager.performFullBackup({
        useDateFolder: deps.useDateFolder.value,
        onProgress: (p) => {
          deps.backupProgress.value = { ...p }
        },
      })

      deps.localBackupList.value.unshift(toLocalBackupInfo(result, new Date().toLocaleString()))

      // 超出保留数量时删除磁盘上的旧备份文件
      // 仅物理删除插件命名规则（data-*.zip）的文件，用户手工放入的归档只移出列表不动磁盘
      if (deps.localBackupList.value.length > deps.keepBackupCount.value) {
        const toDelete = deps.localBackupList.value.slice(deps.keepBackupCount.value)
        for (const old of toDelete) {
          if (!isPluginBackupFile(old.name)) { continue }
          try {
            await backupManager.deleteBackupFile(old.path)
          } catch (err) {
            console.warn(`删除旧备份失败: ${old.name}`, err)
          }
        }
        deps.localBackupList.value = deps.localBackupList.value.slice(0, deps.keepBackupCount.value)
      }

      await deps.persistStorage((s) => s.backupHistory.save({ list: deps.localBackupList.value }))

      showMessage(`本地备份成功: ${result.fileName}（${result.totalFiles} 文件）`, 3000, "info")
      addLog({
        type: "localZip",
        action: i18n.localZipBackup,
        fileName: result.fileName,
        fileSize: result.size,
        success: true,
        message: `${result.totalFiles} 文件`,
      })
      // 计算 ZIP 文件校验值并持久化
      try {
        const hash = await backupManager.computeFileHash(result.filePath)
        await deps.saveChecksum(result.fileName, result.filePath, result.size, hash)
      } catch (hashErr: unknown) {
        console.warn("计算文件校验值失败:", getErrorMessage(hashErr))
      }
      return result
    } catch (err: unknown) {
      addLog({
        type: "localZip",
        action: i18n.localZipBackup,
        fileName: "",
        success: false,
        message: getErrorMessage(err),
      })
      throw new Error(`本地备份: ${getErrorMessage(err)}`)
    }
  }

  /** 独立压缩包备份按钮（不依赖模式开关，直接执行本地 ZIP 打包） */
  async function triggerZipBackupOnly(): Promise<void> {
    if (deps.isAnyTaskRunning.value || !deps.getBackupManager()) { return }
    // 进入即置位：目录对话框挂起期间也纳入互斥范围，防止自动备份 tick 穿透空窗并发执行
    deps.isZipBackingUp.value = true
    try {
      if (!(await deps.ensureWorkspaceReady())) { return }
      await performLocalBackup()
      // 状态栏："备份完成"
      deps.statusTask.complete(i18n.statusBackupDone)
    } catch (err: unknown) {
      // 状态栏："备份失败"
      deps.statusTask.fail(i18n.statusBackupFailed)
      showMessage(`${i18n.zipBackup}: ${getErrorMessage(err)}`, 5000, "error")
    } finally {
      deps.isZipBackingUp.value = false
    }
  }

  return { performLocalBackup, triggerZipBackupOnly }
}
