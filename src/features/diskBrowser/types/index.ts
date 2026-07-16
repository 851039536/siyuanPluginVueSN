// 磁盘浏览器类型定义 — DiskInfo、FolderInfo、缓存数据结构及默认磁盘列表
export interface DiskInfo {
  drive: string
  label?: string
  total?: number
  used?: number
  usagePercent?: number
}

export interface FolderInfo {
  name: string
  path: string
  isFile?: boolean
  size?: number
  modifiedTime?: string
}

export interface CacheData<T> {
  data: T
  timestamp: number
}

export interface CacheStatus {
  text: string
  isExpired: boolean
  tooltip: string
}

export interface DiskBrowserSettings {
  favoriteFolders: string[]
}

export interface DiskBrowserI18n {
  panelTitle?: string
  refreshing?: string
  favorites?: string
  removeFavorite?: string
  addFavorite?: string
  favoriteRemoved?: string
  favoriteAdded?: string
  backToRoot?: string
  back?: string
  items?: string
  openInExplorer?: string
  copyPath?: string
  browse?: string
  open?: string
  emptyFolder?: string
  cacheExpired?: string
  cacheExpiredTooltip?: string
  cacheValidTooltip?: string
  minutesRemaining?: string
  expired?: string
  min?: string
  loadDisksFailed?: string
  loadFoldersFailed?: string
  opened?: string
  openDiskNotSupported?: string
  openDiskFailed?: string
  invalidPath?: string
  navigatedToFavorite?: string
  navigationFailed?: string
  pathCopied?: string
  copyFailed?: string
  today?: string
  yesterday?: string
  daysAgo?: string
  name?: string
  size?: string
  date?: string
}

export const STORAGE_KEY = "disk-browser-settings"
