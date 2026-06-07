/**
 * 数据备份功能类型定义和存储
 */
import { Plugin } from "siyuan"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"

interface BackupSettings {
  autoBackupEnabled: boolean
  autoBackupPluginData?: boolean
  backupFrequency: string
  backupTime: string
  keepBackupCount: number
  lastBackupTime: string
  lastBackupTimestamp: number
  workspacePath: string
  workspaceRoot: string
  cloudSyncEnabled?: boolean
}

const BACKUP_STORAGE_KEYS = {
  SETTINGS: "data-backup-settings",
  HISTORY: "backup-history",
  CLOUD_CONFIG: "cloud-backup-config",
} as const

export class DataBackupStorage {
  readonly backup: TypedStorage<BackupSettings>
  readonly backupHistory: TypedStorage<Record<string, any>>
  readonly cloudBackupConfig: TypedStorage<Record<string, any>>

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin)
    this.backup = new TypedStorage(storage, BACKUP_STORAGE_KEYS.SETTINGS)
    this.backupHistory = new TypedStorage(storage, BACKUP_STORAGE_KEYS.HISTORY)
    this.cloudBackupConfig = new TypedStorage(storage, BACKUP_STORAGE_KEYS.CLOUD_CONFIG)
  }
}
