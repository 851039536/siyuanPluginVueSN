// 磁盘浏览器核心逻辑 composable — 磁盘枚举、目录浏览、收藏夹与会话内缓存
import type {
  ComputedRef,
  Ref,
} from "vue"
import type {
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
import { openPathInShell } from "@/utils/electronDialog"
import { getElectronModules } from "@/utils/nodeModules"
import {
  formatDate,
  listDrives,
  readDirectoryContents,
} from "../utils"

/** 依赖注入契约（遵循 AGENTS_ARCH.md § Composable 模式要求） */
export interface UseDiskBrowserDeps {
  i18n: DiskBrowserI18n
  storage: DiskBrowserStorage
}

export function useDiskBrowser(deps: UseDiskBrowserDeps): {
  disks: Ref<DiskInfo[]>
  expandedDisk: Ref<string>
  folders: Ref<FolderInfo[]>
  loading: Ref<boolean>
  loadingFolders: Ref<boolean>
  loadError: Ref<string>
  currentPath: Ref<string>
  favoriteFolders: Ref<string[]>
  favoriteSet: ComputedRef<Set<string>>
  pathSegments: ComputedRef<string[]>
  totalCapacity: ComputedRef<number>
  totalUsed: ComputedRef<number>
  toggleFavorite: (folderPath: string) => Promise<void>
  toggleDisk: (disk: DiskInfo) => Promise<void>
  openPath: (path: string) => Promise<void>
  refreshDisks: () => void
  refreshCurrentFolder: () => void
  handleItemDoubleClick: (item: FolderInfo) => void
  navigateIntoFolder: (item: FolderInfo) => Promise<void>
  navigateBack: () => Promise<void>
  navigateToRoot: () => Promise<void>
  navigateToPath: (segmentIndex: number) => Promise<void>
  navigateToFavorite: (path: string) => Promise<void>
  copyPathToClipboard: (path: string) => Promise<void>
  formatDate: (dateString: string) => string
} {
  const { i18n, storage } = deps

  const disks = ref<DiskInfo[]>([])
  const expandedDisk = ref("")
  const folders = ref<FolderInfo[]>([])
  const loading = ref(false)
  const loadingFolders = ref(false)
  const loadError = ref("")
  const currentPath = ref("")
  const favoriteFolders = ref<string[]>([])
  const favoriteSet = computed(() => new Set(favoriteFolders.value))

  // 会话内记忆化：面板存活期间避免重复的磁盘探测与目录读取，关闭面板即随之释放
  const cachedDisks = ref<DiskInfo[] | null>(null)
  const folderCache = ref<Map<string, FolderInfo[]>>(new Map())

  const pathSegments = computed(() => {
    if (!currentPath.value || currentPath.value === expandedDisk.value)
      return []
    const pathWithoutDrive = currentPath.value.replace(
      `${expandedDisk.value}\\`,
      "",
    )
    return pathWithoutDrive.split("\\").filter(Boolean)
  })

  const totalCapacity = computed(() =>
    disks.value.reduce((sum, disk) => sum + (disk.total ?? 0), 0),
  )

  const totalUsed = computed(() =>
    disks.value.reduce((sum, disk) => sum + (disk.used ?? 0), 0),
  )

  async function toggleFavorite(folderPath: string): Promise<void> {
    const previous = [...favoriteFolders.value]
    const index = favoriteFolders.value.indexOf(folderPath)
    if (index > -1) {
      favoriteFolders.value.splice(index, 1)
    } else {
      favoriteFolders.value.push(folderPath)
    }

    try {
      await storage.saveFavorites(favoriteFolders.value)
      showMessage(
        index > -1 ? i18n.favoriteRemoved ?? "" : i18n.favoriteAdded ?? "",
        2000,
        "info",
      )
    } catch (error) {
      favoriteFolders.value = previous
      console.error("保存收藏夹失败:", error)
      showMessage(i18n.favoriteSaveFailed ?? "", 3000, "error")
    }
  }

  async function loadFavorites(): Promise<void> {
    try {
      favoriteFolders.value = await storage.loadFavorites()
    } catch (error) {
      console.error("加载收藏夹失败:", error)
      favoriteFolders.value = []
    }
  }

  async function fetchDisks(forceRefresh = false): Promise<void> {
    if (!forceRefresh && cachedDisks.value) {
      disks.value = cachedDisks.value
      return
    }

    loading.value = true
    try {
      const detected = listDrives()
      if (detected === null) {
        // 无 Node 环境：属能力缺失而非空结果，仅清理列表不做错误提示
        disks.value = []
        return
      }
      disks.value = detected
      cachedDisks.value = detected
    } catch (error) {
      console.error("获取磁盘列表失败:", error)
      showMessage(i18n.loadDisksFailed ?? "", 3000, "error")
      disks.value = []
    } finally {
      loading.value = false
    }
  }

  async function toggleDisk(disk: DiskInfo): Promise<void> {
    if (expandedDisk.value === disk.drive) {
      expandedDisk.value = ""
      folders.value = []
      currentPath.value = ""
      loadError.value = ""
      return
    }

    expandedDisk.value = disk.drive
    await setCurrentPath("")
  }

  /** 加载目录内容；缓存命中直接复用，失败置 `loadError` 以区分「空目录」与「读取失败」 */
  async function loadFolderContent(
    path: string,
    forceRefresh = false,
  ): Promise<void> {
    loadError.value = ""

    if (!forceRefresh) {
      const cached = folderCache.value.get(path)
      if (cached) {
        folders.value = cached
        return
      }
    }

    loadingFolders.value = true
    folders.value = []

    try {
      // 盘符根路径需补尾反斜杠（"C:" 表示当前目录，需写作 "C:\"）
      const displayPath = /^[A-Z]:$/i.test(path) ? `${path}\\` : path
      const itemList = readDirectoryContents(displayPath)
      if (itemList === null) {
        loadError.value = i18n.loadFoldersFailed ?? ""
        return
      }
      folders.value = itemList
      folderCache.value.set(path, itemList)
    } catch (error) {
      console.error("加载文件夹失败:", error)
      loadError.value = i18n.loadFoldersFailed ?? ""
    } finally {
      loadingFolders.value = false
    }
  }

  async function openPath(path: string): Promise<void> {
    // 非桌面端无 Electron shell：属能力缺失而非操作失败，给出可区分的提示
    if (!getElectronModules()) {
      showMessage(i18n.openDiskNotSupported ?? "", 3000, "error")
      return
    }
    const opened = await openPathInShell(path)
    showMessage(
      opened ? i18n.opened ?? "" : i18n.openDiskFailed ?? "",
      2000,
      opened ? "info" : "error",
    )
  }

  function refreshDisks(): void {
    void fetchDisks(true)
    showMessage(i18n.refreshing ?? "", 2000, "info")
  }

  function refreshCurrentFolder(): void {
    const pathToRefresh = currentPath.value || expandedDisk.value
    if (!pathToRefresh) return
    void loadFolderContent(pathToRefresh, true)
    showMessage(i18n.refreshing ?? "", 2000, "info")
  }

  function handleItemDoubleClick(item: FolderInfo): void {
    if (item.isFile) {
      void openPath(item.path)
    } else {
      void navigateIntoFolder(item)
    }
  }

  async function navigateIntoFolder(item: FolderInfo): Promise<void> {
    await setCurrentPath(item.path)
  }

  async function navigateBack(): Promise<void> {
    if (!currentPath.value) return

    const lastSlash = currentPath.value.lastIndexOf("\\")
    if (lastSlash <= 0) {
      await navigateToRoot()
      return
    }

    const parentPath = currentPath.value.substring(0, lastSlash)
    await setCurrentPath(parentPath.endsWith(":") ? "" : parentPath)
  }

  async function navigateToRoot(): Promise<void> {
    await setCurrentPath("")
  }

  async function navigateToPath(segmentIndex: number): Promise<void> {
    const segments = pathSegments.value.slice(0, segmentIndex + 1)
    await setCurrentPath(`${expandedDisk.value}\\${segments.join("\\")}`)
  }

  async function navigateToFavorite(path: string): Promise<void> {
    try {
      // 盘符大小写归一（收藏夹中可能存有小写形态）
      const driveMatch = path.match(/^([A-Za-z]:)/)
      if (!driveMatch) {
        showMessage(i18n.invalidPath ?? "", 2000, "error")
        return
      }

      const drive = driveMatch[1].toUpperCase()
      expandedDisk.value = drive

      const targetPath = path === drive || path === `${drive}\\` ? "" : path
      await setCurrentPath(targetPath)

      showMessage(i18n.navigatedToFavorite ?? "", 2000, "info")
    } catch (error) {
      console.error("导航到收藏夹失败:", error)
      showMessage(i18n.navigationFailed ?? "", 2000, "error")
    }
  }

  /** 统一设置当前路径并加载对应目录（空串表示当前磁盘根目录） */
  async function setCurrentPath(path: string): Promise<void> {
    currentPath.value = path
    await loadFolderContent(path || expandedDisk.value)
  }

  async function copyPathToClipboard(path: string): Promise<void> {
    const success = await copyToClipboard(path)
    showMessage(
      success ? i18n.pathCopied ?? "" : i18n.copyFailed ?? "",
      2000,
      success ? "info" : "error",
    )
  }

  const formatDateWithI18n = (dateString: string): string =>
    formatDate(dateString, i18n)

  onMounted(() => {
    void loadFavorites()
    void fetchDisks()
  })

  onUnmounted(() => {
    cachedDisks.value = null
    folderCache.value.clear()
  })

  return {
    disks,
    expandedDisk,
    folders,
    loading,
    loadingFolders,
    loadError,
    currentPath,
    favoriteFolders,
    favoriteSet,
    pathSegments,
    totalCapacity,
    totalUsed,
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
