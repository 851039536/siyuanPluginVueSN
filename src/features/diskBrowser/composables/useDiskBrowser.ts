import type { Plugin } from "siyuan"
import type {
  CacheData,
  CacheStatus,
  DiskBrowserI18n,
  DiskInfo,
  FolderInfo,
} from "../types"
import { showMessage } from "siyuan"
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
} from "vue"
import { getDefaultDisks } from "../types"
import { DiskBrowserStorage } from "../types/storage"
import {
  buildPath,
  computeCacheStatus,
  copyToClipboard,
  formatDate,
  formatSize,
  getCacheExpiryTime,
  getFolderName,
  isCacheValid,
} from "../utils"

const DEBOUNCE_DELAY = 500

let isExecutingCommand = false
let lastExecutionTime = 0
let currentOperationId = 0
const operationMap = new Map<number, string>()

async function execWithTimeout(
  command: string,
  timeout = 3000,
): Promise<{ stdout: string, stderr: string }> {
  if (!window.require) {
    throw new Error("当前环境不支持执行命令")
  }

  const { exec } = window.require("child_process")
  const util = window.require("util")
  const execPromise = util.promisify(exec)

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("执行超时")), timeout)
  })

  return Promise.race([execPromise(command), timeoutPromise])
}

async function retryExec(
  command: string,
  retries = 2,
  timeout = 3000,
  operationType = "unknown",
): Promise<{ stdout: string, stderr: string }> {
  const operationId = ++currentOperationId
  operationMap.set(operationId, operationType)

  try {
    const now = Date.now()
    if (isExecutingCommand || now - lastExecutionTime < DEBOUNCE_DELAY) {
      while (isExecutingCommand) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      const waitTime = DEBOUNCE_DELAY - (Date.now() - lastExecutionTime)
      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime))
      }
    }

    if (operationMap.get(operationId) !== operationType) {
      throw new Error("操作已被取消")
    }

    isExecutingCommand = true
    lastExecutionTime = Date.now()

    let lastError: Error | null = null

    for (let i = 0; i <= retries; i++) {
      if (operationMap.get(operationId) !== operationType) {
        throw new Error("操作已被取消")
      }

      try {
        return await execWithTimeout(command, timeout)
      } catch (error) {
        lastError = error as Error
        if (i === retries) {
          throw new Error(
            `${operationType}失败，重试${retries}次后仍失败: ${lastError.message}`,
          )
        }
        const delay = Math.min(1000 * 2 ** i, 3000)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    throw lastError || new Error("未知错误")
  } finally {
    isExecutingCommand = false
    operationMap.delete(operationId)
  }
}

export function useDiskBrowser(plugin: Plugin, i18n: DiskBrowserI18n) {
  const storage = new DiskBrowserStorage(plugin)

  const disks = ref<DiskInfo[]>([])
  const selectedDisk = ref("")
  const expandedDisk = ref("")
  const folders = ref<FolderInfo[]>([])
  const loading = ref(false)
  const loadingFolders = ref(false)
  const currentPath = ref("")
  const favoriteFolders = ref<string[]>([])

  const diskCache = ref<CacheData<DiskInfo[]> | null>(null)
  const folderCacheMap = ref<Map<string, CacheData<FolderInfo[]>>>(new Map())

  let cacheExpiryTime = getCacheExpiryTime()

  const pathSegments = computed(() => {
    if (!currentPath.value || currentPath.value === expandedDisk.value)
      return []
    const pathWithoutDrive = currentPath.value.replace(
      `${expandedDisk.value}\\`,
      "",
    )
    return pathWithoutDrive.split("\\").filter(Boolean)
  })

  const currentDisplayPath = computed(() => {
    if (!currentPath.value) return expandedDisk.value
    const segments = pathSegments.value
    return segments.length === 0
      ? expandedDisk.value
      : segments[segments.length - 1]
  })

  const cacheStatus = computed((): CacheStatus => {
    return computeCacheStatus(diskCache.value, i18n, cacheExpiryTime, "full")
  })

  const currentFolderCache = computed((): CacheStatus => {
    const path = currentPath.value || expandedDisk.value
    if (!path) { return {
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

  function isFavorite(folderPath: string): boolean {
    return favoriteFolders.value.includes(folderPath)
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
    cacheExpiryTime = getCacheExpiryTime()

    if (!forceRefresh && isCacheValid(diskCache.value, cacheExpiryTime)) {
      disks.value = diskCache.value.data
      return
    }

    loading.value = true
    try {
      if (window.require) {
        try {
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
          diskCache.value = {
            data: diskList,
            timestamp: Date.now(),
          }
        } catch (error) {
          console.error("获取磁盘信息失败:", error)
          disks.value = getDefaultDisks()
        }
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
      selectedDisk.value = ""
      folders.value = []
      currentPath.value = ""
    } else {
      expandedDisk.value = disk.drive
      selectedDisk.value = disk.drive
      currentPath.value = ""
      await loadFolders(disk.drive)
    }
  }

  function processFolderList(
    stdout: string,
    basePath: string,
    includeFiles = false,
  ): FolderInfo[] {
    return (
      stdout
        ?.trim()
        .split("\n")
        .map((line) => line.trim())
        .filter((name) => name && name !== "." && name !== "..")
        .map((name) => ({
          name,
          path: buildPath(basePath, name),
        })) || []
    )
  }

  function processItemList(stdout: string, path: string): FolderInfo[] {
    const itemList: FolderInfo[] = []
    try {
      const itemData = JSON.parse(stdout)
      const itemArray = Array.isArray(itemData) ? itemData : [itemData]

      for (const item of itemArray) {
        if (item?.Name) {
          const itemName = String(item.Name).trim()
          itemList.push({
            name: itemName,
            path: buildPath(path, itemName),
            isFile: item.IsFile || false,
            size: item.Length ? Number.parseInt(item.Length) : undefined,
            modifiedTime: item.LastWriteTime || undefined,
          })
        }
      }

      itemList.sort((a, b) => {
        if (a.isFile === b.isFile) {
          return a.name.localeCompare(b.name, "zh-CN")
        }
        return a.isFile ? 1 : -1
      })
    } catch {
      // 解析失败返回空列表
    }
    return itemList
  }

  async function loadFolders(
    drive: string,
    forceRefresh = false,
  ): Promise<void> {
    cacheExpiryTime = getCacheExpiryTime()

    const cachedFolders = folderCacheMap.value.get(drive)
    if (!forceRefresh && isCacheValid(cachedFolders, cacheExpiryTime)) {
      folders.value = cachedFolders.data
      return
    }

    loadingFolders.value = true
    folders.value = []

    try {
      if (window.require) {
        const command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -Path '${drive}\\' -Directory -ErrorAction SilentlyContinue | Where-Object { -not $_.Attributes.HasFlag([System.IO.FileAttributes]::Hidden) } | Select-Object -ExpandProperty Name | ForEach-Object { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Write-Output $_ }"`
        const { stdout } = await retryExec(command, 1, 5000, "获取文件夹列表")

        const folderList = processFolderList(stdout, drive)
        folders.value = folderList
        folderCacheMap.value.set(drive, {
          data: folderList,
          timestamp: Date.now(),
        })
      }
    } catch (error) {
      console.error("加载文件夹失败:", error)
      showMessage(i18n.loadFoldersFailed || "加载文件夹失败", 3000, "error")
    } finally {
      loadingFolders.value = false
    }
  }

  function openPath(path: string): void {
    try {
      if (window.require) {
        const { shell } = window.require("electron")
        shell.openPath(path)
        showMessage(i18n.opened || "已打开", 2000, "info")
      } else {
        showMessage(
          i18n.openDiskNotSupported || "当前环境不支持打开文件夹",
          3000,
          "error",
        )
      }
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
      loadFoldersFromPath(pathToRefresh, true)
      showMessage(i18n.refreshing || "正在刷新...", 2000, "info")
    }
  }

  async function loadFoldersFromPath(
    path: string,
    forceRefresh = false,
  ): Promise<void> {
    const cachedFolders = folderCacheMap.value.get(path)
    if (!forceRefresh && isCacheValid(cachedFolders, cacheExpiryTime)) {
      folders.value = cachedFolders.data
      return
    }

    loadingFolders.value = true
    folders.value = []

    try {
      if (window.require) {
        const command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-ChildItem -Path '${path}' -ErrorAction SilentlyContinue | Where-Object { -not $_.Attributes.HasFlag([System.IO.FileAttributes]::Hidden) } | Select-Object Name, @{Name='IsFile';Expression={-not $_.PSIsContainer}}, Length, LastWriteTime | ConvertTo-Json -Compress"`
        const { stdout } = await retryExec(command, 1, 5000, "获取文件夹列表")

        const itemList = processItemList(stdout, path)
        folders.value = itemList
        folderCacheMap.value.set(path, {
          data: itemList,
          timestamp: Date.now(),
        })
      }
    } catch (error) {
      console.error("加载文件夹失败:", error)
      showMessage(i18n.loadFoldersFailed || "加载文件夹失败", 3000, "error")
    } finally {
      loadingFolders.value = false
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
    await loadFoldersFromPath(item.path)
  }

  async function navigateBack(): Promise<void> {
    if (!currentPath.value) return

    const lastSlash = currentPath.value.lastIndexOf("\\")
    if (lastSlash > 0) {
      const parentPath = currentPath.value.substring(0, lastSlash)
      if (parentPath.endsWith(":")) {
        currentPath.value = ""
        await loadFolders(expandedDisk.value)
      } else {
        currentPath.value = parentPath
        await loadFoldersFromPath(parentPath)
      }
    } else {
      navigateToRoot()
    }
  }

  async function navigateToRoot(): Promise<void> {
    currentPath.value = ""
    await loadFolders(expandedDisk.value)
  }

  async function navigateToPath(segmentIndex: number): Promise<void> {
    const segments = pathSegments.value.slice(0, segmentIndex + 1)
    const newPath = `${expandedDisk.value}\\${segments.join("\\")}`
    currentPath.value = newPath
    await loadFoldersFromPath(newPath)
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
      selectedDisk.value = drive

      if (path === drive || path === `${drive}\\`) {
        currentPath.value = ""
        await loadFolders(drive)
      } else {
        currentPath.value = path
        await loadFoldersFromPath(path)
      }

      showMessage(i18n.navigatedToFavorite || "已跳转到收藏夹", 2000, "info")
    } catch (error) {
      console.error("导航到收藏夹失败:", error)
      showMessage(i18n.navigationFailed || "导航失败", 2000, "error")
    }
  }

  async function copyPathToClipboard(path: string): Promise<void> {
    const success = await copyToClipboard(path, i18n)
    showMessage(
      success ? i18n.pathCopied || "路径已复制" : i18n.copyFailed || "复制失败",
      2000,
      success ? "info" : "error",
    )
  }

  const formatDateWithI18n = (dateString: string): string =>
    formatDate(dateString, i18n)

  function init(): void {
    loadFavorites()
    fetchDisks()
  }

  function destroy(): void {
    // 清理资源
  }

  onMounted(() => {
    init()
  })

  onUnmounted(() => {
    destroy()
  })

  return {
    disks,
    selectedDisk,
    expandedDisk,
    folders,
    loading,
    loadingFolders,
    currentPath,
    favoriteFolders,
    pathSegments,
    currentDisplayPath,
    cacheStatus,
    currentFolderCache,
    toggleFavorite,
    isFavorite,
    fetchDisks,
    toggleDisk,
    loadFolders,
    openPath,
    refreshDisks,
    refreshCurrentFolder,
    loadFoldersFromPath,
    handleItemDoubleClick,
    navigateIntoFolder,
    navigateBack,
    navigateToRoot,
    navigateToPath,
    navigateToFavorite,
    copyPathToClipboard,
    formatDate: formatDateWithI18n,
    formatSize,
    getFolderName,
  }
}
