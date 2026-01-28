/**
 * WebDAV数据存储模块
 * 使用思源API进行数据持久化
 */
import { Plugin } from 'siyuan'
import type { WebDAVConfig } from '@/config/settings'

const WEBDAV_CONFIG_KEY = 'webdav-config'

const DEFAULT_WEBDAV_CONFIG: WebDAVConfig = {
  serverUrl: '',
  username: '',
  password: '',
  basePath: '/',
  autoSync: false,
  syncInterval: 30,
  lastSyncTime: ''
}

/**
 * 加载WebDAV配置
 */
export async function loadWebDAVConfig(plugin: Plugin): Promise<WebDAVConfig> {
  try {
    const data = await plugin.loadData(WEBDAV_CONFIG_KEY)
    if (!data) {
      return { ...DEFAULT_WEBDAV_CONFIG }
    }
    return { ...DEFAULT_WEBDAV_CONFIG, ...data }
  } catch (error) {
    console.error('加载WebDAV配置失败:', error)
    return { ...DEFAULT_WEBDAV_CONFIG }
  }
}

/**
 * 保存WebDAV配置
 */
export async function saveWebDAVConfig(plugin: Plugin, config: WebDAVConfig): Promise<boolean> {
  try {
    await plugin.saveData(WEBDAV_CONFIG_KEY, config)
    return true
  } catch (error) {
    console.error('保存WebDAV配置失败:', error)
    return false
  }
}

/**
 * 重置WebDAV配置
 */
export async function resetWebDAVConfig(plugin: Plugin): Promise<boolean> {
  try {
    await plugin.saveData(WEBDAV_CONFIG_KEY, DEFAULT_WEBDAV_CONFIG)
    return true
  } catch (error) {
    console.error('重置WebDAV配置失败:', error)
    return false
  }
}

/**
 * 同步状态存储键
 */
const SYNC_STATUS_KEY = 'webdav-sync-status'

/**
 * 同步状态接口
 */
export interface SyncStatus {
  lastSyncTime: string
  lastSyncResult: 'success' | 'error' | 'none'
  lastSyncMessage: string
  syncedFiles: number
}

/**
 * 默认同步状态
 */
const DEFAULT_SYNC_STATUS: SyncStatus = {
  lastSyncTime: '',
  lastSyncResult: 'none',
  lastSyncMessage: '',
  syncedFiles: 0
}

/**
 * 加载同步状态
 */
export async function loadSyncStatus(plugin: Plugin): Promise<SyncStatus> {
  try {
    const data = await plugin.loadData(SYNC_STATUS_KEY)
    if (!data) {
      return { ...DEFAULT_SYNC_STATUS }
    }
    return { ...DEFAULT_SYNC_STATUS, ...data }
  } catch (error) {
    console.error('加载同步状态失败:', error)
    return { ...DEFAULT_SYNC_STATUS }
  }
}

/**
 * 保存同步状态
 */
export async function saveSyncStatus(plugin: Plugin, status: SyncStatus): Promise<boolean> {
  try {
    await plugin.saveData(SYNC_STATUS_KEY, status)
    return true
  } catch (error) {
    console.error('保存同步状态失败:', error)
    return false
  }
}
