import type {
  Skill,
  SkillCategory,
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
  readonly skills: TypedStorage<Skill[]>
  readonly categories: TypedStorage<SkillCategory[]>

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin)
    this.skills = new TypedStorage<Skill[]>(storage, "siyuan-skills", [])
    this.categories = new TypedStorage<SkillCategory[]>(
      storage,
      "siyuan-categories",
      [],
    )
  }

  /**
   * 初始化存储（加载所有数据）
   */
  async init(): Promise<{
    skills: Skill[]
    categories: SkillCategory[]
  }> {
    const skills = await this.skills.loadOrDefault()
    const categories = await this.categories.loadOrDefault()
    return {
      skills,
      categories,
    }
  }
}
