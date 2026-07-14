/**
 * S3 备份功能类型定义和存储
 *
 * 定义 S3Config 接口、BackupSettings 接口、
 * BackupMode 接口、LocalBackupInfo 接口以及 S3BackupStorage 存储槽。
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

// ========== 备份模式接口 ==========

export interface BackupMode {
  /** 是否启用本地 ZIP 备份 */
  localZip: boolean
  /** 是否启用 S3 上传 */
  s3Upload: boolean
}

// ========== 备份设置接口 ==========

export interface BackupSettings {
  /** 上次备份时间文本 */
  lastBackupTime: string
  /** 工作区路径 */
  workspacePath: string
  /** 工作区根目录 */
  workspaceRoot: string
  /** 是否生成日期文件夹（默认 true） */
  useDateFolder: boolean
  /** 是否启用自动备份 */
  autoBackupEnabled: boolean
  /** 备份频率 */
  backupFrequency: string
  /** 每日备份时间 */
  backupTime: string
  /** 保留备份份数 */
  keepBackupCount: number
  /** 备份模式（本地 ZIP / S3 上传） */
  backupMode: BackupMode
  /** 上次备份时间戳 */
  lastBackupTimestamp: number
  /** 本地备份目录名（相对于工作区根目录，默认 "data-backup"） */
  localBackupDir: string
  /** S3 上传子路径（拼在 prefix 之后，默认 "data-backup"） */
  s3SubPrefix: string
}

// ========== S3 文件信息接口 ==========

export interface S3FileInfo {
  name: string
  key: string
  size: number
  lastModified: string
}

// ========== 本地备份文件信息接口 ==========

export interface LocalBackupInfo {
  name: string
  path: string
  time: string
  size: number
}

// ========== 默认值常量 ==========

// ========== 备份日志接口 ==========

export interface BackupLog {
  /** 唯一 ID（时间戳） */
  id: string
  /** 操作类型 */
  type: "localZip" | "s3Upload" | "s3Download" | "s3Delete"
  /** 操作描述文字 */
  action: string
  /** 相关文件名 */
  fileName: string
  /** 文件大小（字节） */
  fileSize?: number
  /** 操作时间（ISO 字符串） */
  time: string
  /** 是否成功 */
  success: boolean
  /** 附加消息 */
  message?: string
}

// ========== 默认值常量 ==========

export const DEFAULT_BACKUP_MODE: BackupMode = {
  localZip: true,
  s3Upload: false,
}

/** 日志最大保留条数 */
export const MAX_LOG_COUNT = 200

// ========== 存储键常量 ==========

const STORAGE_KEYS = {
  S3_CONFIG: "s3-backup-config",
  BACKUP_SETTINGS: "s3-backup-settings",
  BACKUP_HISTORY: "s3-backup-history",
  BACKUP_LOG: "s3-backup-log",
} as const

// ========== 存储类 ==========

export class S3BackupStorage {
  readonly s3Config: TypedStorage<S3Config>
  readonly backupSettings: TypedStorage<BackupSettings>
  readonly backupHistory: TypedStorage<{ list: LocalBackupInfo[] }>
  readonly backupLogs: TypedStorage<{ logs: BackupLog[] }>

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin)
    this.s3Config = new TypedStorage(storage, STORAGE_KEYS.S3_CONFIG)
    this.backupSettings = new TypedStorage(storage, STORAGE_KEYS.BACKUP_SETTINGS, {
      lastBackupTime: "",
      workspacePath: "",
      workspaceRoot: "",
      useDateFolder: true,
      autoBackupEnabled: false,
      backupFrequency: "daily",
      backupTime: "03:00",
      keepBackupCount: 7,
      backupMode: { ...DEFAULT_BACKUP_MODE },
      lastBackupTimestamp: 0,
      localBackupDir: "data-backup",
      s3SubPrefix: "data-backup",
    } as BackupSettings)
    this.backupHistory = new TypedStorage(storage, STORAGE_KEYS.BACKUP_HISTORY, { list: [] })
    this.backupLogs = new TypedStorage(storage, STORAGE_KEYS.BACKUP_LOG, { logs: [] })
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
