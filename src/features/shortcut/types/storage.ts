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
 * 统一存储键：存储所有快捷键（预置 + 自定义）
 */
export const SHORTCUTS_ALL_KEY = "plugin-shortcuts-all"

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
  readonly allShortcuts: TypedStorage<ShortcutInfo[]>
  readonly favorites: TypedStorage<string[]>
  readonly recent: TypedStorage<string[]>

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin)
    this.allShortcuts = new TypedStorage(storage, SHORTCUTS_ALL_KEY)
    this.favorites = new TypedStorage(storage, SHORTCUTS_FAVORITES_KEY)
    this.recent = new TypedStorage(storage, SHORTCUTS_RECENT_KEY)
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

  /**
   * 保存全部快捷键（预置 + 自定义）
   * 写入统一存储键
   */
  async saveAll(shortcuts: ShortcutInfo[]): Promise<boolean> {
    return this.allShortcuts.save(shortcuts)
  }

  /**
   * 首次初始化：如果存储为空则写入预置数据
   * @param presets 默认预置快捷键数组
   * @returns 存储中的全部快捷键（新 seed 的或已有的）
   */
  async seedIfEmpty(presets: ShortcutInfo[]): Promise<ShortcutInfo[]> {
    const existing = await this.allShortcuts.load()
    if (existing && Array.isArray(existing) && existing.length > 0) {
      return existing
    }
    await this.allShortcuts.save(presets)
    return presets
  }
}
