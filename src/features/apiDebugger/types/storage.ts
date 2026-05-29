import type { Plugin } from "siyuan"

import type {
  ApiDebuggerSettings,
  ApiRequestRecord,
} from "./index"
import { PluginStorage } from "@/utils/pluginStorage"

import { TypedStorage } from "@/utils/typedStorage"
import {
  DEFAULT_MAX_HISTORY,
  STORAGE_KEY,
} from "./index"

const DEFAULT_SETTINGS: ApiDebuggerSettings = {
  history: [],
  maxHistory: DEFAULT_MAX_HISTORY,
}

export class ApiDebuggerStorage {
  readonly settings: TypedStorage<ApiDebuggerSettings>

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin)
    this.settings = new TypedStorage(storage, STORAGE_KEY, DEFAULT_SETTINGS)
  }

  async loadHistory(): Promise<ApiRequestRecord[]> {
    const data = await this.settings.loadOrDefault()
    return data.history
  }

  async addRecord(record: ApiRequestRecord): Promise<boolean> {
    const data = await this.settings.loadOrDefault()
    const history = [record, ...data.history].slice(0, data.maxHistory)
    return this.settings.save({
      ...data,
      history,
    })
  }

  async clearHistory(): Promise<boolean> {
    const data = await this.settings.loadOrDefault()
    return this.settings.save({
      ...data,
      history: [],
    })
  }
}
