/**
 * 状态栏持久化存储槽
 *
 * PluginStorage + TypedStorage 模式：状态栏快捷入口、监控项显隐、
 * 自定义分类列表与功能归属映射。键名集中于此，禁止散落字面量。
 */
import type { Plugin } from "siyuan"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"
import type { StatusBarCategory } from "./index"

// ========== 存储键常量 ==========

const STORAGE_KEYS = {
  /** 状态栏快捷入口（pin 到状态栏的功能 id，有序） */
  SHORTCUTS: "statusBar-shortcuts",
  /** 监控项显隐集合 */
  MONITORS: "statusBar-monitors",
  /** 自定义分类列表（有序） */
  CATEGORIES: "statusBar-categories",
  /** 功能 → 分类 id 的单一归属映射 */
  FEATURE_CATEGORY: "statusBar-feature-category",
} as const

/** 功能归属映射（功能 id → 分类 id） */
export type FeatureCategoryMap = Record<string, string>

// ========== 存储类 ==========

export class StatusBarStorage {
  /** 状态栏快捷入口（pin 的功能 id，有序） */
  readonly shortcuts: TypedStorage<string[]>
  /** 监控项显隐集合（为空表示按默认全显，由消费方判定） */
  readonly monitors: TypedStorage<string[]>
  /** 自定义分类列表 */
  readonly categories: TypedStorage<StatusBarCategory[]>
  /** 功能归属映射 */
  readonly featureCategory: TypedStorage<FeatureCategoryMap>

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin)
    this.shortcuts = new TypedStorage(storage, STORAGE_KEYS.SHORTCUTS, [])
    this.monitors = new TypedStorage(storage, STORAGE_KEYS.MONITORS, [])
    this.categories = new TypedStorage(storage, STORAGE_KEYS.CATEGORIES, [])
    this.featureCategory = new TypedStorage(storage, STORAGE_KEYS.FEATURE_CATEGORY, {})
  }
}
