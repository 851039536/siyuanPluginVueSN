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
  /** 是否启用 S3 增量备份（仅上传 data/ 中新增/变更文件） */
  s3Incremental: boolean
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

// ========== 备份列表展示项基础类型 ==========

/** 列表展示项基础类型（LocalBackupInfo / S3FileInfo 均满足此约束），供 BackupListCard 泛型化使用 */
export interface BackupListDisplayItem {
  name: string
  size: number
  time?: string
  lastModified?: string
}

// ========== 共享工具类型 ==========

/** 持久化辅助函数类型：由 index.vue 提供，统一「获取实例 → 存储槽 save」样板 */
export type PersistFn = (save: (storage: S3BackupStorage) => Promise<unknown>) => Promise<void>

// ========== 备份日志接口 ==========

export interface BackupLog {
  /** 唯一 ID（时间戳） */
  id: string
  /** 操作类型 */
  type: "localZip" | "s3Upload" | "s3Download" | "s3Delete" | "s3Incremental" | "autoBackup"
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
  /** 操作来源设备名 */
  hostname?: string
  /** 结构化文件清单详情（旧日志无此字段，展开时降级显示完整 message） */
  detail?: BackupLogDetail
}

/** 备份日志的结构化文件清单（增量备份/还原产生，按类别分组供 UI 展开展示） */
export interface BackupLogDetail {
  /** 上传成功的文件相对路径 */
  uploaded?: string[]
  /** 从远端删除的文件相对路径 */
  deleted?: string[]
  /** 传输失败的文件相对路径 */
  failed?: string[]
  /** 各清单因存储上限被省略的条数 */
  omitted?: { uploaded?: number; deleted?: number; failed?: number }
}

// ========== 默认值常量 ==========

/** 非桌面端无法访问文件系统的统一错误消息（模块内部使用，不经 i18n） */
export const MSG_DESKTOP_ONLY = "无法访问文件系统，请使用桌面版思源笔记"

export const DEFAULT_BACKUP_MODE: BackupMode = {
  localZip: true,
  s3Upload: false,
  s3Incremental: false,
}

/** 日志最大保留条数 */
export const MAX_LOG_COUNT = 200

/** 日志 detail 中每类文件清单的存储上限（超出记入 omitted 计数，防止首次全量备份撑爆 storage） */
export const MAX_LOG_DETAIL_FILES = 200

/** 本地备份列表最大显示条数 */
export const MAX_LOCAL_BACKUP_COUNT = 50

/** S3 目录前缀默认值（兜底用） */
export const DEFAULT_S3_PREFIX = "siyuan-backup/"

/** 本地备份目录 / S3 子路径默认值（兜底用） */
export const DEFAULT_BACKUP_DIR = "data-backup"

/** 备份设置默认值（单一事实源：TypedStorage 默认值与各处兜底均引用此常量） */
export const DEFAULT_BACKUP_SETTINGS: BackupSettings = {
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
  localBackupDir: DEFAULT_BACKUP_DIR,
  s3SubPrefix: DEFAULT_BACKUP_DIR,
}

// ========== 增量备份接口 ==========

/** 增量备份清单条目（以 relativePath 为键存储在 BackupManifest.files 中） */
export interface ManifestEntry {
  /** 文件修改时间（毫秒时间戳） */
  mtime: number
  /** 文件大小（字节） */
  size: number
}

/** 增量备份清单（存储于 S3，为增量对比的唯一事实源） */
export interface BackupManifest {
  /** 清单结构版本（预留未来扩展，如分片/哈希字段） */
  version: number
  /** 生成时间（ISO 字符串） */
  createdAt: string
  /** 生成设备主机名 */
  hostname: string
  /** relativePath → 文件状态映射 */
  files: Record<string, ManifestEntry>
}

/** 增量扫描的本地文件条目（scanDataFiles 的返回项） */
export interface IncrementalFileEntry {
  fullPath: string
  relativePath: string
  mtime: number
  size: number
}

/** 增量对比结果 */
export interface IncrementalDiff {
  /** 需上传的新增/变更文件 */
  toUpload: IncrementalFileEntry[]
  /** 需从 S3 删除的 relativePath 列表（本地已删除） */
  toDelete: string[]
  /** 未变更被跳过的文件数 */
  unchangedCount: number
  /** 未变更条目映射（供新 manifest 直接起步，消除调用方二次遍历） */
  unchanged: BackupManifest["files"]
}

/** 增量备份在 S3 中的子目录名（位于 {prefix}/{s3SubPrefix}/ 之下） */
export const INCREMENTAL_SUBDIR = "incremental"

/** 增量清单文件名 */
export const INCREMENTAL_MANIFEST_NAME = "manifest.json"

/** 当前清单结构版本 */
export const MANIFEST_VERSION = 1

/** 大文件警告阈值（100MB）：uploadBuffer 整体读入内存，超过阈值仅警告不阻断 */
export const LARGE_FILE_WARN_SIZE = 100 * 1024 * 1024

// ========== 备份校验值接口 ==========

export interface FileChecksum {
  /** 文件名（key） */
  fileName: string
  /** 完整路径（验证时需要） */
  filePath: string
  /** SHA-256 十六进制摘要 */
  checksum: string
  /** 文件大小（字节） */
  fileSize: number
  /** 计算时间（ISO 字符串） */
  time: string
}

// ========== 存储键常量 ==========

const STORAGE_KEYS = {
  S3_CONFIG: "s3-backup-config",
  BACKUP_SETTINGS: "s3-backup-settings",
  BACKUP_HISTORY: "s3-backup-history",
  BACKUP_LOG: "s3-backup-log",
  CHECKSUMS: "s3-backup-checksums",
  UPLOAD_HOST_MAP: "s3-backup-upload-host-map",
} as const

// ========== 存储类 ==========

export class S3BackupStorage {
  readonly s3Config: TypedStorage<S3Config>
  readonly backupSettings: TypedStorage<BackupSettings>
  readonly backupHistory: TypedStorage<{ list: LocalBackupInfo[] }>
  readonly backupLogs: TypedStorage<{ logs: BackupLog[] }>
  readonly checksums: TypedStorage<{ items: FileChecksum[] }>
  /** 文件名 → 上传来源设备名映射 */
  readonly uploadHostMap: TypedStorage<{ map: Record<string, string> }>

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin)
    this.s3Config = new TypedStorage(storage, STORAGE_KEYS.S3_CONFIG)
    this.backupSettings = new TypedStorage(storage, STORAGE_KEYS.BACKUP_SETTINGS, {
      ...DEFAULT_BACKUP_SETTINGS,
      backupMode: { ...DEFAULT_BACKUP_MODE },
    })
    this.backupHistory = new TypedStorage(storage, STORAGE_KEYS.BACKUP_HISTORY, { list: [] })
    this.backupLogs = new TypedStorage(storage, STORAGE_KEYS.BACKUP_LOG, { logs: [] })
    this.checksums = new TypedStorage(storage, STORAGE_KEYS.CHECKSUMS, { items: [] })
    this.uploadHostMap = new TypedStorage(storage, STORAGE_KEYS.UPLOAD_HOST_MAP, { map: {} })
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
  prefix: DEFAULT_S3_PREFIX,
  useSSL: false,
}
