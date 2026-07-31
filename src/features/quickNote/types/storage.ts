/**
 * 速记功能 — 存储层
 * 基于 TypedStorage 定义速记条目列表与功能设置两个类型安全存储槽
 */
import type { QuickNoteItem, QuickNoteSettings } from "./index"
import { Plugin } from "siyuan"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"

/** 默认设置：弹窗居中显示，无自定义坐标 */
export const DEFAULT_QUICK_NOTE_SETTINGS: QuickNoteSettings = {
  position: "center",
  customX: 0,
  customY: 0,
}

export class QuickNoteStorage {
  /** 速记条目列表 */
  readonly notes: TypedStorage<QuickNoteItem[]>
  /** 功能设置（弹窗位置等） */
  readonly settings: TypedStorage<QuickNoteSettings>

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin)
    this.notes = new TypedStorage(storage, "quick-note-items", [])
    this.settings = new TypedStorage(storage, "quick-note-settings", DEFAULT_QUICK_NOTE_SETTINGS)
  }
}
