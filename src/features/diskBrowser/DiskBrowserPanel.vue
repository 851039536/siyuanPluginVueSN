<template>
  <div class="disk-browser-panel">
    <div class="disk-browser-header">
      <h3>{{ i18n.panelTitle || '本地磁盘浏览器' }}</h3>
      <div class="header-actions">
        <Tag
          v-if="cacheStatus.text"
          :variant="cacheStatus.isExpired ? 'danger' : 'primary'"
          size="small"
          class="cache-tag"
          :class="{ expired: cacheStatus.isExpired }"
          :title="cacheStatus.tooltip"
        >
          {{ cacheStatus.text }}
        </Tag>
        <Button
          variant="ghost"
          size="small"
          icon="refresh"
          :icon-size="16"
          :loading="loading"
          :title="i18n.refreshing || '刷新'"
          @click="refreshDisks"
        />
      </div>
    </div>

    <!-- 横向磁盘列表 -->
    <div class="disk-list-horizontal">
      <Card
        v-for="disk in disks"
        :key="disk.drive"
        class="disk-card"
        :class="{ active: selectedDisk === disk.drive, expanded: expandedDisk === disk.drive }"
        variant="flat"
        size="small"
        :clickable="true"
        :active="selectedDisk === disk.drive"
        @click="toggleDisk(disk)"
      >
        <template #header>
          <div class="disk-card-header">
            <div class="disk-icon">
              <IconWrapper name="diskBrowser" :size="20" />
            </div>
            <div class="disk-info">
              <div class="disk-name">{{ disk.drive }}</div>
            </div>
            <div class="expand-indicator">
              <IconWrapper
                :name="expandedDisk === disk.drive ? 'chevronUp' : 'chevronDown'"
                :size="14"
              />
            </div>
          </div>
        </template>
        <div class="disk-card-body">
          <div class="disk-label" v-if="disk.label">{{ disk.label }}</div>
          <div class="disk-usage-bar" v-if="disk.total">
            <div class="usage-fill" :style="{ width: disk.usagePercent + '%' }"></div>
          </div>
          <div class="disk-space" v-if="disk.total">
            {{ formatSize(disk.used) }} / {{ formatSize(disk.total) }}
          </div>
        </div>
      </Card>
    </div>

    <!-- 收藏夹区域 -->
    <div class="favorites-section" v-if="favoriteFolders.length > 0">
      <div class="favorites-header">
        <IconWrapper name="star" :size="14" color="#f97316" />
        <span>{{ i18n.favorites || '收藏夹' }}</span>
        <Badge :content="favoriteFolders.length" variant="primary" size="small" />
      </div>
      <div class="favorites-list-horizontal">
        <div
          v-for="path in favoriteFolders"
          :key="path"
          class="favorite-card"
          @click="navigateToFavorite(path)"
          :title="path"
        >
          <div class="favorite-icon">
            <IconWrapper name="folder" :size="16" />
          </div>
          <div class="favorite-name">{{ getFolderName(path) }}</div>
          <Button
            variant="ghost"
            size="small"
            icon="close"
            :icon-size="12"
            class="favorite-remove-btn"
            :title="i18n.removeFavorite || '取消收藏'"
            @click.stop="toggleFavorite(path)"
          />
        </div>
      </div>
    </div>

    <!-- 文件夹列表区域 -->
    <div class="folder-list" v-if="expandedDisk">
      <!-- 面包屑导航 -->
      <div class="breadcrumb-nav" v-if="currentPath">
        <Button
          variant="ghost"
          size="small"
          icon="folder"
          :icon-size="14"
          class="breadcrumb-item"
          :title="i18n.backToRoot || '返回根目录'"
          @click="navigateToRoot()"
        >
          {{ expandedDisk }}
        </Button>
        <span v-for="(segment, index) in pathSegments" :key="index" class="breadcrumb-segment">
          <IconWrapper name="chevronRight" :size="10" />
          <Button
            variant="ghost"
            size="small"
            class="breadcrumb-item"
            :title="segment"
            @click="navigateToPath(index)"
          >
            {{ segment }}
          </Button>
        </span>
      </div>

      <div class="folder-list-header">
        <div class="header-left">
          <Button
            v-if="currentPath"
            variant="ghost"
            size="small"
            icon="back"
            :icon-size="16"
            class="back-btn"
            :title="i18n.back || '返回上级'"
            @click="navigateBack"
          />
          <span>{{ currentDisplayPath }}</span>
        </div>
        <div class="folder-header-actions">
          <Tag v-if="folders.length > 0" size="small" variant="default" class="item-count">
            {{ folders.length }} {{ i18n.items || '项' }}
          </Tag>
          <Tag
            v-if="currentFolderCache.text"
            :variant="currentFolderCache.isExpired ? 'danger' : 'info'"
            size="small"
            class="cache-tag-small"
            :title="currentFolderCache.tooltip"
          >
            {{ currentFolderCache.text }}
          </Tag>
          <Button
            variant="ghost"
            size="small"
            icon="refresh"
            :icon-size="14"
            :loading="loadingFolders"
            :title="i18n.refreshing || '刷新'"
            @click="refreshCurrentFolder"
          />
          <Button
            variant="ghost"
            size="small"
            icon="openInNew"
            :icon-size="14"
            :title="i18n.openInExplorer || '在资源管理器中打开'"
            @click="openPath(currentPath || expandedDisk)"
          />
          <Button
            variant="ghost"
            size="small"
            icon="contentCopy"
            :icon-size="14"
            :title="i18n.copyPath || '复制路径'"
            @click="copyPathToClipboard(currentPath || expandedDisk)"
          />
        </div>
      </div>

      <div class="folder-items" v-if="!loadingFolders">
        <div
          v-for="item in folders"
          :key="item.path"
          class="folder-item"
          :class="{ 'is-file': item.isFile }"
          @dblclick="handleItemDoubleClick(item)"
        >
          <div class="folder-icon">
            <IconWrapper :name="item.isFile ? 'file' : 'folder'" :size="20" />
          </div>
          <div class="folder-info">
            <div class="folder-name" :title="item.name">{{ item.name }}</div>
            <div class="folder-meta" v-if="item.size !== undefined || item.modifiedTime">
              <span v-if="item.isFile && item.size !== undefined" class="file-size">{{ formatSize(item.size) }}</span>
              <span v-if="item.modifiedTime" class="modified-time">{{ formatDate(item.modifiedTime) }}</span>
            </div>
          </div>
          <div class="folder-actions">
            <Button
              v-if="!item.isFile"
              variant="ghost"
              size="small"
              :icon="isFavorite(item.path) ? 'star' : 'starOutline'"
              :icon-size="14"
              class="folder-action-btn favorite-btn"
              :class="{ 'is-favorite': isFavorite(item.path) }"
              :title="isFavorite(item.path) ? (i18n.removeFavorite || '取消收藏') : (i18n.addFavorite || '添加收藏')"
              @click.stop="toggleFavorite(item.path)"
            />
            <Button
              v-if="!item.isFile"
              variant="ghost"
              size="small"
              icon="chevronRight"
              :icon-size="14"
              class="folder-action-btn"
              :title="i18n.browse || '浏览'"
              @click.stop="navigateIntoFolder(item)"
            />
            <Button
              variant="ghost"
              size="small"
              icon="openInNew"
              :icon-size="14"
              class="folder-action-btn"
              :title="i18n.open || '打开'"
              @click.stop="openPath(item.path)"
            />
            <Button
              variant="ghost"
              size="small"
              icon="contentCopy"
              :icon-size="14"
              class="folder-action-btn"
              :title="i18n.copyPath || '复制路径'"
              @click.stop="copyPathToClipboard(item.path)"
            />
          </div>
        </div>
        <div v-if="folders.length === 0" class="empty-state">
          <IconWrapper name="folder" :size="48" color="var(--b3-theme-on-surface-light)" />
          <p>{{ i18n.emptyFolder || '此文件夹为空' }}</p>
        </div>
      </div>
      <div class="loading-state" v-else>
        <div class="loading-spinner"></div>
        <span>{{ i18n.loading || '加载中...' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { showMessage } from 'siyuan'
import Button from '@/components/Button.vue'
import IconWrapper from '@/components/IconWrapper.vue'
import Card from '@/components/Card.vue'
import Tag from '@/components/Tag.vue'
import Badge from '@/components/Badge.vue'

interface DiskInfo {
  drive: string
  label?: string
  total?: number
  used?: number
  usagePercent?: number
}

interface FolderInfo {
  name: string
  path: string
  isFile?: boolean
  size?: number
  modifiedTime?: string
}

interface CacheData<T> {
  data: T
  timestamp: number
}

interface CacheStatus {
  text: string
  isExpired: boolean
  tooltip: string
}

interface Props {
  i18n: Record<string, string>
  storage: {
    saveFavorites: (favorites: string[]) => Promise<void>
    loadFavorites: () => Promise<string[] | null>
  }
}

const props = defineProps<Props>()

// 状态
const disks = ref<DiskInfo[]>([])
const selectedDisk = ref('')
const expandedDisk = ref('')
const folders = ref<FolderInfo[]>([])
const loading = ref(false)
const loadingFolders = ref(false)
const currentPath = ref('')
const favoriteFolders = ref<string[]>([])

// 缓存管理
let CACHE_EXPIRY_TIME = 60 * 60 * 1000 // 1小时
const diskCache = ref<CacheData<DiskInfo[]> | null>(null)
const folderCacheMap = ref<Map<string, CacheData<FolderInfo[]>>>(new Map())

// 防抖机制
let isExecutingCommand = false
let lastExecutionTime = 0
const DEBOUNCE_DELAY = 500

// 状态管理
let currentOperationId = 0
const operationMap = new Map<number, string>()
let cacheUpdateTimer: number | null = null

// 计算属性 - 路径段
const pathSegments = computed(() => {
  if (!currentPath.value || currentPath.value === expandedDisk.value) return []
  const pathWithoutDrive = currentPath.value.replace(expandedDisk.value + '\\', '')
  return pathWithoutDrive.split('\\').filter(Boolean)
})

// 计算属性 - 当前显示路径
const currentDisplayPath = computed(() => {
  if (!currentPath.value) return expandedDisk.value
  const segments = pathSegments.value
  return segments.length === 0 ? expandedDisk.value : segments[segments.length - 1]
})

// 计算属性 - 磁盘缓存状态
const cacheStatus = computed((): CacheStatus => {
  if (!diskCache.value) {
    return { text: '', isExpired: false, tooltip: '' }
  }

  const now = Date.now()
  const elapsed = now - diskCache.value.timestamp
  const remaining = CACHE_EXPIRY_TIME - elapsed

  if (remaining <= 0) {
    return {
      text: props.i18n.cacheExpired || '缓存已过期',
      isExpired: true,
      tooltip: props.i18n.cacheExpiredTooltip || '缓存已过期，点击刷新按钮获取最新数据'
    }
  }

  const minutes = Math.floor(remaining / 60000)
  return {
    text: `${minutes}${props.i18n.minutesRemaining || '分钟'}`,
    isExpired: false,
    tooltip: props.i18n.cacheValidTooltip || `缓存有效期剩余 ${minutes}分钟`
  }
})

// 计算属性 - 当前文件夹缓存状态
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
      text: props.i18n.expired || '已过期',
      isExpired: true,
      tooltip: props.i18n.cacheExpiredTooltip || '缓存已过期，点击刷新按钮获取最新数据'
    }
  }

  const minutes = Math.floor(remaining / 60000)
  return {
    text: `${minutes}${props.i18n.min || '分'}`,
    isExpired: false,
    tooltip: props.i18n.cacheValidTooltip || `缓存有效期剩余 ${minutes}分`
  }
})

/**
 * 网络环境检测
 */
function isNetworkSlow(): boolean {
  if (typeof navigator !== 'undefined' && (navigator as any).connection) {
    const connection = (navigator as any).connection
    return ['slow-2g', '2g', '3g'].includes(connection.effectiveType)
  }
  return false
}

/**
 * 动态调整缓存时间
 */
function updateCacheTime(): void {
  CACHE_EXPIRY_TIME = isNetworkSlow() ? 10 * 60 * 1000 : 60 * 60 * 1000
}

/**
 * 异步超时执行器
 */
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

/**
 * 带重试机制的执行器（带防抖和操作管理）
 */
async function retryExec(
  command: string,
  retries = 2,
  timeout = 3000,
  operationType = 'unknown'
): Promise<{ stdout: string; stderr: string }> {
  const operationId = ++currentOperationId
  operationMap.set(operationId, operationType)

  try {
    // 防抖检查
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

/**
 * 检查缓存是否有效
 */
function isCacheValid<T>(cacheData: CacheData<T> | null | undefined): cacheData is CacheData<T> {
  if (!cacheData) return false
  return Date.now() - cacheData.timestamp < CACHE_EXPIRY_TIME
}

/**
 * 切换文件夹收藏状态
 */
function toggleFavorite(folderPath: string): void {
  const index = favoriteFolders.value.indexOf(folderPath)
  if (index > -1) {
    favoriteFolders.value.splice(index, 1)
    showMessage(props.i18n.favoriteRemoved || '已取消收藏', 2000, 'info')
  } else {
    favoriteFolders.value.push(folderPath)
    showMessage(props.i18n.favoriteAdded || '已添加收藏', 2000, 'info')
  }
  saveFavorites()
}

/**
 * 检查文件夹是否已收藏
 */
function isFavorite(folderPath: string): boolean {
  return favoriteFolders.value.includes(folderPath)
}

/**
 * 保存收藏夹
 */
async function saveFavorites(): Promise<void> {
  try {
    await props.storage.saveFavorites(favoriteFolders.value)
  } catch (error) {
    console.error('保存收藏夹失败:', error)
  }
}

/**
 * 加载收藏夹
 */
async function loadFavorites(): Promise<void> {
  try {
    const favorites = await props.storage.loadFavorites()
    favoriteFolders.value = favorites || []
  } catch (error) {
    console.error('加载收藏夹失败:', error)
    favoriteFolders.value = []
  }
}

/**
 * 获取磁盘列表
 */
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
          .filter(disk => disk.Size)
          .map(disk => {
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
    showMessage(props.i18n.loadDisksFailed || '获取磁盘列表失败', 3000, 'error')
    disks.value = getDefaultDisks()
  } finally {
    loading.value = false
  }
}

/**
 * 获取默认磁盘列表
 */
function getDefaultDisks(): DiskInfo[] {
  return ['C:', 'D:', 'E:', 'F:', 'G:', 'H:'].map(drive => ({ drive }))
}

/**
 * 切换磁盘选择
 */
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

/**
 * 加载文件夹列表
 */
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
    showMessage(props.i18n.loadFoldersFailed || '加载文件夹失败', 3000, 'error')
  } finally {
    loadingFolders.value = false
  }
}

/**
 * 打开路径
 */
function openPath(path: string): void {
  try {
    if (window.require) {
      const { shell } = window.require('electron')
      shell.openPath(path)
      showMessage(props.i18n.opened || '已打开', 2000, 'info')
    } else {
      showMessage(props.i18n.openDiskNotSupported || '当前环境不支持打开文件夹', 3000, 'error')
    }
  } catch (error) {
    console.error('打开失败:', error)
    showMessage(props.i18n.openDiskFailed || '打开失败', 3000, 'error')
  }
}

/**
 * 刷新磁盘列表
 */
function refreshDisks(): void {
  fetchDisks(true)
  showMessage(props.i18n.refreshing || '正在刷新...', 2000, 'info')
}

/**
 * 刷新当前文件夹
 */
function refreshCurrentFolder(): void {
  const pathToRefresh = currentPath.value || expandedDisk.value
  if (pathToRefresh) {
    loadFoldersFromPath(pathToRefresh, true)
    showMessage(props.i18n.refreshing || '正在刷新...', 2000, 'info')
  }
}

/**
 * 从指定路径加载文件夹和文件
 */
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
      const { exec } = window.require('child_process')
      const util = window.require('util')
      const execPromise = util.promisify(exec)

      const command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-ChildItem -Path '${path}' -ErrorAction SilentlyContinue | Where-Object { -not $_.Attributes.HasFlag([System.IO.FileAttributes]::Hidden) } | Select-Object Name, @{Name='IsFile';Expression={-not $_.PSIsContainer}}, Length, LastWriteTime | ConvertTo-Json -Compress"`
      const { stdout } = await execPromise(command, { encoding: 'utf8' })

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

        // 文件夹在前，文件在后排序
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
    showMessage(props.i18n.loadFoldersFailed || '加载文件夹失败', 3000, 'error')
  } finally {
    loadingFolders.value = false
  }
}

/**
 * 处理项目双击
 */
function handleItemDoubleClick(item: FolderInfo): void {
  if (item.isFile) {
    openPath(item.path)
  } else {
    navigateIntoFolder(item)
  }
}

/**
 * 进入文件夹
 */
async function navigateIntoFolder(item: FolderInfo): Promise<void> {
  currentPath.value = item.path
  await loadFoldersFromPath(item.path)
}

/**
 * 返回上级目录
 */
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

/**
 * 返回根目录
 */
async function navigateToRoot(): Promise<void> {
  currentPath.value = ''
  await loadFolders(expandedDisk.value)
}

/**
 * 导航到指定路径段
 */
async function navigateToPath(segmentIndex: number): Promise<void> {
  const segments = pathSegments.value.slice(0, segmentIndex + 1)
  const newPath = `${expandedDisk.value}\\${segments.join('\\')}`
  currentPath.value = newPath
  await loadFoldersFromPath(newPath)
}

/**
 * 导航到收藏的文件夹
 */
async function navigateToFavorite(path: string): Promise<void> {
  try {
    const driveMatch = path.match(/^([A-Z]:)/)
    if (!driveMatch) {
      showMessage(props.i18n.invalidPath || '无效路径', 2000, 'error')
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

    showMessage(props.i18n.navigatedToFavorite || '已跳转到收藏夹', 2000, 'info')
  } catch (error) {
    console.error('导航到收藏夹失败:', error)
    showMessage(props.i18n.navigationFailed || '导航失败', 2000, 'error')
  }
}

/**
 * 复制路径到剪贴板
 */
function copyPathToClipboard(path: string): void {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(path).then(() => {
      showMessage(props.i18n.pathCopied || '路径已复制', 2000, 'info')
    }).catch(() => fallbackCopyToClipboard(path))
  } else {
    fallbackCopyToClipboard(path)
  }
}

/**
 * 后备复制方法
 */
function fallbackCopyToClipboard(text: string): void {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.cssText = 'position:fixed;opacity:0;'
  document.body.appendChild(textarea)
  textarea.select()
  try {
    document.execCommand('copy')
    showMessage(props.i18n.pathCopied || '路径已复制', 2000, 'info')
  } catch {
    showMessage(props.i18n.copyFailed || '复制失败', 2000, 'error')
  }
  document.body.removeChild(textarea)
}

/**
 * 格式化日期
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return props.i18n.today || '今天'
    if (days === 1) return props.i18n.yesterday || '昨天'
    if (days < 7) return `${days} ${props.i18n.daysAgo || '天前'}`

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  } catch {
    return dateString
  }
}

/**
 * 格式化文件大小
 */
function formatSize(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + units[i]
}

/**
 * 从路径中提取文件夹名称
 */
function getFolderName(path: string): string {
  const parts = path.split('\\')
  return parts[parts.length - 1] || path
}

onMounted(() => {
  loadFavorites()
  fetchDisks()
  cacheUpdateTimer = window.setInterval(() => {
    // 触发 computed 重新计算
    diskCache.value = diskCache.value
  }, 60000)
})

onUnmounted(() => {
  if (cacheUpdateTimer) {
    clearInterval(cacheUpdateTimer)
  }
})
</script>

<style scoped lang="scss">
@use "./index.scss";

// 覆盖和补充样式
.disk-card {
  &:deep(.si-card__header) {
    padding: 8px 10px;
    border-bottom: none;
  }

  &:deep(.si-card__body) {
    padding: 0 10px 10px;
  }
}

.disk-card-body {
  display: flex;
  flex-direction: column;
}

.cache-tag {
  &.expired {
    animation: pulse 2s ease-in-out infinite;
  }
}

.favorite-btn {
  &:deep(.si-button) {
    color: var(--b3-theme-on-surface);
  }

  &.is-favorite {
    &:deep(.si-button) {
      color: var(--b3-theme-primary);
    }
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
</style>
