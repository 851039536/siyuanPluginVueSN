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

/** 大文件警告阈值（100MB）：uploadBuffer 整体读入内存，超过阈值仅警告不阻断 */
export const LARGE_FILE_WARN_SIZE = 100 * 1024 * 1024

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
