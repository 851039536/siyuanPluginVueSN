/**
 * 图片压缩功能类型定义
 */

/**
 * 图片文件信息
 */
export interface ImageInfo {
  path: string              // 文件完整路径
  name: string              // 文件名
  size: number              // 文件大小(字节)
  width?: number            // 图片宽度
  height?: number           // 图片高度
  type: string              // MIME 类型
  lastModified: number      // 最后修改时间
  url?: string              // 预览 URL
}

/**
 * 压缩配置选项
 */
export interface CompressOptions {
  maxSizeMB?: number        // 最大文件大小(MB)
  maxWidthOrHeight?: number // 最大宽度或高度
  quality?: number          // 压缩质量 (0-1)
  useWebWorker?: boolean    // 是否使用 Web Worker
  fileType?: string         // 输出文件类型
}

/**
 * 压缩结果
 */
export interface CompressResult {
  success: boolean          // 是否成功
  originalFile: ImageInfo   // 原始文件信息
  compressedBlob?: Blob     // 压缩后的 Blob
  compressedSize?: number   // 压缩后大小
  error?: string            // 错误信息
  compressionRatio?: number // 压缩率(百分比)
  timeTaken?: number        // 耗时(毫秒)
}

/**
 * 图片对比数据
 */
export interface ImageComparison {
  original: ImageInfo
  compressed: {
    size: number
    blob: Blob
  }
  compressionRatio: number  // 压缩率
  sizeSaved: number         // 节省的大小(字节)
  sizeSavedMB: string       // 节省的大小(MB)
}

/**
 * 扫描进度
 */
export interface ScanProgress {
  current: number           // 当前进度
  total: number             // 总数
  currentPath?: string      // 当前扫描路径
}

/**
 * 压缩进度
 */
export interface CompressProgress {
  current: number           // 当前进度
  total: number             // 总数
  currentImage?: string     // 当前压缩的图片
  failed?: number           // 失败数量
}
