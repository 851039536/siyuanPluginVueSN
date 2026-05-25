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
  loading?: string
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
}

export const STORAGE_KEY = "disk-browser-settings"

export const DEFAULT_DISKS = ["C:", "D:", "E:", "F:", "G:", "H:"]

export function getDefaultDisks(): DiskInfo[] {
  return DEFAULT_DISKS.map((drive) => ({ drive }))
}
