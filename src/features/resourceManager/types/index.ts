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
  allAssets: string
  allCategories: string
  currentDoc: string
  assetCount: string
  moveAsset: string
  moveSuccess: string
  moveFailed: string
  movePathPlaceholder: string
  currentPath: string
  category: string
  confirmMove: string
  cancel: string
  loadFailed: string
  categoryImages: string
  categoryNet: string
  categoryTool: string
  categoryOther: string
  customCategoryPlaceholder: string
  apply: string
  locateDoc: string
  referencingDocs: string
  noReferencingDocs: string
  copyFailed: string
  updatedRefs: string
}
