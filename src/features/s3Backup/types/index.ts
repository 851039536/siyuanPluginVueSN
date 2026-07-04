/**
 * S3 备份功能类型定义和存储
 *
 * 定义 S3Config 接口、BackupSettings 接口以及 S3BackupStorage 存储槽。
 * 使用 PluginStorage + TypedStorage 模式管理配置持久化。
 */
import type { Plugin } from "siyuan"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"

// ========== S3 配置接口 ==========

export interface S3Config {
  /** 存储类型标识 */
  type: "s3"
  /** S3 服务端点，如 http://localhost:9000 或 https://s3.amazonaws.com */
  endpoint: string
  /** Access Key */
  accessKey: string
  /** Secret Key */
  secretKey: string
  /** 存储桶名称 */
  bucket: string
  /** 区域，如 us-east-1 */
  region: string
  /** 是否使用路径风格访问 (bucket 在路径中而非域名中) */
  pathStyle: boolean
  /** 备份文件在桶中的目录前缀 */
  prefix: string
  /** 是否使用 HTTPS */
  useSSL: boolean
}

// ========== 备份设置接口 ==========

export interface BackupSettings {
  /** 是否启用自动备份 */
  autoBackupEnabled: boolean
  /** 备份频率: minute | hourly | daily */
  backupFrequency: string
  /** 自动备份时间 (daily 模式下使用，格式 HH:MM) */
  backupTime: string
  /** 保留备份数量上限 */
  keepBackupCount: number
  /** 上次备份时间戳 */
  lastBackupTimestamp: number
  /** 上次备份时间文本 */
  lastBackupTime: string
  /** 工作区路径 */
  workspacePath: string
  /** 工作区根目录 */
  workspaceRoot: string
}

// ========== S3 文件信息接口 ==========

export interface S3FileInfo {
  name: string
  key: string
  size: number
  lastModified: string
}

// ========== 存储键常量 ==========

const STORAGE_KEYS = {
  S3_CONFIG: "s3-backup-config",
  BACKUP_SETTINGS: "s3-backup-settings",
  BACKUP_HISTORY: "s3-backup-history",
} as const

// ========== 存储类 ==========

export class S3BackupStorage {
  readonly s3Config: TypedStorage<S3Config>
  readonly backupSettings: TypedStorage<BackupSettings>
  readonly backupHistory: TypedStorage<Record<string, any>>

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin)
    this.s3Config = new TypedStorage(storage, STORAGE_KEYS.S3_CONFIG)
    this.backupSettings = new TypedStorage(storage, STORAGE_KEYS.BACKUP_SETTINGS, {
      autoBackupEnabled: false,
      backupFrequency: "daily",
      backupTime: "03:00",
      keepBackupCount: 7,
      lastBackupTimestamp: 0,
      lastBackupTime: "",
      workspacePath: "",
      workspaceRoot: "",
    } as BackupSettings)
    this.backupHistory = new TypedStorage(storage, STORAGE_KEYS.BACKUP_HISTORY)
  }
}

// ========== S3 配置默认值 ==========

export const DEFAULT_S3_CONFIG: S3Config = {
  type: "s3",
  endpoint: "http://localhost:9000",
  accessKey: "",
  secretKey: "",
  bucket: "",
  region: "us-east-1",
  pathStyle: true,
  prefix: "siyuan-backup/",
  useSSL: false,
}
