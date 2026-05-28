export interface ImageInfo {
  path: string
  name: string
  size: number
  width?: number
  height?: number
  type: string
  lastModified: number
  url?: string
}

export interface CompressOptions {
  maxSizeMB?: number
  maxWidthOrHeight?: number
  quality?: number
  useWebWorker?: boolean
  fileType?: string
}

export interface CompressResult {
  success: boolean
  originalFile: ImageInfo
  compressedBlob?: Blob
  compressedSize?: number
  error?: string
  compressionRatio?: number
  timeTaken?: number
}

export interface ImageComparison {
  original: ImageInfo
  compressed: {
    size: number
    blob: Blob
  }
  compressionRatio: number
  sizeSaved: number
  sizeSavedMB: string
}

export interface ScanProgress {
  current: number
  total: number
  currentPath?: string
}

export interface CompressProgress {
  current: number
  total: number
  currentImage?: string
  failed?: number
}

export interface ImageCompressorI18n {
  title: string
  scanImages: string
  scanning: string
  foundImages: string
  selectAll: string
  deselectAll: string
  compress: string
  compressing: string
  replace: string
  replacing: string
  quality: string
  maxSize: string
  maxDimension: string
  statistics: string
  totalImages: string
  successCount: string
  failedCount: string
  compressionRatio: string
  totalSaved: string
  cancel: string
  firstPage: string
  prevPage: string
  nextPage: string
  lastPage: string
  loadingImage: string
  metaDimensions: string
  metaFileSize: string
  startScan: string
  clearResults: string
  qualityHint: string
  maxSizeHint: string
  maxDimensionHint: string
  webWorkerLabel: string
  webWorkerHint: string
  selectedImagesLabel: string
  estimatedTimeLabel: string
  second: string
  minute: string
  [key: string]: string
}
