import type { ShortcutInfo } from "./index"
/**
 * 快捷键模块 - 持久化存储
 * 使用 PluginStorage + TypedStorage 统一存储模式
 */
import { Plugin } from "siyuan"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"

/**
 * 快捷键存储键
 */
export const SHORTCUTS_STORAGE_KEY = "plugin-shortcuts-custom"

/**
 * 快捷键收藏存储键
 */
export const SHORTCUTS_FAVORITES_KEY = "plugin-shortcuts-favorites"

/**
 * 最近使用存储键
 */
export const SHORTCUTS_RECENT_KEY = "plugin-shortcuts-recent"

/**
 * 快捷键存储管理类
 */
export class ShortcutStorage {
  readonly customShortcuts: TypedStorage<ShortcutInfo[]>
  readonly favorites: TypedStorage<string[]>
  readonly recent: TypedStorage<string[]>

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin)
    this.customShortcuts = new TypedStorage(storage, SHORTCUTS_STORAGE_KEY)
    this.favorites = new TypedStorage(storage, SHORTCUTS_FAVORITES_KEY)
    this.recent = new TypedStorage(storage, SHORTCUTS_RECENT_KEY)
  }

  /**
   * 加载自定义快捷键数据
   */
  async loadCustomShortcuts(): Promise<ShortcutInfo[]> {
    const data = await this.customShortcuts.load()
    if (!data || !Array.isArray(data)) {
      return []
    }
    return data
  }

  /**
   * 保存自定义快捷键数据
   */
  async saveCustomShortcuts(shortcuts: ShortcutInfo[]): Promise<boolean> {
    // 只保存自定义快捷键（category === 'custom'）
    const customShortcuts = shortcuts.filter((s) => s.category === "custom")
    return this.customShortcuts.save(customShortcuts)
  }

  /**
   * 清空所有自定义快捷键数据
   */
  async clearCustomShortcuts(): Promise<boolean> {
    return this.customShortcuts.save([])
  }

  /**
   * 加载快捷键收藏数据
   */
  async loadFavorites(): Promise<string[]> {
    const data = await this.favorites.load()
    if (!data || !Array.isArray(data)) {
      return []
    }
    // 过滤掉非字符串类型的值，确保数据格式正确
    return data.filter((item) => typeof item === "string")
  }

  /**
   * 保存快捷键收藏数据
   */
  async saveFavorites(favorites: string[]): Promise<boolean> {
    const validFavorites = favorites.filter(
      (item) => typeof item === "string",
    )
    return this.favorites.save(validFavorites)
  }

  /**
   * 清空所有收藏快捷键数据
   */
  async clearFavorites(): Promise<boolean> {
    return this.favorites.save([])
  }

  /**
   * 加载最近使用数据
   */
  async loadRecent(): Promise<string[]> {
    const data = await this.recent.load()
    if (!data || !Array.isArray(data)) {
      return []
    }
    return data.filter((item) => typeof item === "string")
  }

  /**
   * 保存最近使用数据
   */
  async saveRecent(recent: string[]): Promise<boolean> {
    const validRecent = recent.filter((item) => typeof item === "string")
    return this.recent.save(validRecent)
  }
}
