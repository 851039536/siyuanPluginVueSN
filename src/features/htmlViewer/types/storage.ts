/**
 * HTML展示功能存储管理
 */
import type {
  HtmlCategory,
  HtmlSnippet,
} from "./index"
import { Plugin } from "siyuan"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"

/**
 * 存储键常量
 */
export const STORAGE_KEYS = {
  SNIPPETS: "html-viewer-snippets",
  CATEGORIES: "html-viewer-categories",
} as const

/**
 * 默认分类
 */
export const DEFAULT_CATEGORIES: HtmlCategory[] = [
  {
    id: "default",
    name: "默认",
    color: "#d97757",
  },
  {
    id: "template",
    name: "模板",
    color: "#6a9bcc",
  },
  {
    id: "widget",
    name: "小组件",
    color: "#788c5d",
  },
]

/**
 * HTML展示存储管理类
 */
export class HtmlViewerStorage {
  readonly snippets: TypedStorage<HtmlSnippet[]>
  readonly categories: TypedStorage<HtmlCategory[]>
  private storage: PluginStorage

  constructor(plugin: Plugin) {
    this.storage = new PluginStorage(plugin)
    this.snippets = new TypedStorage(this.storage, STORAGE_KEYS.SNIPPETS)
    this.categories = new TypedStorage(
      this.storage,
      STORAGE_KEYS.CATEGORIES,
      DEFAULT_CATEGORIES,
    )
  }

  /**
   * 加载所有HTML片段
   */
  async loadSnippets(): Promise<HtmlSnippet[]> {
    const data = await this.snippets.load()
    return data || []
  }

  /**
   * 保存所有HTML片段
   */
  async saveSnippets(snippets: HtmlSnippet[]): Promise<boolean> {
    return this.snippets.save(snippets)
  }

  /**
   * 添加HTML片段
   */
  async addSnippet(snippet: Omit<HtmlSnippet, "id" | "createdAt" | "updatedAt">): Promise<HtmlSnippet> {
    const snippets = await this.loadSnippets()
    const newSnippet: HtmlSnippet = {
      ...snippet,
      id: Date.now().toString(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    snippets.push(newSnippet)
    await this.saveSnippets(snippets)
    return newSnippet
  }

  /**
   * 更新HTML片段
   */
  async updateSnippet(id: string, updates: Partial<Omit<HtmlSnippet, "id" | "createdAt">>): Promise<boolean> {
    const snippets = await this.loadSnippets()
    const index = snippets.findIndex((s) => s.id === id)
    if (index === -1) return false

    snippets[index] = {
      ...snippets[index],
      ...updates,
      updatedAt: Date.now(),
    }
    return this.saveSnippets(snippets)
  }

  /**
   * 删除HTML片段
   */
  async deleteSnippet(id: string): Promise<boolean> {
    const snippets = await this.loadSnippets()
    const filtered = snippets.filter((s) => s.id !== id)
    if (filtered.length === snippets.length) return false
    return this.saveSnippets(filtered)
  }

  /**
   * 加载分类
   */
  async loadCategories(): Promise<HtmlCategory[]> {
    return this.categories.loadOrDefault()
  }

  /**
   * 保存分类
   */
  async saveCategories(categories: HtmlCategory[]): Promise<boolean> {
    return this.categories.save(categories)
  }
}
