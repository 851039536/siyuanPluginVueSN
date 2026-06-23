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
export class SkillsStorage {
  readonly prompts: TypedStorage<Prompt[]>
  readonly categories: TypedStorage<PromptCategory[]>

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin)
    this.prompts = new TypedStorage<Prompt[]>(storage, "siyuan-skills", [])
    this.categories = new TypedStorage<PromptCategory[]>(
      storage,
      "siyuan-categories",
      [],
    )
  }

  /**
   * 初始化存储（加载所有数据）
   */
  async init(): Promise<{
    prompts: Prompt[]
    categories: PromptCategory[]
  }> {
    const prompts = await this.prompts.loadOrDefault()
    const categories = await this.categories.loadOrDefault()
    return { prompts, categories }
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
          label: `内容${idx}`,
          text: prompt.content,
        })
        idx++
      }
      if (prompt.content2) {
        contents.push({
          id: `${prompt.id}-c${idx}`,
          label: `内容${idx}`,
          text: prompt.content2,
        })
        idx++
      }
      if (prompt.content3) {
        contents.push({
          id: `${prompt.id}-c${idx}`,
          label: `内容${idx}`,
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
