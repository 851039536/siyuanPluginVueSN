/**
 * 提示词库存储管理类
 * PluginStorage + TypedStorage 槽位封装，含旧 key（siyuan-skills）与旧格式（content* → contents）迁移
 */
import type {
  Prompt,
  PromptCategory,
} from "./index"
import { Plugin } from "siyuan"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"

export class PromptsStorage {
  private static readonly KEY_PROMPTS = "siyuan-prompts"
  private static readonly KEY_CATEGORIES = "siyuan-categories"
  private static readonly LEGACY_KEY_PROMPTS = "siyuan-skills"

  private _storage: PluginStorage
  readonly prompts: TypedStorage<Prompt[]>
  readonly categories: TypedStorage<PromptCategory[]>

  constructor(plugin: Plugin) {
    this._storage = new PluginStorage(plugin)
    this.prompts = new TypedStorage<Prompt[]>(this._storage, PromptsStorage.KEY_PROMPTS, [])
    this.categories = new TypedStorage<PromptCategory[]>(
      this._storage,
      PromptsStorage.KEY_CATEGORIES,
      [],
    )
  }

  /**
   * 加载提示词数据：优先读取新 key，若为空则回退旧 key；
   * 检测到旧格式（content/content2/content3）时自动迁移并回写，调用方无需关心迁移
   */
  async loadPromptsWithMigration(): Promise<Prompt[]> {
    let data = await this.prompts.loadOrDefault()
    if (!data || data.length === 0) {
      const oldData = await this._storage.load<Prompt[]>(PromptsStorage.LEGACY_KEY_PROMPTS)
      if (oldData && Array.isArray(oldData) && oldData.length > 0) {
        await this.prompts.save(oldData)
        data = oldData
      }
    }
    if (Array.isArray(data) && data.length > 0 && PromptsStorage.needsMigration(data)) {
      if (this.migratePrompts(data)) {
        await this.prompts.save(data)
      }
    }
    return data
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
