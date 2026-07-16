// 磁盘浏览器核心逻辑 composable — 磁盘加载、文件夹浏览、缓存管理、收藏夹操作
import type {
  CacheData,
  CacheStatus,
  DiskBrowserI18n,
  DiskInfo,
  FolderInfo,
} from "../types"
import type { DiskBrowserStorage } from "../types/storage"
import { showMessage } from "siyuan"
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
} from "vue"
import { copyToClipboard } from "@/utils/domUtils"
import { getElectronModules, getNodeProcessModules } from "@/utils/nodeModules"
import {
  CACHE_EXPIRY_TIME,
  computeCacheStatus,
  createExecRunner,
  formatDate,
  getDefaultDisks,
  isCacheValid,
  processFolderList,
  processItemList,
  readDirectoryContents,
} from "../utils"

export function useDiskBrowser(
  i18n: DiskBrowserI18n,
  storage: DiskBrowserStorage,
) {
  const disks = ref<DiskInfo[]>([])
  const expandedDisk = ref("")
  const folders = ref<FolderInfo[]>([])
  const loading = ref(false)
  const loadingFolders = ref(false)
  const currentPath = ref("")
  const favoriteFolders = ref<string[]>([])
  const favoriteSet = computed(() => new Set(favoriteFolders.value))

  const diskCache = ref<CacheData<DiskInfo[]> | null>(null)
  const folderCacheMap = ref<Map<string, CacheData<FolderInfo[]>>>(new Map())
  const cacheExpiryTime = CACHE_EXPIRY_TIME

  const { retryExec } = createExecRunner()

  const pathSegments = computed(() => {
    if (!currentPath.value || currentPath.value === expandedDisk.value)
      return []
    const pathWithoutDrive = currentPath.value.replace(
      `${expandedDisk.value}\\`,
      "",
    )
    return pathWithoutDrive.split("\\").filter(Boolean)
  })

  const cacheStatus = computed(() =>
    computeCacheStatus(diskCache.value, i18n, cacheExpiryTime, "full"),
  )

  const currentFolderCache = computed((): CacheStatus => {
    const path = currentPath.value || expandedDisk.value
    if (!path) {
      return {
        text: "",
        isExpired: false,
        tooltip: "",
      }
    }
    const cached = folderCacheMap.value.get(path)
    return computeCacheStatus(cached, i18n, cacheExpiryTime, "short")
  })

  function toggleFavorite(folderPath: string): void {
    const index = favoriteFolders.value.indexOf(folderPath)
    if (index > -1) {
      favoriteFolders.value.splice(index, 1)
      showMessage(i18n.favoriteRemoved || "已取消收藏", 2000, "info")
    } else {
      favoriteFolders.value.push(folderPath)
      showMessage(i18n.favoriteAdded || "已添加收藏", 2000, "info")
    }
    saveFavorites()
  }

  async function saveFavorites(): Promise<void> {
    try {
      await storage.saveFavorites(favoriteFolders.value)
    } catch (error) {
      console.error("保存收藏夹失败:", error)
    }
  }

  async function loadFavorites(): Promise<void> {
    try {
      const favorites = await storage.loadFavorites()
      favoriteFolders.value = favorites
    } catch (error) {
      console.error("加载收藏夹失败:", error)
      favoriteFolders.value = []
    }
  }

  async function fetchDisks(forceRefresh = false): Promise<void> {
    if (!forceRefresh && isCacheValid(diskCache.value, cacheExpiryTime)) {
      disks.value = diskCache.value.data
      return
    }

    loading.value = true
    try {
      if (getNodeProcessModules()) {
        const command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-WmiObject Win32_LogicalDisk | Select-Object DeviceID, VolumeName, Size, FreeSpace | ConvertTo-Json -Compress"`
        const { stdout } = await retryExec(command, 2, 3000, "获取磁盘列表")

        const diskData = JSON.parse(stdout)
        const diskArray = Array.isArray(diskData) ? diskData : [diskData]

        const diskList: DiskInfo[] = diskArray
          .filter((disk: any) => disk.Size)
          .map((disk: any) => {
            const totalSpace = Number.parseInt(disk.Size) || 0
            const freeSpace = Number.parseInt(disk.FreeSpace) || 0
            const used = totalSpace - freeSpace
            return {
              drive: disk.DeviceID,
              label: disk.VolumeName ? String(disk.VolumeName).trim() : "",
              total: totalSpace,
              used,
              usagePercent: Math.round((used / totalSpace) * 100),
            }
          })

        disks.value = diskList
        diskCache.value = { data: diskList, timestamp: Date.now() }
      } else {
        disks.value = getDefaultDisks()
      }
    } catch (error) {
      console.error("获取磁盘列表失败:", error)
      showMessage(i18n.loadDisksFailed || "获取磁盘列表失败", 3000, "error")
      disks.value = getDefaultDisks()
    } finally {
      loading.value = false
    }
  }

  async function toggleDisk(disk: DiskInfo): Promise<void> {
    if (expandedDisk.value === disk.drive) {
      expandedDisk.value = ""
      folders.value = []
      currentPath.value = ""
    } else {
      expandedDisk.value = disk.drive
      currentPath.value = ""
      await loadFolderContent(disk.drive)
    }
  }

  /**
   * 统一的文件夹加载函数（合并原 loadFolders / loadFoldersFromPath）
   * @param path 磁盘根路径（如 C:）或子目录路径
   * @param forceRefresh 是否强制刷新缓存
   */
  async function loadFolderContent(
    path: string,
    forceRefresh = false,
  ): Promise<void> {
    const cached = folderCacheMap.value.get(path)
    if (!forceRefresh && isCacheValid(cached, cacheExpiryTime)) {
      folders.value = cached.data
      return
    }

    loadingFolders.value = true
    folders.value = []

    try {
      const displayPath = /^[A-Z]:$/.test(path) ? `${path}\\` : path
      let itemList = readDirectoryContents(displayPath)

      if (!itemList) {
        const isDriveRoot = /^[A-Z]:$/.test(path)
        const command = isDriveRoot
          ? `powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -Path '${path}\\' -Directory -ErrorAction SilentlyContinue | Where-Object { -not $_.Attributes.HasFlag([System.IO.FileAttributes]::Hidden) } | Select-Object -ExpandProperty Name | ForEach-Object { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Write-Output $_ }"`
          : `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-ChildItem -Path '${path}' -ErrorAction SilentlyContinue | Where-Object { -not $_.Attributes.HasFlag([System.IO.FileAttributes]::Hidden) } | Select-Object Name, @{Name='IsFile';Expression={-not $_.PSIsContainer}}, Length, LastWriteTime | ConvertTo-Json -Compress"`

        const { stdout } = await retryExec(command, 1, 5000, "获取文件夹列表")
        itemList = isDriveRoot
          ? processFolderList(stdout, path)
          : processItemList(stdout, path)
      }

      if (itemList) {
        folders.value = itemList
        folderCacheMap.value.set(path, { data: itemList, timestamp: Date.now() })
      }
    } catch (error) {
      console.error("加载文件夹失败:", error)
      showMessage(i18n.loadFoldersFailed || "加载文件夹失败", 3000, "error")
    } finally {
      loadingFolders.value = false
    }
  }

  function openPath(path: string): void {
    const electron = getElectronModules()
    if (!electron) {
      showMessage(
        i18n.openDiskNotSupported || "当前环境不支持打开文件夹",
        3000,
        "error",
      )
      return
    }
    try {
      electron.shell.openPath(path)
      showMessage(i18n.opened || "已打开", 2000, "info")
    } catch (error) {
      console.error("打开失败:", error)
      showMessage(i18n.openDiskFailed || "打开失败", 3000, "error")
    }
  }

  function refreshDisks(): void {
    fetchDisks(true)
    showMessage(i18n.refreshing || "正在刷新...", 2000, "info")
  }

  function refreshCurrentFolder(): void {
    const pathToRefresh = currentPath.value || expandedDisk.value
    if (pathToRefresh) {
      loadFolderContent(pathToRefresh, true)
      showMessage(i18n.refreshing || "正在刷新...", 2000, "info")
    }
  }

  function handleItemDoubleClick(item: FolderInfo): void {
    if (item.isFile) {
      openPath(item.path)
    } else {
      navigateIntoFolder(item)
    }
  }

  async function navigateIntoFolder(item: FolderInfo): Promise<void> {
    currentPath.value = item.path
    await loadFolderContent(item.path)
  }

  async function navigateBack(): Promise<void> {
    if (!currentPath.value) return

    const lastSlash = currentPath.value.lastIndexOf("\\")
    if (lastSlash > 0) {
      const parentPath = currentPath.value.substring(0, lastSlash)
      if (parentPath.endsWith(":")) {
        currentPath.value = ""
        await loadFolderContent(expandedDisk.value)
      } else {
        currentPath.value = parentPath
        await loadFolderContent(parentPath)
      }
    } else {
      navigateToRoot()
    }
  }

  async function navigateToRoot(): Promise<void> {
    currentPath.value = ""
    await loadFolderContent(expandedDisk.value)
  }

  async function navigateToPath(segmentIndex: number): Promise<void> {
    const segments = pathSegments.value.slice(0, segmentIndex + 1)
    const newPath = `${expandedDisk.value}\\${segments.join("\\")}`
    currentPath.value = newPath
    await loadFolderContent(newPath)
  }

  async function navigateToFavorite(path: string): Promise<void> {
    try {
      const driveMatch = path.match(/^([A-Z]:)/)
      if (!driveMatch) {
        showMessage(i18n.invalidPath || "无效路径", 2000, "error")
        return
      }

      const drive = driveMatch[1]
      expandedDisk.value = drive

      if (path === drive || path === `${drive}\\`) {
        currentPath.value = ""
        await loadFolderContent(drive)
      } else {
        currentPath.value = path
        await loadFolderContent(path)
      }

      showMessage(i18n.navigatedToFavorite || "已跳转到收藏夹", 2000, "info")
    } catch (error) {
      console.error("导航到收藏夹失败:", error)
      showMessage(i18n.navigationFailed || "导航失败", 2000, "error")
    }
  }

  async function copyPathToClipboard(path: string): Promise<void> {
    const success = await copyToClipboard(path)
    showMessage(
      success ? i18n.pathCopied || "路径已复制" : i18n.copyFailed || "复制失败",
      2000,
      success ? "info" : "error",
    )
  }

  const formatDateWithI18n = (dateString: string): string =>
    formatDate(dateString, i18n)

  onMounted(() => {
    loadFavorites()
    fetchDisks()
  })

  onUnmounted(() => {
    // 清理缓存
    diskCache.value = null
    folderCacheMap.value.clear()
  })

  return {
    disks,
    expandedDisk,
    folders,
    loading,
    loadingFolders,
    currentPath,
    favoriteFolders,
    favoriteSet,
    pathSegments,
    cacheStatus,
    currentFolderCache,
    toggleFavorite,
    toggleDisk,
    openPath,
    refreshDisks,
    refreshCurrentFolder,
    handleItemDoubleClick,
    navigateIntoFolder,
    navigateBack,
    navigateToRoot,
    navigateToPath,
    navigateToFavorite,
    copyPathToClipboard,
    formatDate: formatDateWithI18n,
  }
}
