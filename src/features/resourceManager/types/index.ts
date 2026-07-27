// 资源管理模块类型定义：资源条目与国际化文案接口

/** 图片资源信息 */
export interface ImageAssetInfo {
  path: string
}

/** 资源管理器国际化类型 */
export interface ResourceManagerI18n {
  panelTitle: string
  description: string
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
  allCategories: string
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
}
