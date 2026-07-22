import type {
  Prompt,
  PromptCategory,
} from "./index"
import { Plugin } from "siyuan"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"

/**
 * 提示词库存储管理类
 */
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
   * 加载提示词数据：优先读取新 key，若为空则回退旧 key 并自动迁移
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
    return data
  }

  /**
   * 迁移旧格式 Prompt（content/content2/content3）到新格式（contents 数组）
   * 返回是否发生了迁移
   */
  migratePrompts(prompts: Prompt[]): boolean {
    let migrated = false
    for (const prompt of prompts) {
      if (prompt.contents && Array.isArray(prompt.contents) && prompt.contents.length > 0) {
        continue
      }
      if (prompt.contents && Array.isArray(prompt.contents) && prompt.contents.length === 0 && !prompt.content) {
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
