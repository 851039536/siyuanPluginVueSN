import type {
  Prompt,
  PromptCategory,
} from "./index"
/**
 * 悬浮框功能 - 数据存储管理
 */
import { Plugin } from "siyuan"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"

/**
 * 悬浮框存储管理类
 */
export class FloatingBoxStorage {
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
    return {
      prompts,
      categories,
    }
  }

  /**
   * 迁移旧格式 Prompt（content/content2/content3）到新格式（contents 数组）
   * 返回是否发生了迁移
   */
  migratePrompts(prompts: Prompt[]): boolean {
    let migrated = false
    for (const prompt of prompts) {
      // 已迁移：有 contents 数组且不是空数组（或旧字段不存在）
      if (prompt.contents && Array.isArray(prompt.contents) && prompt.contents.length > 0) {
        continue
      }
      // 新格式但空数组，也不需迁移
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
      // 清除旧字段
      delete prompt.content
      delete prompt.content2
      delete prompt.content3
      migrated = true
    }
    return migrated
  }
}
