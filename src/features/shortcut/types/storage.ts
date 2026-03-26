/**
 * 快捷键模块 - 持久化存储
 * 负责快捷键数据的保存和加载
 */
import { Plugin } from 'siyuan'
import type { ShortcutInfo } from './index'

/**
 * 快捷键存储键
 */
const SHORTCUTS_STORAGE_KEY = 'plugin-shortcuts-custom'

/**
 * 快捷键收藏存储键
 */
const SHORTCUTS_FAVORITES_KEY = 'plugin-shortcuts-favorites'

/**
 * 最近使用存储键
 */
const SHORTCUTS_RECENT_KEY = 'plugin-shortcuts-recent'

/**
 * 快捷键存储管理类
 */
export class ShortcutStorage {
  private plugin: Plugin

  constructor(plugin: Plugin) {
    this.plugin = plugin
  }

  /**
   * 加载自定义快捷键数据
   */
  async loadCustomShortcuts(): Promise<ShortcutInfo[]> {
    try {
      const data = await this.plugin.loadData(SHORTCUTS_STORAGE_KEY)
      if (!data || !Array.isArray(data)) {
        return []
      }
      return data
    } catch (error) {
      console.error('加载自定义快捷键失败:', error)
      return []
    }
  }

  /**
   * 保存自定义快捷键数据
   */
  async saveCustomShortcuts(shortcuts: ShortcutInfo[]): Promise<boolean> {
    try {
      // 只保存自定义快捷键（category === 'custom'）
      const customShortcuts = shortcuts.filter(s => s.category === 'custom')
      await this.plugin.saveData(SHORTCUTS_STORAGE_KEY, customShortcuts)
      return true
    } catch (error) {
      console.error('保存自定义快捷键失败:', error)
      return false
    }
  }

  /**
   * 清空所有自定义快捷键数据
   */
  async clearCustomShortcuts(): Promise<boolean> {
    try {
      await this.plugin.saveData(SHORTCUTS_STORAGE_KEY, [])
      return true
    } catch (error) {
      console.error('清空自定义快捷键失败:', error)
      return false
    }
  }

  /**
   * 加载快捷键收藏数据
   */
  async loadFavorites(): Promise<string[]> {
    try {
      const data = await this.plugin.loadData(SHORTCUTS_FAVORITES_KEY)
      if (!data || !Array.isArray(data)) {
        return []
      }
      // 过滤掉非字符串类型的值，确保数据格式正确
      return data.filter(item => typeof item === 'string')
    } catch (error) {
      console.error('加载收藏快捷键失败:', error)
      return []
    }
  }

  /**
   * 保存快捷键收藏数据
   */
  async saveFavorites(favorites: string[]): Promise<boolean> {
    try {
      const validFavorites = favorites.filter(item => typeof item === 'string')
      await this.plugin.saveData(SHORTCUTS_FAVORITES_KEY, validFavorites)
      return true
    } catch (error) {
      console.error('保存收藏快捷键失败:', error)
      return false
    }
  }

  /**
   * 清空所有收藏快捷键数据
   */
  async clearFavorites(): Promise<boolean> {
    try {
      await this.plugin.saveData(SHORTCUTS_FAVORITES_KEY, [])
      return true
    } catch (error) {
      console.error('清空收藏快捷键失败:', error)
      return false
    }
  }

  /**
   * 加载最近使用数据
   */
  async loadRecent(): Promise<string[]> {
    try {
      const data = await this.plugin.loadData(SHORTCUTS_RECENT_KEY)
      if (!data || !Array.isArray(data)) {
        return []
      }
      return data.filter(item => typeof item === 'string')
    } catch (error) {
      console.error('加载最近使用失败:', error)
      return []
    }
  }

  /**
   * 保存最近使用数据
   */
  async saveRecent(recent: string[]): Promise<boolean> {
    try {
      const validRecent = recent.filter(item => typeof item === 'string')
      await this.plugin.saveData(SHORTCUTS_RECENT_KEY, validRecent)
      return true
    } catch (error) {
      console.error('保存最近使用失败:', error)
      return false
    }
  }
}

// 导出独立函数以保持向后兼容
/**
 * 加载自定义快捷键数据
 */
export async function loadCustomShortcuts(plugin: Plugin): Promise<ShortcutInfo[]> {
  const storage = new ShortcutStorage(plugin)
  return storage.loadCustomShortcuts()
}

/**
 * 保存自定义快捷键数据
 */
export async function saveCustomShortcuts(plugin: Plugin, shortcuts: ShortcutInfo[]): Promise<boolean> {
  const storage = new ShortcutStorage(plugin)
  return storage.saveCustomShortcuts(shortcuts)
}

/**
 * 清空所有自定义快捷键数据
 */
export async function clearCustomShortcuts(plugin: Plugin): Promise<boolean> {
  const storage = new ShortcutStorage(plugin)
  return storage.clearCustomShortcuts()
}

/**
 * 加载快捷键收藏数据
 */
export async function loadFavorites(plugin: Plugin): Promise<string[]> {
  const storage = new ShortcutStorage(plugin)
  return storage.loadFavorites()
}

/**
 * 保存快捷键收藏数据
 */
export async function saveFavorites(plugin: Plugin, favorites: string[]): Promise<boolean> {
  const storage = new ShortcutStorage(plugin)
  return storage.saveFavorites(favorites)
}

/**
 * 清空所有收藏快捷键数据
 */
export async function clearFavorites(plugin: Plugin): Promise<boolean> {
  const storage = new ShortcutStorage(plugin)
  return storage.clearFavorites()
}

/**
 * 加载最近使用数据
 */
export async function loadRecent(plugin: Plugin): Promise<string[]> {
  const storage = new ShortcutStorage(plugin)
  return storage.loadRecent()
}

/**
 * 保存最近使用数据
 */
export async function saveRecent(plugin: Plugin, recent: string[]): Promise<boolean> {
  const storage = new ShortcutStorage(plugin)
  return storage.saveRecent(recent)
}
