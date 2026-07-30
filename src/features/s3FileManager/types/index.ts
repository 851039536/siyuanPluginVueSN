/**
 * S3 文件管理器类型定义与共享常量
 *
 * 定义列表条目 S3Entry、视图偏好、操作日志 FileOpLog 等类型，
 * 以及日志上限、批量操作并发数等模块级常量（此处不放 register 逻辑）。
 */

// ========== 列表条目 ==========

/** 统一列表项：文件与文件夹共用（文件夹的 key 以 / 结尾） */
export interface S3Entry {
  /** 展示名（文件名或文件夹名，不含路径与尾部斜杠） */
  name: string
  /** 完整对象 key（文件夹为前缀，以 / 结尾） */
  key: string
  /** 是否为文件夹 */
  isFolder: boolean
  /** 文件大小（字节，文件夹为 0） */
  size: number
  /** 修改时间展示串（文件夹为空串） */
  lastModified: string
  /** 真实 epoch 毫秒时间戳（相对时间显示用） */
  timestamp?: number
}

// ========== 视图偏好 ==========

/** 列表视图模式：详细信息 / 图标网格 */
export type ViewMode = "details" | "icons"

/** 排序字段 */
export type SortField = "name" | "size" | "time"

/** 视图偏好（持久化） */
export interface FmPrefs {
  viewMode: ViewMode
  sortField: SortField
  sortAsc: boolean
}

/** 视图偏好默认值（单一事实源：TypedStorage 默认值引用此常量） */
export const DEFAULT_FM_PREFS: FmPrefs = {
  viewMode: "details",
  sortField: "name",
  sortAsc: true,
}

// ========== 操作日志 ==========

/** 文件操作类型 */
export type FileOpType = "upload" | "download" | "delete" | "copy" | "move" | "rename" | "createFolder"

/** 文件操作日志条目 */
export interface FileOpLog {
  /** 唯一 ID（时间戳） */
  id: string
  /** 操作类型 */
  type: FileOpType
  /** 操作描述文字 */
  action: string
  /** 相关文件/文件夹名 */
  fileName: string
  /** 涉及对象数（批量操作时记录） */
  itemCount?: number
  /** 文件大小（字节，单文件操作时记录） */
  fileSize?: number
  /** 操作时间（ISO 字符串） */
  time: string
  /** 是否成功 */
  success: boolean
  /** 附加消息 */
  message?: string
  /** 操作来源设备名 */
  hostname?: string
  /** 失败文件清单（批量操作部分失败时展开展示） */
  detail?: FileOpLogDetail
}

/** 操作日志的失败清单详情 */
export interface FileOpLogDetail {
  /** 失败的对象 key 列表 */
  failed?: string[]
  /** 因存储上限被省略的失败条数 */
  omitted?: number
}

// ========== 常量 ==========

/** 日志最大保留条数 */
export const MAX_LOG_COUNT = 200

/** 日志 detail 失败清单的存储上限（超出记入 omitted 计数） */
export const MAX_LOG_DETAIL_FILES = 200

/** 批量对象操作（复制/删除）并发数 */
export const FILE_OP_CONCURRENCY = 4

/** 上传/下载传输并发数（带宽易饱和，用小并发） */
export const TRANSFER_CONCURRENCY = 2

/** 单文件传输最大重试次数（不含首次尝试） */
export const TRANSFER_MAX_RETRIES = 2

/** 大目录增量渲染批大小（超出后显示"加载更多"） */
export const RENDER_BATCH_SIZE = 200

// ========== 共享工具类型 ==========

/** i18n 文案对象（键定义见 src/i18n/zh_CN/s3FileManager.json，值均为字符串） */
export type S3FileManagerI18n = Record<string, string>
