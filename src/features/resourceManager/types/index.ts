// 资源管理模块类型定义：国际化文案接口

/** 资源管理器国际化类型 */
export interface ResourceManagerI18n {
  panelTitle: string
  imageAssets: string
  fileAssets: string
  missingAssets: string
  unusedAssets: string
  rebuildIndex: string
  refresh: string
  loading: string
  noAssets: string
  noMissingAssets: string
  noUnusedAssets: string
  deleteUnused: string
  deleteAllUnused: string
  deleteConfirm: string
  deleteSuccess: string
  deleteFailed: string
  rebuildIndexStart: string
  rebuildIndexSuccess: string
  rebuildIndexFailed: string
  copyPath: string
  pathCopied: string
  newPath: string
  uncategorized: string
  assetCount: string
  loadLimit: string
  moveAsset: string
  moveSuccess: string
  moveFailed: string
  movePathPlaceholder: string
  currentPath: string
  category: string
  confirmMove: string
  cancel: string
  invalidPath: string
  refUpdateFailed: string
  loadFailed: string
  categoryImages: string
  categoryNet: string
  categoryTool: string
  categoryOther: string
  customCategoryPlaceholder: string
  apply: string
  copyFailed: string
  updatedRefs: string
  locate: string
  locateRefs: string
  locateNotFound: string
  locateFailed: string
  fileNotFound: string
  samePathHint: string
  copyMdRef: string
  mdRefCopied: string
  openInFolder: string
  openFolderFailed: string
  docAssets: string
  noDocAssets: string
  noActiveDoc: string
  currentDoc: string
  deleteCategory: string
  deleteCategoryConfirm: string
  categoryNotEmpty: string
  deleteCategorySuccess: string
  hiddenCategories: string
  restore: string
  restoreSuccess: string
  categorySettings: string
  categorySettingsHint: string
  categoryBuiltIn: string
  noCategories: string
  moveInstantlyHint: string

  // ── 图片压缩（自 imageCompressor 功能块迁入「图片资源」页签批量操作）──
  compress: string
  compressing: string
  compressDialogTitle: string
  selectAll: string
  deselectAll: string
  selectedCount: string
  selectHint: string
  compressQuality: string
  compressQualityHint: string
  compressMaxSize: string
  compressMaxSizeHint: string
  compressMaxDimension: string
  compressMaxDimensionHint: string
  compressWebWorker: string
  compressWebWorkerHint: string
  compressEstimatedTime: string
  compressUnitSecond: string
  compressUnitMinute: string
  replaceOriginals: string
  replacing: string
  replaceConfirmMessage: string
  replaceComplete: string
  replaceDoneDetail: string
  compressDoneDetail: string
  compressStats: string
  compressTotal: string
  compressSuccess: string
  compressFailed: string
  compressRatio: string
  compressTotalSaved: string
  clearCompressResult: string
}

/** 分类栏条目：key 为归一化小写分类目录名，label 为展示文案 */
export interface CategoryItem {
  key: string
  label: string
  /** 是否为内置预设分类（内置可删除=隐藏，删除后可从「已隐藏」恢复） */
  builtIn: boolean
}

/** 压缩目标：仅需路径（压缩时按需读取文件内容，避免常驻持有 Blob） */
export interface CompressTarget {
  path: string
}

/** 压缩参数（自 imageCompressor 迁入） */
export interface CompressOptions {
  maxSizeMB?: number
  maxWidthOrHeight?: number
  quality?: number
  useWebWorker?: boolean
  fileType?: string
}

/** 单张图片的压缩结果 */
export interface CompressResult {
  success: boolean
  /** 资源路径（列表形态，非磁盘形态） */
  originalPath: string
  /** 原始字节数（读取失败时为 0） */
  originalSize: number
  compressedBlob?: Blob
  compressedSize?: number
  error?: string
  compressionRatio?: number
  timeTaken?: number
}
