/**
 * 速记功能 — 存储层
 * 基于 TypedStorage 定义统一数据槽（AppData：待办/灵感/项目）与功能设置两个类型安全存储槽
 */
import type { AppData, QuickNoteSettings } from "./index"
import { Plugin } from "siyuan"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"

/** 默认设置：弹窗居中显示，无自定义坐标，非最小化 */
export const DEFAULT_QUICK_NOTE_SETTINGS: QuickNoteSettings = {
  position: "center",
  customX: 0,
  customY: 0,
  minimized: false,
}

/** 统一数据默认值：三大模块空数组 + 尚未执行过自动顺延 */
export const DEFAULT_QUICK_NOTE_DATA: AppData = {
  todos: [],
  inspirations: [],
  projects: [],
  lastRolloverDate: null,
}

export class QuickNoteStorage {
  /** 统一数据槽（待办/灵感/项目 + 顺延记录） */
  readonly data: TypedStorage<AppData>
  /** 功能设置（弹窗位置等） */
  readonly settings: TypedStorage<QuickNoteSettings>

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin)
    this.data = new TypedStorage(storage, "quick-note-data", DEFAULT_QUICK_NOTE_DATA)
    this.settings = new TypedStorage(storage, "quick-note-settings", DEFAULT_QUICK_NOTE_SETTINGS)
  }
}
