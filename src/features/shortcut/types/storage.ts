/**
 * 快捷键模块 - 持久化存储
 * 三键分离：预置不落盘（代码即真源），仅自定义 / 收藏 / 最近使用写盘
 */
import type { ShortcutInfo } from "./index"
import { Plugin } from "siyuan"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"
import { pruneIds, sanitizeShortcutArray } from "../utils"

/**
 * 自定义快捷键键：唯一可写数据（预置不落盘，插件升级即可获得新预置）
 */
const SHORTCUTS_CUSTOM_KEY = "plugin-shortcuts-custom"

/**
 * 收藏存储键（沿用历史键名，无需迁移）
 */
const SHORTCUTS_FAVORITES_KEY = "plugin-shortcuts-favorites"

/**
 * 最近使用存储键（沿用历史键名，无需迁移）
 */
const SHORTCUTS_RECENT_KEY = "plugin-shortcuts-recent"

/**
 * 历史遗留键（预置 + 自定义混存）：仅作一次性迁移源
 */
const SHORTCUTS_LEGACY_ALL_KEY = "plugin-shortcuts-all"

/**
 * 清洗字符串数组，过滤掉非字符串元素
 * 模块级纯函数，不依赖实例状态
 */
function sanitizeStringArray(data: unknown): string[] {
  if (!data || !Array.isArray(data)) {
    return []
  }
  return data.filter((item): item is string => typeof item === "string")
}

/**
 * 快捷键存储管理类
 */
export class ShortcutStorage {
  readonly custom: TypedStorage<ShortcutInfo[]>
  readonly favorites: TypedStorage<string[]>
  readonly recent: TypedStorage<string[]>
  /** 旧键只读槽位：仅用于迁移，不参与常规读写 */
  private readonly legacyAll: TypedStorage<ShortcutInfo[]>

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin)
    this.custom = new TypedStorage(storage, SHORTCUTS_CUSTOM_KEY)
    this.favorites = new TypedStorage(storage, SHORTCUTS_FAVORITES_KEY)
    this.recent = new TypedStorage(storage, SHORTCUTS_RECENT_KEY)
    this.legacyAll = new TypedStorage(storage, SHORTCUTS_LEGACY_ALL_KEY)
  }

  /**
   * 加载自定义快捷键
   */
  async loadCustom(): Promise<ShortcutInfo[]> {
    const data = await this.custom.load()
    return sanitizeShortcutArray(data, true)
  }

  /**
   * 保存自定义快捷键
   */
  async saveCustom(list: ShortcutInfo[]): Promise<boolean> {
    return this.custom.save(sanitizeShortcutArray(list, true))
  }

  /**
   * 迁移历史遗留数据（幂等）：
   * 1. 新键已存在（含空数组）⇒ 迁移已完成，直接返回其内容
   * 2. 旧键不存在 ⇒ 首次安装，返回空数组且不写盘
   * 3. 过滤旧数据：仅保留 id 不在预置集合中的条目
   * 4. 写入成功才删除旧键；写入失败保留旧键，下次启动重试（不丢数据）
   * @param presetIds 预置快捷键 id 集合
   */
  async migrateLegacy(presetIds: ReadonlySet<string>): Promise<ShortcutInfo[]> {
    // 判定依据是「新键是否存在」而非「新键是否非空」：否则用户删光自定义项后会被旧数据复活
    if (await this.custom.exists()) {
      return this.loadCustom()
    }

    const legacy = await this.legacyAll.load()
    if (legacy === null) {
      return []
    }

    const custom = sanitizeShortcutArray(legacy, true).filter(
      (item) => !presetIds.has(item.id),
    )

    const saved = await this.custom.save(custom)
    if (!saved) {
      console.error("[shortcut] 迁移旧数据写入失败，保留旧键待下次重试")
      return custom
    }

    await this.legacyAll.remove()
    return custom
  }

  /**
   * 加载收藏 id 列表
   */
  async loadFavorites(): Promise<string[]> {
    return sanitizeStringArray(await this.favorites.load())
  }

  /**
   * 保存收藏 id 列表
   */
  async saveFavorites(ids: string[]): Promise<boolean> {
    return this.favorites.save(sanitizeStringArray(ids))
  }

  /**
   * 加载最近使用 id 列表
   */
  async loadRecent(): Promise<string[]> {
    return sanitizeStringArray(await this.recent.load())
  }

  /**
   * 保存最近使用 id 列表
   */
  async saveRecent(ids: string[]): Promise<boolean> {
    return this.recent.save(sanitizeStringArray(ids))
  }

  /**
   * 剪枝收藏 / 最近使用中的失效 id（预置调整或自定义删除后的残留），有变化才回写
   */
  async pruneUserState(validIds: ReadonlySet<string>): Promise<void> {
    const favorites = pruneIds(await this.loadFavorites(), validIds)
    if (favorites.changed) {
      await this.saveFavorites(favorites.ids)
    }
    const recent = pruneIds(await this.loadRecent(), validIds)
    if (recent.changed) {
      await this.saveRecent(recent.ids)
    }
  }

  /**
   * 重置用户数据：清空自定义 + 收藏 + 最近（预置来自代码，不受影响）
   * 写空数组而非删键：保留「迁移已完成」标记，避免旧数据被再次迁入
   */
  async clearUserData(): Promise<boolean> {
    const results = await Promise.all([
      this.saveCustom([]),
      this.saveFavorites([]),
      this.saveRecent([]),
    ])
    return results.every(Boolean)
  }
}
