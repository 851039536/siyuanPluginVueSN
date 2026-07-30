/**
 * S3 文件管理器持久化存储槽
 *
 * PluginStorage + TypedStorage 模式：自有 S3 连接配置、操作日志、视图偏好，
 * 以及指向 s3Backup 配置键的只读槽（供"一键导入"，永不回写）。
 */
import type { Plugin } from "siyuan"
import type { S3Config } from "@/utils/s3/types"
import { DEFAULT_S3_CONFIG } from "@/utils/s3/types"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"
import type { FileOpLog, FmPrefs } from "./index"
import { DEFAULT_FM_PREFS } from "./index"

// ========== 存储键常量 ==========

const STORAGE_KEYS = {
  CONFIG: "s3-file-manager-config",
  LOG: "s3-file-manager-log",
  PREFS: "s3-file-manager-prefs",
} as const

/** s3Backup 的 S3 配置存储键（跨模块只读共享，禁止写入） */
const S3_BACKUP_CONFIG_KEY = "s3-backup-config"

// ========== 存储类 ==========

export class S3FileManagerStorage {
  /** 自有 S3 连接配置（accessKey/secretKey 加密存储，读写时经 settingsCrypto 处理） */
  readonly config: TypedStorage<S3Config>
  /** 操作日志 */
  readonly logs: TypedStorage<{ logs: FileOpLog[] }>
  /** 视图偏好（视图模式/排序） */
  readonly prefs: TypedStorage<FmPrefs>
  /** s3Backup 配置的只读槽（一键导入用，永不调用 save） */
  readonly backupConfigReadonly: TypedStorage<S3Config>

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin)
    this.config = new TypedStorage(storage, STORAGE_KEYS.CONFIG, { ...DEFAULT_S3_CONFIG })
    this.logs = new TypedStorage(storage, STORAGE_KEYS.LOG, { logs: [] })
    this.prefs = new TypedStorage(storage, STORAGE_KEYS.PREFS, { ...DEFAULT_FM_PREFS })
    this.backupConfigReadonly = new TypedStorage(storage, S3_BACKUP_CONFIG_KEY)
  }
}
