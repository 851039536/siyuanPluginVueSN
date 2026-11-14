/**
 * 网站条目数据模型与存储层（共享模块）
 * 供 websiteNavigation 与 minimalBrowser 共用同一份书签数据。
 *
 * 存储：`PluginStorage` + `TypedStorage`（思源 saveData JSON 槽）。
 * 不使用 SQLite：`plugin.db` 位于思源同步目录，Windows 下连接持有会让同步引擎的
 * rename 失败（表现为「读写文件或访问网络权限不足」）。
 *
 * 写操作串行化：load → 修改 → save 必须成组执行，否则并发创建/删除会互相覆盖。
 */
import type { Plugin } from "siyuan"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"

// ========================================
// 数据模型
// ========================================

/** 网站条目 */
export interface WebsiteEntry {
  id: string
  name: string
  url: string
  category: string
  description: string
  createdAt: number
  updatedAt: number
}

/** 创建网站条目数据传输对象 */
export interface CreateWebsiteDTO {
  name: string
  url: string
  category: string
  description: string
}

/** 更新网站条目数据传输对象（所有字段可选） */
export interface UpdateWebsiteDTO {
  name?: string
  url?: string
  category?: string
  description?: string
}

/** 网站分类 */
export interface WebsiteCategory {
  id: string
  name: string
  color: string
}

// ========================================
// 共享常量
// ========================================

/** 默认分类 ID（面板/弹窗/存储共用） */
export const DEFAULT_CATEGORY_ID = "default"
/** “全部”分类筛选 ID（面板/筛选栏共用） */
export const ALL_CATEGORY_ID = "all"
/** 默认分类颜色（FilterBar/WebsiteCard/Storage 共用） */
export const DEFAULT_CATEGORY_COLOR = "#b0aea5"
/** 分类管理弹窗预设色（CategoryManager/Storage 共用） */
export const PRESET_CATEGORY_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#b0aea5",
] as const

// ========================================
// 存储层（思源 saveData JSON 槽）
// ========================================

/** 存储键（与 src/config/storage/jsonSlots.ts 注册表一致） */
export const STORAGE_KEYS = {
  ENTRIES: "website-navigation-entries",
  CATEGORIES: "website-navigation-categories",
} as const

const DEFAULT_CATEGORIES: WebsiteCategory[] = [
  {
    id: DEFAULT_CATEGORY_ID,
    name: "默认",
    color: DEFAULT_CATEGORY_COLOR,
  },
  {
    id: "dev",
    name: "开发",
    color: PRESET_CATEGORY_COLORS[0],
  },
  {
    id: "tools",
    name: "工具",
    color: PRESET_CATEGORY_COLORS[1],
  },
  {
    id: "social",
    name: "社交",
    color: PRESET_CATEGORY_COLORS[2],
  },
  {
    id: "media",
    name: "媒体",
    color: PRESET_CATEGORY_COLORS[3],
  },
]

export class WebsiteNavigationStorage {
  readonly entries: TypedStorage<WebsiteEntry[]>
  readonly categories: TypedStorage<WebsiteCategory[]>

  /** 写队列：保证「读-改-写」不被并发操作交错覆盖 */
  private writeQueue: Promise<unknown> = Promise.resolve()

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin)
    this.entries = new TypedStorage(storage, STORAGE_KEYS.ENTRIES, [] as WebsiteEntry[])
    this.categories = new TypedStorage(storage, STORAGE_KEYS.CATEGORIES, DEFAULT_CATEGORIES)
  }

  /** 串行执行一次写操作（前一次失败不影响后续） */
  private runExclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = this.writeQueue.then(task, task)
    this.writeQueue = run.catch(() => undefined)
    return run
  }

  async getAllEntries(): Promise<WebsiteEntry[]> {
    return this.entries.loadOrDefault()
  }

  async getCategories(): Promise<WebsiteCategory[]> {
    return this.categories.loadOrDefault()
  }

  async createEntry(data: CreateWebsiteDTO): Promise<WebsiteEntry> {
    const now = Date.now()
    const entry: WebsiteEntry = {
      // 时间戳在同一 tick 内会重复（批量收藏/双击），用随机 ID 保证唯一
      id: `ws-${crypto.randomUUID()}`,
      name: data.name,
      url: data.url,
      category: data.category || DEFAULT_CATEGORY_ID,
      description: data.description,
      createdAt: now,
      updatedAt: now,
    }

    return this.runExclusive(async () => {
      const entries = await this.getAllEntries()
      entries.push(entry)
      const saved = await this.entries.save(entries)
      if (!saved) {
        throw new Error("Failed to save website entries")
      }
      return entry
    })
  }

  async updateEntry(id: string, data: UpdateWebsiteDTO): Promise<WebsiteEntry | null> {
    return this.runExclusive(async () => {
      const entries = await this.getAllEntries()
      const index = entries.findIndex((e) => e.id === id)
      if (index === -1) return null

      const current = entries[index]
      // 逐字段取值：显式 undefined 回落到原值，避免把字段写成 undefined
      const updated: WebsiteEntry = {
        id: current.id,
        name: data.name ?? current.name,
        url: data.url ?? current.url,
        category: data.category ?? current.category,
        description: data.description ?? current.description,
        createdAt: current.createdAt,
        updatedAt: Date.now(),
      }
      entries[index] = updated

      const saved = await this.entries.save(entries)
      if (!saved) {
        throw new Error("Failed to save website entries")
      }
      return updated
    })
  }

  async deleteEntry(id: string): Promise<boolean> {
    return this.runExclusive(async () => {
      const entries = await this.getAllEntries()
      const filtered = entries.filter((e) => e.id !== id)
      if (filtered.length === entries.length) return false

      const saved = await this.entries.save(filtered)
      if (!saved) {
        throw new Error("Failed to save website entries")
      }
      return true
    })
  }

  /** 整体覆盖分类（调用方总是传完整列表） */
  async saveCategories(categories: WebsiteCategory[]): Promise<boolean> {
    return this.runExclusive(() => this.categories.save(categories))
  }
}

/**
 * 模块级单例：与两个消费方（websiteNavigation / minimalBrowser）共用同一实例。
 * 两个功能各自懒加载时都调用本函数，只会构造一次。
 */
let sharedStorage: WebsiteNavigationStorage | null = null

/** 获取（必要时创建）共享存储实例 */
export function getSharedWebsiteStorage(plugin: Plugin): WebsiteNavigationStorage {
  if (!sharedStorage) {
    sharedStorage = new WebsiteNavigationStorage(plugin)
  }
  return sharedStorage
}

/** 释放共享实例（插件卸载 / 两个消费方全部关闭时调用） */
export function closeSharedWebsiteStorage(): void {
  sharedStorage = null
}
