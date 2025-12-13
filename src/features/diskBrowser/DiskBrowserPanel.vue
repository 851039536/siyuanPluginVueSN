<template>
  <div class="disk-browser-panel">
    <div class="disk-browser-header">
      <h3>{{ i18n.diskBrowserTitle || '本地磁盘浏览器' }}</h3>
      <div class="header-actions">
        <span v-if="cacheInfo" class="cache-info" :class="{ expired: isCacheExpired }" :title="getCacheTooltip()">
          {{ getCacheStatus() }}
        </span>
        <button class="refresh-btn-small" @click="refreshDisks" :disabled="loading" :title="i18n.refresh || '刷新'">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21C9.73633 21 7.66145 20.1182 6.09277 18.6475" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M3 8V12H7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 横向磁盘列表 -->
    <div class="disk-list-horizontal">
      <div
        v-for="disk in disks"
        :key="disk.drive"
        class="disk-card"
        :class="{ active: selectedDisk === disk.drive, expanded: expandedDisk === disk.drive }"
        @click="toggleDisk(disk)"
      >
        <div class="disk-card-header">
          <div class="disk-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 6H4C2.89543 6 2 6.89543 2 8V16C2 17.1046 2.89543 18 4 18H20C21.1046 18 22 17.1046 22 16V8C22 6.89543 21.1046 6 20 6Z" stroke="currentColor" stroke-width="2"/>
            </svg>
          </div>
          <div class="disk-info">
            <div class="disk-name">{{ disk.drive }}</div>
          </div>
          <div class="expand-indicator">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path :d="expandedDisk === disk.drive ? 'M19 15l-7-7-7 7' : 'M5 9l7 7 7-7'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>
        <div class="disk-label" v-if="disk.label">{{ disk.label }}</div>
        <div class="disk-usage-bar" v-if="disk.total">
          <div class="usage-fill" :style="{ width: disk.usagePercent + '%' }"></div>
        </div>
        <div class="disk-space" v-if="disk.total">
          {{ formatSize(disk.used) }} / {{ formatSize(disk.total) }}
        </div>
      </div>
    </div>

    <!-- 收藏夹区域 -->
    <div class="favorites-section" v-if="favoriteFolders.length > 0">
      <div class="favorites-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>{{ i18n.favorites || '收藏夹' }}</span>
        <span class="favorites-count">{{ favoriteFolders.length }}</span>
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 7V17C3 18.1046 3.89543 19 5 19H19C20.1046 19 21 18.1046 21 17V9C21 7.89543 20.1046 7 19 7H13L11 5H5C3.89543 5 3 5.89543 3 7Z" stroke="currentColor" stroke-width="2"/>
            </svg>
          </div>
          <div class="favorite-name">{{ getFolderName(path) }}</div>
          <button class="favorite-remove-btn" @click.stop="toggleFavorite(path)" :title="i18n.removeFavorite || '取消收藏'">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- 文件夹列表区域 -->
    <div class="folder-list" v-if="expandedDisk">
      <!-- 面包屑导航 -->
      <div class="breadcrumb-nav" v-if="currentPath">
        <button class="breadcrumb-item" @click="navigateToRoot()" :title="i18n.backToRoot || '返回根目录'">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          {{ expandedDisk }}
        </button>
        <span v-for="(segment, index) in pathSegments" :key="index" class="breadcrumb-segment">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <button class="breadcrumb-item" @click="navigateToPath(index)" :title="segment">
            {{ segment }}
          </button>
        </span>
      </div>

      <div class="folder-list-header">
        <div class="header-left">
          <button v-if="currentPath" class="back-btn" @click="navigateBack" :title="i18n.back || '返回上级'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <span>{{ getCurrentDisplayPath() }}</span>
        </div>
        <div class="folder-header-actions">
          <span class="item-count" v-if="folders.length > 0">
            {{ folders.length }} {{ i18n.items || '项' }}
          </span>
          <span v-if="getFolderCacheInfo(currentPath || expandedDisk)" class="cache-info-small" :class="{ expired: isFolderCacheExpired(currentPath || expandedDisk) }" :title="getFolderCacheTooltip(currentPath || expandedDisk)">
            {{ getFolderCacheStatus(currentPath || expandedDisk) }}
          </span>
          <button class="refresh-folder-btn" @click.stop="refreshCurrentFolder()" :disabled="loadingFolders" :title="i18n.refresh || '刷新'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21C9.73633 21 7.66145 20.1182 6.09277 18.6475" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <path d="M3 8V12H7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="open-disk-btn" @click="openPath(currentPath || expandedDisk)" :title="i18n.openInExplorer || '在资源管理器中打开'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <polyline points="15 3 21 3 21 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="10" y1="14" x2="21" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="copy-path-btn" @click="copyPathToClipboard(currentPath || expandedDisk)" :title="i18n.copyPath || '复制路径'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
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
            <svg v-if="!item.isFile" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 7V17C3 18.1046 3.89543 19 5 19H19C20.1046 19 21 18.1046 21 17V9C21 7.89543 20.1046 7 19 7H13L11 5H5C3.89543 5 3 5.89543 3 7Z" stroke="currentColor" stroke-width="2"/>
            </svg>
            <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <polyline points="13 2 13 9 20 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="folder-info">
            <div class="folder-name" :title="item.name">{{ item.name }}</div>
            <div class="folder-meta" v-if="item.size !== undefined || item.modifiedTime">
              <span v-if="item.isFile && item.size !== undefined" class="file-size">{{ formatSize(item.size) }}</span>
              <span v-if="item.modifiedTime" class="modified-time">{{ formatDate(item.modifiedTime) }}</span>
            </div>
          </div>
          <div class="folder-actions">
            <button v-if="!item.isFile" class="folder-action-btn favorite-btn"
                      @click.stop="toggleFavorite(item.path)"
                      :class="{ 'is-favorite': isFavorite(item.path) }"
                      :title="isFavorite(item.path) ? (i18n.removeFavorite || '取消收藏') : (i18n.addFavorite || '添加收藏')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path v-if="!isFavorite(item.path)" d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path v-else d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <button v-if="!item.isFile" class="folder-action-btn" @click.stop="navigateIntoFolder(item)" :title="i18n.browse || '浏览'">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <button class="folder-action-btn" @click.stop="openPath(item.path)" :title="i18n.open || '打开'">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <polyline points="15 3 21 3 21 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <line x1="10" y1="14" x2="21" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <button class="folder-action-btn" @click.stop="copyPathToClipboard(item.path)" :title="i18n.copyPath || '复制路径'">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
        <div v-if="folders.length === 0" class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 7V17C3 18.1046 3.89543 19 5 19H19C20.1046 19 21 18.1046 21 17V9C21 7.89543 20.1046 7 19 7H13L11 5H5C3.89543 5 3 5.89543 3 7Z" stroke="currentColor" stroke-width="2"/>
          </svg>
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
import { ref, onMounted, onUnmounted } from 'vue'
import { showMessage } from 'siyuan'

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
  isFavorite?: boolean
}

interface CacheData<T> {
  data: T
  timestamp: number
}

interface Props {
  i18n: any
  storage: any
}

const props = defineProps<Props>()
const disks = ref<DiskInfo[]>([])
const selectedDisk = ref<string>('')
const expandedDisk = ref<string>('')
const folders = ref<FolderInfo[]>([])
const loading = ref(false)
const loadingFolders = ref(false)
const currentPath = ref<string>('')
const pathSegments = ref<string[]>([])
const favoriteFolders = ref<string[]>([]) // 收藏的文件夹路径

// 缓存管理
let CACHE_EXPIRY_TIME = 60 * 60 * 1000 // 1小时缓存失效时间，将根据网络环境动态调整
const diskCache = ref<CacheData<DiskInfo[]> | null>(null)
const folderCacheMap = ref<Map<string, CacheData<FolderInfo[]>>>(new Map())
const cacheInfo = ref<string>('')
const isCacheExpired = ref(false)
let cacheUpdateTimer: number | null = null

// 防抖机制
let isExecutingCommand = false
let lastExecutionTime = 0
const DEBOUNCE_DELAY = 500 // 500ms 防抖延迟

// 状态管理
let currentOperationId = 0
const operationMap = new Map<number, string>() // operationId -> operationType

/**
 * 网络环境检测
 */
function isNetworkSlow(): boolean {
  if (typeof navigator !== 'undefined' && (navigator as any).connection) {
    const connection = (navigator as any).connection
    return connection.effectiveType === 'slow-2g' ||
           connection.effectiveType === '2g' ||
           connection.effectiveType === '3g'
  }
  return false
}

/**
 * 动态调整缓存时间
 */
function updateCacheTime() {
  if (isNetworkSlow()) {
    CACHE_EXPIRY_TIME = 10 * 60 * 1000 // 网络慢时缓存10分钟
  } else {
    CACHE_EXPIRY_TIME = 60 * 60 * 1000 // 网络正常时缓存1小时
  }
}

/**
 * 异步超时执行器
 */
async function execWithTimeout(command: string, timeout: number = 3000): Promise<{ stdout: string; stderr: string }> {
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
 * 获取操作ID
 */
function getOperationId(): number {
  return ++currentOperationId
}

/**
 * 设置操作状态
 */
function setOperationStatus(operationId: number, type: string) {
  operationMap.set(operationId, type)
}

/**
 * 清理操作状态
 */
function clearOperationStatus(operationId: number) {
  operationMap.delete(operationId)
}

/**
 * 检查操作状态
 */
function getOperationStatus(operationId: number): string | undefined {
  return operationMap.get(operationId)
}

/**
 * 切换文件夹收藏状态
 */
function toggleFavorite(folderPath: string) {
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
 * 保存收藏夹到思源存储
 */
async function saveFavorites() {
  try {
    await props.storage.saveFavorites(favoriteFolders.value)
  } catch (error) {
    console.error('保存收藏夹失败:', error)
  }
}

/**
 * 从思源存储加载收藏夹
 */
async function loadFavorites() {
  try {
    const favorites = await props.storage.loadFavorites()
    favoriteFolders.value = favorites || []
  } catch (error) {
    console.error('加载收藏夹失败:', error)
    favoriteFolders.value = []
  }
}

/**
 * 带重试机制的执行器（带防抖和操作管理）
 */
async function retryExec(command: string, retries: number = 2, timeout: number = 3000, operationType: string = 'unknown'): Promise<{ stdout: string; stderr: string }> {
  const operationId = getOperationId()
  setOperationStatus(operationId, operationType)

  try {
    // 防抖检查
    const now = Date.now()
    if (isExecutingCommand || (now - lastExecutionTime < DEBOUNCE_DELAY)) {
      // 如果正在执行或距离上次执行太近，等待
      while (isExecutingCommand) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // 再次检查时间间隔
      const waitTime = DEBOUNCE_DELAY - (Date.now() - lastExecutionTime)
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }

    // 检查操作是否仍然有效
    if (getOperationStatus(operationId) !== operationType) {
      throw new Error('操作已被取消')
    }

    isExecutingCommand = true
    lastExecutionTime = Date.now()

    let lastError: Error | null = null

    for (let i = 0; i <= retries; i++) {
      // 检查操作是否仍然有效
      if (getOperationStatus(operationId) !== operationType) {
        throw new Error('操作已被取消')
      }

      try {
        const result = await execWithTimeout(command, timeout)
        return result
      } catch (error) {
        lastError = error as Error
        if (i === retries) {
          throw new Error(`${operationType}失败，重试${retries}次后仍失败: ${lastError.message}`)
        }
        // 指数退避重试
        const delay = Math.min(1000 * Math.pow(2, i), 3000)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw lastError || new Error('未知错误')
  } finally {
    isExecutingCommand = false
    clearOperationStatus(operationId)
  }
}

/**
 * 检查缓存是否过期
 */
function isCacheValid(cacheData: CacheData<any> | null | undefined): boolean {
  if (!cacheData) return false
  const now = Date.now()
  return now - cacheData.timestamp < CACHE_EXPIRY_TIME
}

/**
 * 获取磁盘列表（带缓存和优化）
 */
async function fetchDisks(forceRefresh = false) {
  // 更新缓存时间策略
  updateCacheTime()

  // 如果有有效缓存且不强制刷新，使用缓存
  if (!forceRefresh && diskCache.value && isCacheValid(diskCache.value)) {
    disks.value = diskCache.value.data
    updateCacheInfo()
    return
  }

  loading.value = true
  try {
    // Windows 平台获取磁盘列表
    if (window.require) {
      try {
        // 使用 PowerShell 获取磁盘信息，避免乱码
        const command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-WmiObject Win32_LogicalDisk | Select-Object DeviceID, VolumeName, Size, FreeSpace | ConvertTo-Json -Compress"`
        const { stdout } = await retryExec(command, 2, 3000, '获取磁盘列表')

        const diskData = JSON.parse(stdout)
        const diskArray = Array.isArray(diskData) ? diskData : [diskData]

        const diskList: DiskInfo[] = []
        for (const disk of diskArray) {
          if (disk.Size) {
            const totalSpace = parseInt(disk.Size) || 0
            const freeSpace = parseInt(disk.FreeSpace) || 0
            const used = totalSpace - freeSpace
            const usagePercent = Math.round((used / totalSpace) * 100)

            diskList.push({
              drive: disk.DeviceID,
              label: disk.VolumeName ? String(disk.VolumeName).trim() : '',
              total: totalSpace,
              used,
              usagePercent
            })
          }
        }

        disks.value = diskList
        // 更新缓存
        diskCache.value = {
          data: diskList,
          timestamp: Date.now()
        }
        updateCacheInfo()
      } catch (error) {
        console.error('获取磁盘信息失败:', error)
        // 如果 wmic 失败，回退到简单的磁盘列表
        disks.value = getDefaultDisks()
      }
    } else {
      // 非 Electron 环境，显示默认磁盘列表
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
 * 获取默认磁盘列表（Windows）
 */
function getDefaultDisks(): DiskInfo[] {
  const letters = ['C:', 'D:', 'E:', 'F:', 'G:', 'H:']
  return letters.map(drive => ({ drive }))
}

/**
 * 切换磁盘选择和展开
 */
async function toggleDisk(disk: DiskInfo) {
  if (expandedDisk.value === disk.drive) {
    expandedDisk.value = ''
    selectedDisk.value = ''
    folders.value = []
    currentPath.value = ''
    pathSegments.value = []
  } else {
    expandedDisk.value = disk.drive
    selectedDisk.value = disk.drive
    currentPath.value = ''
    pathSegments.value = []
    await loadFolders(disk.drive)
  }
}

/**
 * 加载文件夹列表（带缓存和优化）
 */
async function loadFolders(drive: string, forceRefresh = false) {
  // 更新缓存时间策略
  updateCacheTime()

  // 如果有有效缓存且不强制刷新，使用缓存
  const cachedFolders = folderCacheMap.value.get(drive)
  if (!forceRefresh && cachedFolders && isCacheValid(cachedFolders)) {
    folders.value = cachedFolders.data
    return
  }

  loadingFolders.value = true
  folders.value = []

  try {
    if (window.require) {
      // 使用 PowerShell 解决编码问题，过滤隐藏属性的文件夹
      const command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -Path '${drive}\\' -Directory -ErrorAction SilentlyContinue | Where-Object { -not $_.Attributes.HasFlag([System.IO.FileAttributes]::Hidden) } | Select-Object -ExpandProperty Name | ForEach-Object { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Write-Output $_ }"`
      const { stdout } = await retryExec(command, 1, 5000, '获取文件夹列表')

      const folderList: FolderInfo[] = []

      // 处理 cmd 命令输出
      if (stdout && stdout.trim()) {
        const lines = stdout.trim().split('\n')
        for (const line of lines) {
          const folderName = line.trim()
          if (folderName && folderName !== '.' && folderName !== '..') {
            folderList.push({
              name: folderName,
              path: `${drive}\\${folderName}`
            })
          }
        }
      }

      folders.value = folderList
      // 更新缓存
      folderCacheMap.value.set(drive, {
        data: folderList,
        timestamp: Date.now()
      })
    }
  } catch (error) {
    console.error('加载文件夹失败:', error)
    showMessage(props.i18n.loadFoldersFailed || '加载文件夹失败', 3000, 'error')
  } finally {
    loadingFolders.value = false
  }
}

/**
 * 打开路径（磁盘或文件夹）
 */
function openPath(path: string) {
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
 * 刷新磁盘列表（强制刷新）
 */
function refreshDisks() {
  fetchDisks(true)
  showMessage(props.i18n.refreshing || '正在刷新...', 2000, 'info')
}



/**
 * 刷新当前文件夹
 */
function refreshCurrentFolder() {
  const pathToRefresh = currentPath.value || expandedDisk.value
  if (pathToRefresh) {
    loadFoldersFromPath(pathToRefresh, true)
    showMessage(props.i18n.refreshing || '正在刷新...', 2000, 'info')
  }
}

/**
 * 更新缓存信息显示
 */
function updateCacheInfo() {
  if (!diskCache.value) {
    cacheInfo.value = ''
    isCacheExpired.value = false
    return
  }

  const now = Date.now()
  const elapsed = now - diskCache.value.timestamp
  const remaining = CACHE_EXPIRY_TIME - elapsed

  if (remaining <= 0) {
    cacheInfo.value = props.i18n.cacheExpired || '缓存已过期'
    isCacheExpired.value = true
  } else {
    const minutes = Math.floor(remaining / 60000)
    cacheInfo.value = `${minutes}${props.i18n.minutesRemaining || '分钟'}`
    isCacheExpired.value = false
  }
}

/**
 * 获取缓存状态文本
 */
function getCacheStatus(): string {
  return cacheInfo.value
}

/**
 * 获取缓存提示信息
 */
function getCacheTooltip(): string {
  if (isCacheExpired.value) {
    return props.i18n.cacheExpiredTooltip || '缓存已过期，点击刷新按钮获取最新数据'
  }
  return props.i18n.cacheValidTooltip || `缓存有效期剩余 ${cacheInfo.value}`
}

/**
 * 获取文件夹缓存信息
 */
function getFolderCacheInfo(drive: string): string {
  const cached = folderCacheMap.value.get(drive)
  if (!cached) return ''

  const now = Date.now()
  const elapsed = now - cached.timestamp
  const remaining = CACHE_EXPIRY_TIME - elapsed

  if (remaining <= 0) {
    return props.i18n.expired || '已过期'
  } else {
    const minutes = Math.floor(remaining / 60000)
    return `${minutes}${props.i18n.min || '分'}`
  }
}

/**
 * 检查文件夹缓存是否过期
 */
function isFolderCacheExpired(drive: string): boolean {
  const cached = folderCacheMap.value.get(drive)
  if (!cached) return false
  return !isCacheValid(cached)
}

/**
 * 获取文件夹缓存状态
 */
function getFolderCacheStatus(drive: string): string {
  return getFolderCacheInfo(drive)
}

/**
 * 获取文件夹缓存提示
 */
function getFolderCacheTooltip(drive: string): string {
  if (isFolderCacheExpired(drive)) {
    return props.i18n.cacheExpiredTooltip || '缓存已过期，点击刷新按钮获取最新数据'
  }
  return props.i18n.cacheValidTooltip || `缓存有效期剩余 ${getFolderCacheInfo(drive)}`
}

/**
 * 从指定路径加载文件夹和文件（带缓存）
 */
async function loadFoldersFromPath(path: string, forceRefresh = false) {
  const cachedFolders = folderCacheMap.value.get(path)
  if (!forceRefresh && cachedFolders && isCacheValid(cachedFolders)) {
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

      // 获取文件夹和文件信息，过滤隐藏属性的文件
      const command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-ChildItem -Path '${path}' -ErrorAction SilentlyContinue | Where-Object { -not $_.Attributes.HasFlag([System.IO.FileAttributes]::Hidden) } | Select-Object Name, @{Name='IsFile';Expression={-not $_.PSIsContainer}}, Length, LastWriteTime | ConvertTo-Json -Compress"`
      const { stdout } = await execPromise(command, { encoding: 'utf8' })

      const itemList: FolderInfo[] = []
      try {
        const itemData = JSON.parse(stdout)
        const itemArray = Array.isArray(itemData) ? itemData : [itemData]

        for (const item of itemArray) {
          if (item && item.Name) {
            const itemName = String(item.Name).trim()
            const itemPath = path.endsWith('\\') || path.endsWith(':') ? `${path}\\${itemName}` : `${path}\\${itemName}`

            itemList.push({
              name: itemName,
              path: itemPath.replace(/\\\\/g, '\\'),
              isFile: item.IsFile || false,
              size: item.Length ? parseInt(item.Length) : undefined,
              modifiedTime: item.LastWriteTime || undefined
            })
          }
        }

        // 按照文件夹在前，文件在后排序
        itemList.sort((a, b) => {
          if (a.isFile === b.isFile) {
            return a.name.localeCompare(b.name, 'zh-CN')
          }
          return a.isFile ? 1 : -1
        })
      } catch (e) {
        // 如果没有项目或解析失败，返回空列表
      }

      folders.value = itemList
      folderCacheMap.value.set(path, {
        data: itemList,
        timestamp: Date.now()
      })
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
function handleItemDoubleClick(item: FolderInfo) {
  if (item.isFile) {
    // 双击文件则打开
    openPath(item.path)
  } else {
    // 双击文件夹则进入
    navigateIntoFolder(item)
  }
}

/**
 * 进入文件夹
 */
async function navigateIntoFolder(item: FolderInfo) {
  currentPath.value = item.path
  updatePathSegments()
  await loadFoldersFromPath(item.path)
}

/**
 * 返回上级目录
 */
async function navigateBack() {
  if (!currentPath.value) return

  const lastSlash = currentPath.value.lastIndexOf('\\')
  if (lastSlash > 0) {
    const parentPath = currentPath.value.substring(0, lastSlash)
    // 如果是盘符根目录
    if (parentPath.endsWith(':')) {
      currentPath.value = ''
      pathSegments.value = []
      await loadFolders(expandedDisk.value)
    } else {
      currentPath.value = parentPath
      updatePathSegments()
      await loadFoldersFromPath(parentPath)
    }
  } else {
    // 返回根目录
    navigateToRoot()
  }
}

/**
 * 返回根目录
 */
async function navigateToRoot() {
  currentPath.value = ''
  pathSegments.value = []
  await loadFolders(expandedDisk.value)
}

/**
 * 导航到指定路径段
 */
async function navigateToPath(segmentIndex: number) {
  const segments = pathSegments.value.slice(0, segmentIndex + 1)
  const newPath = `${expandedDisk.value}\\${segments.join('\\')}`
  currentPath.value = newPath
  updatePathSegments()
  await loadFoldersFromPath(newPath)
}

/**
 * 更新路径段
 */
function updatePathSegments() {
  if (!currentPath.value || currentPath.value === expandedDisk.value) {
    pathSegments.value = []
    return
  }

  const pathWithoutDrive = currentPath.value.replace(expandedDisk.value + '\\', '')
  pathSegments.value = pathWithoutDrive.split('\\').filter(s => s)
}

/**
 * 获取当前显示路径
 */
function getCurrentDisplayPath(): string {
  if (!currentPath.value) {
    return expandedDisk.value
  }
  const segments = pathSegments.value
  if (segments.length === 0) {
    return expandedDisk.value
  }
  return segments[segments.length - 1]
}

/**
 * 复制路径到剪贴板
 */
function copyPathToClipboard(path: string) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(path).then(() => {
        showMessage(props.i18n.pathCopied || '路径已复制', 2000, 'info')
      }).catch(err => {
        console.error('复制失败:', err)
        fallbackCopyToClipboard(path)
      })
    } else {
      fallbackCopyToClipboard(path)
    }
  } catch (error) {
    console.error('复制路径失败:', error)
    showMessage(props.i18n.copyFailed || '复制失败', 2000, 'error')
  }
}

/**
 * 后备复制方法
 */
function fallbackCopyToClipboard(text: string) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  try {
    document.execCommand('copy')
    showMessage(props.i18n.pathCopied || '路径已复制', 2000, 'info')
  } catch (err) {
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

    if (days === 0) {
      return props.i18n.today || '今天'
    } else if (days === 1) {
      return props.i18n.yesterday || '昨天'
    } else if (days < 7) {
      return `${days} ${props.i18n.daysAgo || '天前'}`
    } else {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
  } catch (e) {
    return dateString
  }
}

/**
 * 格式化文件大小
 */
function formatSize(bytes: number): string {
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

/**
 * 导航到收藏的文件夹
 */
async function navigateToFavorite(path: string) {
  try {
    // 提取盘符
    const driveMatch = path.match(/^([A-Z]:)/)
    if (!driveMatch) {
      showMessage(props.i18n.invalidPath || '无效路径', 2000, 'error')
      return
    }

    const drive = driveMatch[1]

    // 展开对应的磁盘
    expandedDisk.value = drive
    selectedDisk.value = drive

    // 如果是根目录
    if (path === drive || path === drive + '\\') {
      currentPath.value = ''
      pathSegments.value = []
      await loadFolders(drive)
    } else {
      // 导航到具体路径
      currentPath.value = path
      updatePathSegments()
      await loadFoldersFromPath(path)
    }

    showMessage(props.i18n.navigatedToFavorite || '已跳转到收藏夹', 2000, 'info')
  } catch (error) {
    console.error('导航到收藏夹失败:', error)
    showMessage(props.i18n.navigationFailed || '导航失败', 2000, 'error')
  }
}

onMounted(() => {
  loadFavorites()
  fetchDisks()
  // 每分钟更新一次缓存状态
  cacheUpdateTimer = window.setInterval(() => {
    updateCacheInfo()
  }, 60000) // 60秒
})

onUnmounted(() => {
  if (cacheUpdateTimer) {
    clearInterval(cacheUpdateTimer)
  }
})
</script>

<style scoped lang="scss">
@use "./index.scss"
</style>
