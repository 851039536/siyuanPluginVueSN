// 磁盘浏览器存储层 — 收藏夹持久化（PluginStorage + TypedStorage）
import type { Plugin } from "siyuan"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"
import {
  DiskBrowserSettings,
  STORAGE_KEY,
} from "./index"

const DEFAULT_SETTINGS: DiskBrowserSettings = {
  favoriteFolders: [],
}

export class DiskBrowserStorage {
  readonly settings: TypedStorage<DiskBrowserSettings>

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin)
    this.settings = new TypedStorage(storage, STORAGE_KEY, DEFAULT_SETTINGS)
  }

  async loadFavorites(): Promise<string[]> {
    const data = await this.settings.loadOrDefault()
    return data.favoriteFolders
  }

  async saveFavorites(favorites: string[]): Promise<boolean> {
    return this.settings.save({ favoriteFolders: favorites })
  }
}
