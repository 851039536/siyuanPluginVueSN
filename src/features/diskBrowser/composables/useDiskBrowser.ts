import { ref, computed, onMounted, onUnmounted } from 'vue'
import { showMessage } from 'siyuan'
import type { DiskInfo, FolderInfo, CacheData, CacheStatus, DiskBrowserI18n } from '../types'
import { getDefaultDisks } from '../types'
import { DiskBrowserStorage } from '../types/storage'
import type { Plugin } from 'siyuan'

let CACHE_EXPIRY_TIME = 60 * 60 * 1000

const DEBOUNCE_DELAY = 500

let isExecutingCommand = false
let lastExecutionTime = 0
let currentOperationId = 0
const operationMap = new Map<number, string>()

function isNetworkSlow(): boolean {
  if (typeof navigator !== 'undefined' && (navigator as any).connection) {
    const connection = (navigator as any).connection
    return ['slow-2g', '2g', '3g'].includes(connection.effectiveType)
  }
  return false
}

function updateCacheTime(): void {
  CACHE_EXPIRY_TIME = isNetworkSlow() ? 10 * 60 * 1000 : 60 * 60 * 1000
}

async function execWithTimeout(command: string, timeout = 3000): Promise<{ stdout: string; stderr: string }> {
  if (!window.require) {
    throw new Error('当前环境不支持执行命令')
  }

  const { exec } = window.require('child_process')
  const util = window.require('util')
  const execPromise = util.promisify(exec)

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('执行超时')), timeout)
  })

  return Promise.race([execPromise(command), timeoutPromise])
}

async function retryExec(
  command: string,
  retries = 2,
  timeout = 3000,
  operationType = 'unknown'
): Promise<{ stdout: string; stderr: string }> {
  const operationId = ++currentOperationId
  operationMap.set(operationId, operationType)

  try {
    const now = Date.now()
    if (isExecutingCommand || (now - lastExecutionTime < DEBOUNCE_DELAY)) {
      while (isExecutingCommand) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      const waitTime = DEBOUNCE_DELAY - (Date.now() - lastExecutionTime)
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }

    if (operationMap.get(operationId) !== operationType) {
      throw new Error('操作已被取消')
    }

    isExecutingCommand = true
    lastExecutionTime = Date.now()

    let lastError: Error | null = null

    for (let i = 0; i <= retries; i++) {
      if (operationMap.get(operationId) !== operationType) {
        throw new Error('操作已被取消')
      }

      try {
        return await execWithTimeout(command, timeout)
      } catch (error) {
        lastError = error as Error
        if (i === retries) {
          throw new Error(`${operationType}失败，重试${retries}次后仍失败: ${lastError.message}`)
        }
        const delay = Math.min(1000 * Math.pow(2, i), 3000)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw lastError || new Error('未知错误')
  } finally {
    isExecutingCommand = false
    operationMap.delete(operationId)
  }
}

function isCacheValid<T>(cacheData: CacheData<T> | null | undefined): cacheData is CacheData<T> {
  if (!cacheData) return false
  return Date.now() - cacheData.timestamp < CACHE_EXPIRY_TIME
}

export function useDiskBrowser(plugin: Plugin, i18n: DiskBrowserI18n) {
  const storage = new DiskBrowserStorage(plugin)

  const disks = ref<DiskInfo[]>([])
  const selectedDisk = ref('')
  const expandedDisk = ref('')
  const folders = ref<FolderInfo[]>([])
  const loading = ref(false)
  const loadingFolders = ref(false)
  const currentPath = ref('')
  const favoriteFolders = ref<string[]>([])

  const diskCache = ref<CacheData<DiskInfo[]> | null>(null)
  const folderCacheMap = ref<Map<string, CacheData<FolderInfo[]>>>(new Map())

  let cacheUpdateTimer: number | null = null

  const pathSegments = computed(() => {
    if (!currentPath.value || currentPath.value === expandedDisk.value) return []
    const pathWithoutDrive = currentPath.value.replace(expandedDisk.value + '\\', '')
    return pathWithoutDrive.split('\\').filter(Boolean)
  })

  const currentDisplayPath = computed(() => {
    if (!currentPath.value) return expandedDisk.value
    const segments = pathSegments.value
    return segments.length === 0 ? expandedDisk.value : segments[segments.length - 1]
  })

  const cacheStatus = computed((): CacheStatus => {
    if (!diskCache.value) {
      return { text: '', isExpired: false, tooltip: '' }
    }

    const now = Date.now()
    const elapsed = now - diskCache.value.timestamp
    const remaining = CACHE_EXPIRY_TIME - elapsed

    if (remaining <= 0) {
      return {
        text: i18n.cacheExpired || '缓存已过期',
        isExpired: true,
        tooltip: i18n.cacheExpiredTooltip || '缓存已过期，点击刷新按钮获取最新数据'
      }
    }

    const minutes = Math.floor(remaining / 60000)
    return {
      text: `${minutes}${i18n.minutesRemaining || '分钟'}`,
      isExpired: false,
      tooltip: i18n.cacheValidTooltip || `缓存有效期剩余 ${minutes}分钟`
    }
  })

  const currentFolderCache = computed((): CacheStatus => {
    const path = currentPath.value || expandedDisk.value
    if (!path) return { text: '', isExpired: false, tooltip: '' }

    const cached = folderCacheMap.value.get(path)
    if (!cached) return { text: '', isExpired: false, tooltip: '' }

    const now = Date.now()
    const elapsed = now - cached.timestamp
    const remaining = CACHE_EXPIRY_TIME - elapsed

    if (remaining <= 0) {
      return {
        text: i18n.expired || '已过期',
        isExpired: true,
        tooltip: i18n.cacheExpiredTooltip || '缓存已过期，点击刷新按钮获取最新数据'
      }
    }

    const minutes = Math.floor(remaining / 60000)
    return {
      text: `${minutes}${i18n.min || '分'}`,
      isExpired: false,
      tooltip: i18n.cacheValidTooltip || `缓存有效期剩余 ${minutes}分`
    }
  })

  function toggleFavorite(folderPath: string): void {
    const index = favoriteFolders.value.indexOf(folderPath)
    if (index > -1) {
      favoriteFolders.value.splice(index, 1)
      showMessage(i18n.favoriteRemoved || '已取消收藏', 2000, 'info')
    } else {
      favoriteFolders.value.push(folderPath)
      showMessage(i18n.favoriteAdded || '已添加收藏', 2000, 'info')
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
      console.error('保存收藏夹失败:', error)
    }
  }

  async function loadFavorites(): Promise<void> {
    try {
      const favorites = await storage.loadFavorites()
      favoriteFolders.value = favorites
    } catch (error) {
      console.error('加载收藏夹失败:', error)
      favoriteFolders.value = []
    }
  }

  async function fetchDisks(forceRefresh = false): Promise<void> {
    updateCacheTime()

    if (!forceRefresh && isCacheValid(diskCache.value)) {
      disks.value = diskCache.value.data
      return
    }

    loading.value = true
    try {
      if (window.require) {
        try {
          const command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-WmiObject Win32_LogicalDisk | Select-Object DeviceID, VolumeName, Size, FreeSpace | ConvertTo-Json -Compress"`
          const { stdout } = await retryExec(command, 2, 3000, '获取磁盘列表')

          const diskData = JSON.parse(stdout)
          const diskArray = Array.isArray(diskData) ? diskData : [diskData]

          const diskList: DiskInfo[] = diskArray
            .filter((disk: any) => disk.Size)
            .map((disk: any) => {
              const totalSpace = parseInt(disk.Size) || 0
              const freeSpace = parseInt(disk.FreeSpace) || 0
              const used = totalSpace - freeSpace
              return {
                drive: disk.DeviceID,
                label: disk.VolumeName ? String(disk.VolumeName).trim() : '',
                total: totalSpace,
                used,
                usagePercent: Math.round((used / totalSpace) * 100)
              }
            })

          disks.value = diskList
          diskCache.value = { data: diskList, timestamp: Date.now() }
        } catch (error) {
          console.error('获取磁盘信息失败:', error)
          disks.value = getDefaultDisks()
        }
      } else {
        disks.value = getDefaultDisks()
      }
    } catch (error) {
      console.error('获取磁盘列表失败:', error)
      showMessage(i18n.loadDisksFailed || '获取磁盘列表失败', 3000, 'error')
      disks.value = getDefaultDisks()
    } finally {
      loading.value = false
    }
  }

  async function toggleDisk(disk: DiskInfo): Promise<void> {
    if (expandedDisk.value === disk.drive) {
      expandedDisk.value = ''
      selectedDisk.value = ''
      folders.value = []
      currentPath.value = ''
    } else {
      expandedDisk.value = disk.drive
      selectedDisk.value = disk.drive
      currentPath.value = ''
      await loadFolders(disk.drive)
    }
  }

  async function loadFolders(drive: string, forceRefresh = false): Promise<void> {
    updateCacheTime()

    const cachedFolders = folderCacheMap.value.get(drive)
    if (!forceRefresh && isCacheValid(cachedFolders)) {
      folders.value = cachedFolders.data
      return
    }

    loadingFolders.value = true
    folders.value = []

    try {
      if (window.require) {
        const command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -Path '${drive}\\' -Directory -ErrorAction SilentlyContinue | Where-Object { -not $_.Attributes.HasFlag([System.IO.FileAttributes]::Hidden) } | Select-Object -ExpandProperty Name | ForEach-Object { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Write-Output $_ }"`
        const { stdout } = await retryExec(command, 1, 5000, '获取文件夹列表')

        const folderList: FolderInfo[] = stdout
          ?.trim()
          .split('\n')
          .map(line => line.trim())
          .filter(name => name && name !== '.' && name !== '..')
          .map(name => ({
            name,
            path: `${drive}\\${name}`
          })) || []

        folders.value = folderList
        folderCacheMap.value.set(drive, { data: folderList, timestamp: Date.now() })
      }
    } catch (error) {
      console.error('加载文件夹失败:', error)
      showMessage(i18n.loadFoldersFailed || '加载文件夹失败', 3000, 'error')
    } finally {
      loadingFolders.value = false
    }
  }

  function openPath(path: string): void {
    try {
      if (window.require) {
        const { shell } = window.require('electron')
        shell.openPath(path)
        showMessage(i18n.opened || '已打开', 2000, 'info')
      } else {
        showMessage(i18n.openDiskNotSupported || '当前环境不支持打开文件夹', 3000, 'error')
      }
    } catch (error) {
      console.error('打开失败:', error)
      showMessage(i18n.openDiskFailed || '打开失败', 3000, 'error')
    }
  }

  function refreshDisks(): void {
    fetchDisks(true)
    showMessage(i18n.refreshing || '正在刷新...', 2000, 'info')
  }

  function refreshCurrentFolder(): void {
    const pathToRefresh = currentPath.value || expandedDisk.value
    if (pathToRefresh) {
      loadFoldersFromPath(pathToRefresh, true)
      showMessage(i18n.refreshing || '正在刷新...', 2000, 'info')
    }
  }

  async function loadFoldersFromPath(path: string, forceRefresh = false): Promise<void> {
    const cachedFolders = folderCacheMap.value.get(path)
    if (!forceRefresh && isCacheValid(cachedFolders)) {
      folders.value = cachedFolders.data
      return
    }

    loadingFolders.value = true
    folders.value = []

    try {
      if (window.require) {
        const command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-ChildItem -Path '${path}' -ErrorAction SilentlyContinue | Where-Object { -not $_.Attributes.HasFlag([System.IO.FileAttributes]::Hidden) } | Select-Object Name, @{Name='IsFile';Expression={-not $_.PSIsContainer}}, Length, LastWriteTime | ConvertTo-Json -Compress"`
        const { stdout } = await retryExec(command, 1, 5000, '获取文件夹列表')

        const itemList: FolderInfo[] = []
        try {
          const itemData = JSON.parse(stdout)
          const itemArray = Array.isArray(itemData) ? itemData : [itemData]

          for (const item of itemArray) {
            if (item?.Name) {
              const itemName = String(item.Name).trim()
              const separator = path.endsWith('\\') || path.endsWith(':') ? '' : '\\'
              itemList.push({
                name: itemName,
                path: `${path}${separator}${itemName}`.replace(/\\\\/g, '\\'),
                isFile: item.IsFile || false,
                size: item.Length ? parseInt(item.Length) : undefined,
                modifiedTime: item.LastWriteTime || undefined
              })
            }
          }

          itemList.sort((a, b) => {
            if (a.isFile === b.isFile) {
              return a.name.localeCompare(b.name, 'zh-CN')
            }
            return a.isFile ? 1 : -1
          })
        } catch (e) {
          // 解析失败返回空列表
        }

        folders.value = itemList
        folderCacheMap.value.set(path, { data: itemList, timestamp: Date.now() })
      }
    } catch (error) {
      console.error('加载文件夹失败:', error)
      showMessage(i18n.loadFoldersFailed || '加载文件夹失败', 3000, 'error')
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

    const lastSlash = currentPath.value.lastIndexOf('\\')
    if (lastSlash > 0) {
      const parentPath = currentPath.value.substring(0, lastSlash)
      if (parentPath.endsWith(':')) {
        currentPath.value = ''
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
    currentPath.value = ''
    await loadFolders(expandedDisk.value)
  }

  async function navigateToPath(segmentIndex: number): Promise<void> {
    const segments = pathSegments.value.slice(0, segmentIndex + 1)
    const newPath = `${expandedDisk.value}\\${segments.join('\\')}`
    currentPath.value = newPath
    await loadFoldersFromPath(newPath)
  }

  async function navigateToFavorite(path: string): Promise<void> {
    try {
      const driveMatch = path.match(/^([A-Z]:)/)
      if (!driveMatch) {
        showMessage(i18n.invalidPath || '无效路径', 2000, 'error')
        return
      }

      const drive = driveMatch[1]
      expandedDisk.value = drive
      selectedDisk.value = drive

      if (path === drive || path === drive + '\\') {
        currentPath.value = ''
        await loadFolders(drive)
      } else {
        currentPath.value = path
        await loadFoldersFromPath(path)
      }

      showMessage(i18n.navigatedToFavorite || '已跳转到收藏夹', 2000, 'info')
    } catch (error) {
      console.error('导航到收藏夹失败:', error)
      showMessage(i18n.navigationFailed || '导航失败', 2000, 'error')
    }
  }

  function copyPathToClipboard(path: string): void {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(path).then(() => {
        showMessage(i18n.pathCopied || '路径已复制', 2000, 'info')
      }).catch(() => fallbackCopyToClipboard(path))
    } else {
      fallbackCopyToClipboard(path)
    }
  }

  function fallbackCopyToClipboard(text: string): void {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.cssText = 'position:fixed;opacity:0;'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      document.execCommand('copy')
      showMessage(i18n.pathCopied || '路径已复制', 2000, 'info')
    } catch {
      showMessage(i18n.copyFailed || '复制失败', 2000, 'error')
    }
    document.body.removeChild(textarea)
  }

  function formatDate(dateString: string): string {
    try {
      const date = new Date(dateString)
      const now = new Date()
      const diff = now.getTime() - date.getTime()
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))

      if (days === 0) return i18n.today || '今天'
      if (days === 1) return i18n.yesterday || '昨天'
      if (days < 7) return `${days} ${i18n.daysAgo || '天前'}`

      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    } catch {
      return dateString
    }
  }

  function formatSize(bytes?: number): string {
    if (!bytes || bytes === 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    const k = 1024
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + units[i]
  }

  function getFolderName(path: string): string {
    const parts = path.split('\\')
    return parts[parts.length - 1] || path
  }

  function init(): void {
    loadFavorites()
    fetchDisks()
    cacheUpdateTimer = window.setInterval(() => {
      diskCache.value = diskCache.value
    }, 60000)
  }

  function destroy(): void {
    if (cacheUpdateTimer) {
      clearInterval(cacheUpdateTimer)
    }
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
    formatDate,
    formatSize,
    getFolderName
  }
}
