// API 调试器存储层 — 历史记录持久化（PluginStorage + TypedStorage）
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

  async addRecord(record: ApiRequestRecord): Promise<ApiRequestRecord[]> {
    const data = await this.settings.loadOrDefault()
    const history = [record, ...data.history].slice(0, data.maxHistory)
    await this.settings.save({
      ...data,
      history,
    })
    return history
  }

  async clearHistory(): Promise<boolean> {
    const data = await this.settings.loadOrDefault()
    return this.settings.save({
      ...data,
      history: [],
    })
  }
}
