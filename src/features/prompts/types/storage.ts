/**
 * 提示词库存储管理类
 * PluginStorage + TypedStorage 槽位封装，含：
 *  - 串行写队列（读-改-写不被并发操作交错覆盖）
 *  - 写入失败抛错封装（PluginStorage.save 失败只返回 false，不抛）
 *  - 旧 key（siyuan-skills）与旧格式（content* → contents）一次性迁移（marker 守卫）
 */
import type {
  Prompt,
  PromptCategory,
} from "./index"
import {
  MAX_CATEGORIES,
  MAX_PROMPTS,
} from "./index"
import { Plugin } from "siyuan"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"

/** 一次性迁移标记值：从 0 起，递增代表新的迁移版本 */
const MIGRATION_VERSION = 1

export class PromptsStorage {
  private static readonly KEY_PROMPTS = "siyuan-prompts"
  private static readonly KEY_CATEGORIES = "siyuan-categories"
  private static readonly LEGACY_KEY_PROMPTS = "siyuan-skills"
  private static readonly KEY_MIGRATION = "siyuan-prompts-migration-v1"

  private _storage: PluginStorage
  readonly prompts: TypedStorage<Prompt[]>
  readonly categories: TypedStorage<PromptCategory[]>
  private readonly migration: TypedStorage<number>

  /** 写队列：保证「读-改-写」不被并发操作交错覆盖（AGENTS.md 存储规范） */
  private writeQueue: Promise<unknown> = Promise.resolve()

  constructor(plugin: Plugin) {
    this._storage = new PluginStorage(plugin)
    this.prompts = new TypedStorage<Prompt[]>(this._storage, PromptsStorage.KEY_PROMPTS, [])
    this.categories = new TypedStorage<PromptCategory[]>(
      this._storage,
      PromptsStorage.KEY_CATEGORIES,
      [],
    )
    this.migration = new TypedStorage<number>(this._storage, PromptsStorage.KEY_MIGRATION, 0)
  }

  /**
   * 串行执行一次写操作（前一次失败不影响后续）。
   * 供 composable 把「改内存 → 落盘」作为一个不可交错的原子任务。
   */
  runExclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = this.writeQueue.then(task, task)
    this.writeQueue = run.catch(() => undefined)
    return run
  }

  /**
   * 写入并在失败时抛错。
   * 根因：PluginStorage.save() 失败仅 return false（不抛），直接 await 会让调用方误判为成功。
   * 这是 prompts 侧局部封装，不改公共工具语义（全库 100+ 调用点依赖返回 boolean）。
   */
  async persistOrThrow<T>(slot: TypedStorage<T>, data: T): Promise<void> {
    const ok = await slot.save(data)
    if (!ok) {
      // PluginStorage.save 内部已 console.error 打印具体 key，这里抛错供上层回滚与提示
      throw new Error("[prompts] 数据写入失败")
    }
  }

  /**
   * 纯读取提示词数据（不含任何迁移副作用）。
   * 迁移已移出初始化路径，由 showPromptsModal 显式调用 migrateOnce() 完成。
   */
  async loadPrompts(): Promise<Prompt[]> {
    const data = await this.prompts.loadOrDefault()
    return Array.isArray(data) ? data : []
  }

  /**
   * 一次性迁移（旧 key 回退 + 旧格式 content* → contents），由 marker 守卫。
   * 规范：禁止每次打开面板都侦测；读取失败（loadSafe ok:false）时不落标记、下次重试。
   */
  async migrateOnce(): Promise<void> {
    // 1) 已迁移过：立即返回，不再读取任何旧数据
    const done = await this.migration.loadOrDefault()
    if (typeof done === "number" && done >= MIGRATION_VERSION) return

    // 2) 探测新 key 数据，区分「键不存在」与「读取失败」
    const currentProbe = await this.prompts.loadSafe()
    if (!currentProbe.ok) {
      console.warn("[prompts] 提示词读取失败，本次跳过迁移（下次打开重试）")
      return
    }
    let data = Array.isArray(currentProbe.value) ? currentProbe.value : []

    // 3) 新 key 为空时回退旧 key（同样区分不存在与读取失败）
    if (data.length === 0) {
      const legacyProbe = await this._storage.loadSafe<Prompt[]>(PromptsStorage.LEGACY_KEY_PROMPTS)
      if (!legacyProbe.ok) {
        console.warn("[prompts] 旧版技能数据读取失败，本次跳过迁移（下次打开重试）")
        return
      }
      if (Array.isArray(legacyProbe.value) && legacyProbe.value.length > 0) {
        await this.persistOrThrow(this.prompts, this.clampPrompts(legacyProbe.value))
        data = legacyProbe.value
      }
    }

    // 4) 旧格式迁移
    if (data.length > 0 && PromptsStorage.needsMigration(data)) {
      if (this.migratePrompts(data)) {
        await this.persistOrThrow(this.prompts, this.clampPrompts(data))
      }
    }

    // 5) 全部写成功后才落标记；标记写入失败无妨——下次重跑时迁移已幂等
    await this.persistOrThrow(this.migration, MIGRATION_VERSION)
  }

  /** 裁剪到上限：growth 槽位必须有清理路径，防止无界增长 */
  clampPrompts(list: Prompt[]): Prompt[] {
    return list.length > MAX_PROMPTS ? list.slice(0, MAX_PROMPTS) : list
  }

  clampCategories(list: PromptCategory[]): PromptCategory[] {
    return list.length > MAX_CATEGORIES ? list.slice(0, MAX_CATEGORIES) : list
  }

  /** 单条判定：是否为待迁移的旧格式条目（迁移触发检测与 migratePrompts 跳过条件共用） */
  private static isLegacyFormat(prompt: Prompt): boolean {
    if (prompt.contents && Array.isArray(prompt.contents) && prompt.contents.length > 0) {
      return false
    }
    if (prompt.contents && Array.isArray(prompt.contents) && prompt.contents.length === 0 && !prompt.content) {
      return false
    }
    return true
  }

  /** 批量判定：列表中是否存在待迁移条目 */
  static needsMigration(prompts: Prompt[]): boolean {
    return prompts.some((p) => PromptsStorage.isLegacyFormat(p))
  }

  /**
   * 迁移旧格式 Prompt（content/content2/content3）到新格式（contents 数组）
   * 返回是否发生了迁移
   */
  migratePrompts(prompts: Prompt[]): boolean {
    let migrated = false
    for (const prompt of prompts) {
      if (!PromptsStorage.isLegacyFormat(prompt)) {
        continue
      }

      const contents: { id: string, label: string, text: string }[] = []
      let idx = 1
      if (prompt.content) {
        contents.push({
          id: `${prompt.id}-c${idx}`,
          label: `Block ${idx}`,
          text: prompt.content,
        })
        idx++
      }
      if (prompt.content2) {
        contents.push({
          id: `${prompt.id}-c${idx}`,
          label: `Block ${idx}`,
          text: prompt.content2,
        })
        idx++
      }
      if (prompt.content3) {
        contents.push({
          id: `${prompt.id}-c${idx}`,
          label: `Block ${idx}`,
          text: prompt.content3,
        })
        idx++
      }
      prompt.contents = contents
      delete prompt.content
      delete prompt.content2
      delete prompt.content3
      migrated = true
    }
    return migrated
  }
}
