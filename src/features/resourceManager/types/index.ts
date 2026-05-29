/** 图片资源信息 */
export interface ImageAssetInfo {
  path: string
  docNames: string[]
  docIds: string[]
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
  resolvePath: string
  renameAsset: string
  insertLocalAssets: string
  refresh: string
  loading: string
  noAssets: string
  noMissingAssets: string
  noUnusedAssets: string
  deleteUnused: string
  deleteAllUnused: string
  deleteAsset: string
  deleteAssetConfirm: string
  deleteConfirm: string
  deleteSuccess: string
  deleteFailed: string
  rebuildIndexStart: string
  rebuildIndexSuccess: string
  rebuildIndexFailed: string
  resolvePathResult: string
  renameSuccess: string
  renameFailed: string
  insertSuccess: string
  insertFailed: string
  copyPath: string
  pathCopied: string
  assetPath: string
  newPath: string
  targetDocId: string
  selectFiles: string
  // 图片资源模式
  allAssets: string
  currentDoc: string
  specifiedDoc: string
  docIdPlaceholder: string
  docIdRequired: string
  assetCount: string
  // 移动资源
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
  categoryScreenshots: string
  categoryIcons: string
  categoryBackgrounds: string
  categoryAvatars: string
  categoryOther: string
  // 自定义分类
  customCategoryPlaceholder: string
  apply: string
  // 图片定位和关联文档
  locateDoc: string
  referencingDocs: string
  noReferencingDocs: string
  [key: string]: string
}
