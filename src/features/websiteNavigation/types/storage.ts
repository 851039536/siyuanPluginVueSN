import type {
  CreateWebsiteDTO,
  UpdateWebsiteDTO,
  WebsiteCategory,
  WebsiteEntry,
} from "./index"
import { Plugin } from "siyuan"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"

export const STORAGE_KEYS = {
  ENTRIES: "website-navigation-entries",
  CATEGORIES: "website-navigation-categories",
} as const

const DEFAULT_CATEGORIES: WebsiteCategory[] = [
  {
    id: "default",
    name: "默认",
    color: "#b0aea5",
  },
  {
    id: "dev",
    name: "开发",
    color: "#3b82f6",
  },
  {
    id: "tools",
    name: "工具",
    color: "#10b981",
  },
  {
    id: "social",
    name: "社交",
    color: "#f59e0b",
  },
  {
    id: "media",
    name: "媒体",
    color: "#ef4444",
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

  async init(): Promise<void> {
    const cats = await this.categories.load()
    if (!cats || cats.length === 0) {
      await this.categories.save(DEFAULT_CATEGORIES)
    }
  }

  async getAllEntries(): Promise<WebsiteEntry[]> {
    try {
      const data = await this.entries.loadOrDefault()
      return data
    } catch (error) {
      console.error("Failed to load website entries:", error)
      return []
    }
  }

  async getCategories(): Promise<WebsiteCategory[]> {
    try {
      return await this.categories.loadOrDefault()
    } catch (error) {
      console.error("Failed to load categories:", error)
      return DEFAULT_CATEGORIES
    }
  }

  async createEntry(data: CreateWebsiteDTO): Promise<WebsiteEntry> {
    const now = Date.now()
    const entry: WebsiteEntry = {
      id: `ws-${now}`,
      name: data.name,
      url: data.url,
      category: data.category || "default",
      description: data.description,
      createdAt: now,
      updatedAt: now,
    }

    const entries = await this.getAllEntries()
    entries.push(entry)
    await this.entries.save(entries)

    return entry
  }

  async updateEntry(id: string, data: UpdateWebsiteDTO): Promise<boolean> {
    const entries = await this.getAllEntries()
    const index = entries.findIndex((e) => e.id === id)

    if (index === -1) return false

    entries[index] = {
      ...entries[index],
      ...data,
      updatedAt: Date.now(),
    }

    await this.entries.save(entries)
    return true
  }

  async deleteEntry(id: string): Promise<boolean> {
    const entries = await this.getAllEntries()
    const filtered = entries.filter((e) => e.id !== id)

    if (filtered.length === entries.length) return false

    await this.entries.save(filtered)
    return true
  }

  async saveCategories(categories: WebsiteCategory[]): Promise<void> {
    await this.categories.save(categories)
  }
}
