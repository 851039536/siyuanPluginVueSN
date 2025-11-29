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

    <!-- 文件夹列表区域 -->
    <div class="folder-list" v-if="expandedDisk">
      <div class="folder-list-header">
        <span>{{ expandedDisk }}</span>
        <div class="folder-header-actions">
          <span v-if="getFolderCacheInfo(expandedDisk)" class="cache-info-small" :class="{ expired: isFolderCacheExpired(expandedDisk) }" :title="getFolderCacheTooltip(expandedDisk)">
            {{ getFolderCacheStatus(expandedDisk) }}
          </span>
          <button class="refresh-folder-btn" @click.stop="refreshFolder(expandedDisk)" :disabled="loadingFolders" :title="i18n.refresh || '刷新'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21C9.73633 21 7.66145 20.1182 6.09277 18.6475" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <path d="M3 8V12H7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="open-disk-btn" @click="openPath(expandedDisk)" :title="i18n.openFolder || '打开文件夹'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <polyline points="15 3 21 3 21 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="10" y1="14" x2="21" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            {{ i18n.openFolder || '打开' }}
          </button>
        </div>
      </div>
      <div class="folder-items" v-if="!loadingFolders">
        <div
          v-for="folder in folders"
          :key="folder.path"
          class="folder-item"
          @dblclick="openPath(folder.path)"
        >
          <div class="folder-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 7V17C3 18.1046 3.89543 19 5 19H19C20.1046 19 21 18.1046 21 17V9C21 7.89543 20.1046 7 19 7H13L11 5H5C3.89543 5 3 5.89543 3 7Z" stroke="currentColor" stroke-width="2"/>
            </svg>
          </div>
          <div class="folder-name" :title="folder.name">{{ folder.name }}</div>
          <button class="folder-open-btn" @click.stop="openPath(folder.path)" :title="i18n.openFolder || '打开'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <polyline points="15 3 21 3 21 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="10" y1="14" x2="21" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
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
}

interface CacheData<T> {
  data: T
  timestamp: number
}

interface Props {
  i18n: any
}

const props = defineProps<Props>()
const disks = ref<DiskInfo[]>([])
const selectedDisk = ref<string>('')
const expandedDisk = ref<string>('')
const folders = ref<FolderInfo[]>([])
const loading = ref(false)
const loadingFolders = ref(false)

// 缓存管理
const CACHE_EXPIRY_TIME = 60 * 60 * 1000 // 1小时缓存失效时间
const diskCache = ref<CacheData<DiskInfo[]> | null>(null)
const folderCacheMap = ref<Map<string, CacheData<FolderInfo[]>>>(new Map())
const cacheInfo = ref<string>('')
const isCacheExpired = ref(false)
let cacheUpdateTimer: number | null = null

/**
 * 检查缓存是否过期
 */
function isCacheValid(cacheData: CacheData<any> | null | undefined): boolean {
  if (!cacheData) return false
  const now = Date.now()
  return now - cacheData.timestamp < CACHE_EXPIRY_TIME
}

/**
 * 获取磁盘列表（带缓存）
 */
async function fetchDisks(forceRefresh = false) {
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
      const { exec } = window.require('child_process')
      const util = window.require('util')
      const execPromise = util.promisify(exec)

      try {
        // 使用 PowerShell 获取磁盘信息，避免乱码
        const command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-WmiObject Win32_LogicalDisk | Select-Object DeviceID, VolumeName, Size, FreeSpace | ConvertTo-Json -Compress"`
        const { stdout } = await execPromise(command, { encoding: 'utf8' })

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
  // 点击卡片直接展开
  if (expandedDisk.value === disk.drive) {
    expandedDisk.value = ''
    selectedDisk.value = ''
    folders.value = []
  } else {
    expandedDisk.value = disk.drive
    selectedDisk.value = disk.drive
    await loadFolders(disk.drive)
  }
}

/**
 * 加载文件夹列表（带缓存）
 */
async function loadFolders(drive: string, forceRefresh = false) {
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
      const { exec } = window.require('child_process')
      const util = window.require('util')
      const execPromise = util.promisify(exec)

      // 使用 PowerShell 获取文件夹列表，排除隐藏文件夹
      const command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-ChildItem -Path '${drive}\\' -Directory -ErrorAction SilentlyContinue | Where-Object { -not $_.Attributes.HasFlag([System.IO.FileAttributes]::Hidden) } | Select-Object Name | ConvertTo-Json -Compress"`
      const { stdout } = await execPromise(command, { encoding: 'utf8' })

      const folderList: FolderInfo[] = []
      try {
        const folderData = JSON.parse(stdout)
        const folderArray = Array.isArray(folderData) ? folderData : [folderData]

        for (const folder of folderArray) {
          if (folder && folder.Name) {
            const folderName = String(folder.Name).trim()
            folderList.push({
              name: folderName,
              path: `${drive}\\${folderName}`
            })
          }
        }
      } catch (e) {
        // 如果没有文件夹或解析失败，返回空列表
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
 * 刷新文件夹列表（强制刷新）
 */
function refreshFolder(drive: string) {
  loadFolders(drive, true)
  showMessage(props.i18n.refreshing || '正在刷新...', 2000, 'info')
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
 * 格式化文件大小
 */
function formatSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + units[i]
}

onMounted(() => {
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
.disk-browser-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 14px;
  overflow: hidden;
}

.disk-browser-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  flex-shrink: 0;

  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
  }
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cache-info {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
  background: var(--b3-theme-primary-lightest);
  color: var(--b3-theme-primary);
  white-space: nowrap;
  transition: all 0.2s ease;

  &.expired {
    background: var(--b3-theme-error-lighter);
    color: var(--b3-theme-error);
    animation: pulse 2s ease-in-out infinite;
  }
}

.cache-info-small {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 3px;
  background: var(--b3-theme-primary-lightest);
  color: var(--b3-theme-primary);
  white-space: nowrap;
  transition: all 0.2s ease;

  &.expired {
    background: var(--b3-theme-error-lighter);
    color: var(--b3-theme-error);
  }
}

.refresh-btn-small {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: var(--b3-theme-surface-lighter);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;

    svg {
      animation: rotate 1s linear infinite;
    }
  }
}

// 横向磁盘列表
.disk-list-horizontal {
  display: flex;
  gap: 8px;
  padding: 12px;
  overflow-x: auto;
  overflow-y: hidden;
  flex-shrink: 0;

  &::-webkit-scrollbar {
    height: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--b3-theme-surface-lighter);
    border-radius: 3px;
  }
}

.disk-card {
  display: flex;
  flex-direction: column;
  min-width: 120px;
  max-width: 140px;
  padding: 10px;
  border-radius: 8px;
  background: var(--b3-theme-surface);
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;

  &:hover {
    background: var(--b3-theme-surface-lighter);
    transform: translateY(-2px);
  }

  &.active {
    border-color: var(--b3-theme-primary);
    background: var(--b3-theme-primary-lightest);
  }

  &.expanded {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
}

.disk-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.disk-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: var(--b3-theme-primary-lightest);
  color: var(--b3-theme-primary);
}

.disk-info {
  flex: 1;
  min-width: 0;
}

.disk-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.disk-label {
  font-size: 11px;
  color: var(--b3-theme-on-surface-light);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 6px;
  padding: 0 4px;
}

.expand-indicator {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--b3-theme-on-surface-light);
  transition: all 0.2s ease;
}

.disk-usage-bar {
  width: 100%;
  height: 4px;
  background: var(--b3-theme-surface-lighter);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 6px;
}

.usage-fill {
  height: 100%;
  background: var(--b3-theme-primary);
  transition: width 0.3s ease;
}

.disk-space {
  font-size: 11px;
  color: var(--b3-theme-on-surface-light);
  text-align: center;
  white-space: nowrap;
}

// 文件夹列表区域
.folder-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-top: 1px solid var(--b3-theme-surface-lighter);
}

.folder-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--b3-theme-surface);
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  flex-shrink: 0;

  span {
    font-size: 13px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
  }
}

.folder-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.refresh-folder-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: var(--b3-theme-surface-lighter);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;

    svg {
      animation: rotate 1s linear infinite;
    }
  }
}

.open-disk-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  background: var(--b3-theme-primary);
  color: white;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--b3-theme-primary-light);
  }
}

.folder-items {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.folder-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  margin-bottom: 4px;
  border-radius: 6px;
  background: var(--b3-theme-surface);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--b3-theme-surface-lighter);
    transform: translateX(2px);

    .folder-open-btn {
      opacity: 1;
    }
  }
}

.folder-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  color: var(--b3-theme-primary);
}

.folder-name {
  flex: 1;
  font-size: 13px;
  color: var(--b3-theme-on-background);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.folder-open-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: var(--b3-theme-primary);
  color: white;
  cursor: pointer;
  opacity: 0;
  transition: all 0.2s ease;

  &:hover {
    background: var(--b3-theme-primary-light);
    transform: scale(1.1);
  }
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  gap: 12px;

  span {
    font-size: 13px;
    color: var(--b3-theme-on-surface-light);
  }
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--b3-theme-surface-lighter);
  border-top-color: var(--b3-theme-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}
</style>
