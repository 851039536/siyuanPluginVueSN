/**
 * S3 共享层类型与常量
 *
 * 从 s3Backup 提升的 S3 连接配置接口、对象信息接口与默认值常量，
 * 供 s3Backup / s3FileManager 等功能模块共用（功能模块间禁止直接互导）。
 */

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
  /** 上传请求超时秒数（大文件/慢网络可调大，默认 240） */
  uploadTimeoutSec: number
  /** 允许自签名证书（跳过 TLS 校验；默认开启以兼容 MinIO/OpenList 等自建服务，旧配置缺字段时视为开启） */
  allowSelfSigned?: boolean
}

// ========== S3 文件信息接口 ==========

export interface S3FileInfo {
  name: string
  key: string
  size: number
  lastModified: string
  /** 真实 epoch 毫秒时间戳（lastModified 为 UTC 墙钟串不可反解析，相对时间显示用） */
  timestamp?: number
}

// ========== 常量 ==========

/** 非桌面端无法访问文件系统的统一错误消息（模块内部使用，不经 i18n） */
export const MSG_DESKTOP_ONLY = "无法访问文件系统，请使用桌面版思源笔记"

/** 上传请求默认超时秒数（旧配置缺字段/表单非法输入时的回退值） */
export const DEFAULT_UPLOAD_TIMEOUT_SEC = 240

/** S3 目录前缀默认值（兜底用） */
export const DEFAULT_S3_PREFIX = "siyuan-backup/"

/**
 * 大文件警告阈值（100MB）
 * 语义升级：既是整包读入内存的降级警告阈值，也是自动切换 Multipart 分片上传的最小文件大小
 * （≤100MB 走整包单 PUT 且不警告，>100MB 自动分片；代理不支持分片时才降级整包并给出警告）
 */
export const LARGE_FILE_WARN_SIZE = 100 * 1024 * 1024

/** 走 Multipart 分片上传的最小文件大小（复用 100MB 阈值单一数据源，保证边界语义与旧版一致） */
export const MULTIPART_MIN_SIZE = LARGE_FILE_WARN_SIZE

/** Multipart 单分片大小（16MB）：分片路径内存峰值 ≈ 单片大小 + 常数开销，逐片独立签名上传 */
export const MULTIPART_PART_SIZE = 16 * 1024 * 1024

// ========== 跨模块共享常量（s3Backup / s3FileManager 共用，功能模块间禁止直接互导） ==========

/** 单文件传输（上传/下载）最大重试次数（不含首次尝试） */
export const TRANSFER_MAX_RETRIES = 2

/** 操作日志最大保留条数 */
export const MAX_LOG_COUNT = 200

/** 操作日志 detail 中每类文件清单的存储上限（超出记入 omitted 计数） */
export const MAX_LOG_DETAIL_FILES = 200

/**
 * s3Backup 的 S3 连接配置存储键。
 * 提升为共享常量：s3FileManager 的「从 S3 备份导入」为只读消费方，
 * 键名靠字符串字面量维系会在 s3Backup 改名时静默失效（load 返回默认值，不报错）。
 */
export const S3_BACKUP_CONFIG_KEY = "s3-backup-config"

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
  uploadTimeoutSec: DEFAULT_UPLOAD_TIMEOUT_SEC,
  allowSelfSigned: true,
}
