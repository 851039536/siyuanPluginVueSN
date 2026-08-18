/**
 * 网站条目数据模型与存储层（共享模块）
 * 从 websiteNavigation 提取，供 websiteNavigation 与 minimalBrowser 共用，
 * 保证两个功能读写同一份书签数据（存储键不变，旧数据无感迁移）
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
// 存储层
// ========================================

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

  private storage: PluginStorage

  constructor(plugin: Plugin) {
    this.storage = new PluginStorage(plugin)
    this.entries = new TypedStorage(this.storage, STORAGE_KEYS.ENTRIES, [] as WebsiteEntry[])
    this.categories = new TypedStorage(this.storage, STORAGE_KEYS.CATEGORIES, DEFAULT_CATEGORIES)
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
      id: `ws-${now}`,
      name: data.name,
      url: data.url,
      category: data.category || DEFAULT_CATEGORY_ID,
      description: data.description,
      createdAt: now,
      updatedAt: now,
    }

    const entries = await this.getAllEntries()
    entries.push(entry)
    const saved = await this.entries.save(entries)
    if (!saved) {
      throw new Error("Failed to save website entries")
    }

    return entry
  }

  async updateEntry(id: string, data: UpdateWebsiteDTO): Promise<WebsiteEntry | null> {
    const entries = await this.getAllEntries()
    const index = entries.findIndex((e) => e.id === id)

    if (index === -1) return null

    const updated: WebsiteEntry = {
      ...entries[index],
      ...data,
      updatedAt: Date.now(),
    }
    entries[index] = updated

    const saved = await this.entries.save(entries)
    if (!saved) {
      throw new Error("Failed to save website entries")
    }

    return updated
  }

  async deleteEntry(id: string): Promise<boolean> {
    const entries = await this.getAllEntries()
    const filtered = entries.filter((e) => e.id !== id)

    if (filtered.length === entries.length) return false

    const saved = await this.entries.save(filtered)
    if (!saved) {
      throw new Error("Failed to save website entries")
    }

    return true
  }

  async saveCategories(categories: WebsiteCategory[]): Promise<boolean> {
    return this.categories.save(categories)
  }
}
