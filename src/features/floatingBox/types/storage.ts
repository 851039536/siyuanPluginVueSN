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
}
