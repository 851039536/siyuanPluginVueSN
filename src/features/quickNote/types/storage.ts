/**
 * 速记功能 — 存储层
 * 基于 TypedStorage 定义统一数据槽（AppData：待办/灵感/项目）与功能设置两个类型安全存储槽；
 * 统一数据槽的读改写经实例级串行锁（mutate），供三个 composable 共享，避免并发覆盖丢更新
 */
import type { Plugin } from "siyuan"
import type {
  AppData,
  QuickNoteSettings,
} from "./index"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"
import { pruneAppData } from "../pureUtils"

/** 默认设置：弹窗居中显示，无自定义坐标，非最小化，默认宽度 624px（高度由视口比例派生） */
export const DEFAULT_QUICK_NOTE_SETTINGS: QuickNoteSettings = {
  position: "center",
  customX: 0,
  customY: 0,
  minimized: false,
  panelWidth: 624,
  panelHeight: 0,
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
  /** 统一数据槽写盘队列：三个 composable 的全部读改写串行执行 */
  private writeQueue: Promise<unknown> = Promise.resolve()

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin)
    this.data = new TypedStorage(storage, "quick-note-data", DEFAULT_QUICK_NOTE_DATA)
    this.settings = new TypedStorage(storage, "quick-note-settings", DEFAULT_QUICK_NOTE_SETTINGS)
  }

  /** 串行执行一段读改写任务（前序失败不阻塞后续） */
  private runExclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = this.writeQueue.then(task, task)
    this.writeQueue = run.catch(() => undefined)
    return run
  }

  /**
   * 单次读取统一数据槽（含增长型数据裁剪，裁剪有变更时落盘）
   * 供面板挂载时一次性取快照，避免三个 composable 各读一次
   */
  async loadAll(): Promise<AppData> {
    const data = await this.data.loadOrDefault()
    const pruned = pruneAppData(data, Date.now())
    if (pruned === data) return data
    await this.mutate(() => pruned)
    return pruned
  }

  /**
   * 锁内「读最新 → 构造完整 payload → 写回」
   * build 返回 null 表示无需写盘；save 失败抛出异常，供调用方统一提示
   */
  mutate(build: (current: AppData) => AppData | null): Promise<void> {
    return this.runExclusive(async () => {
      const current = await this.data.loadOrDefault()
      const next = build(current)
      if (next === null) return
      if (!(await this.data.save(next))) {
        throw new Error("quick-note-data 保存失败")
      }
    })
  }
}
