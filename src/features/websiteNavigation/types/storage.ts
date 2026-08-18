/**
 * 网站导航 — 数据持久化层
 */
import type { Plugin } from "siyuan"
import type {
  CreateWebsiteDTO,
  UpdateWebsiteDTO,
  WebsiteCategory,
  WebsiteEntry,
} from "./index"
import {
  DEFAULT_CATEGORY_COLOR,
  DEFAULT_CATEGORY_ID,
  PRESET_CATEGORY_COLORS,
} from "./constants"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"

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
    const data = await this.entries.loadOrDefault()
    return data
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
