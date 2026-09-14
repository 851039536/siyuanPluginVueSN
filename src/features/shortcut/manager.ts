/**
 * 快捷键模块 - 管理器
 * 双段模型：预置（代码真源，只读）+ 自定义（可写并持久化）
 */
import type { ShortcutInfo } from "./types"
import { searchShortcuts } from "./utils"

/**
 * 快捷键管理器
 */
export class ShortcutManager {
  /** 预置快捷键（代码真源，运行时只读） */
  private presets: ShortcutInfo[] = []
  /** 自定义快捷键（唯一可写段） */
  private custom: ShortcutInfo[] = []
  /** 预置 id 集合：判定「是否预置」的唯一依据 */
  private presetIds = new Set<string>()
  private onSave?: (custom: ShortcutInfo[]) => Promise<boolean>

  /**
   * 载入数据（预置 + 自定义），替换整个数据源
   */
  loadFrom(input: { presets: ShortcutInfo[]; custom: ShortcutInfo[] }): void {
    this.presets = [...input.presets]
    this.custom = [...input.custom]
    this.presetIds = new Set(this.presets.map((item) => item.id))
  }

  /**
   * 设置保存回调：任何自定义段变更后调用，载荷为自定义列表
   */
  setSaveCallback(callback: (custom: ShortcutInfo[]) => Promise<boolean>): void {
    this.onSave = callback
  }

  /**
   * 触发保存，返回是否落盘成功
   */
  private async triggerSave(): Promise<boolean> {
    if (!this.onSave) return true
    try {
      return await this.onSave([...this.custom])
    } catch (error) {
      console.error("保存自定义快捷键失败:", error)
      return false
    }
  }

  /**
   * 获取全部快捷键（预置在前，自定义在后）
   */
  getAllShortcuts(): ShortcutInfo[] {
    return [...this.presets, ...this.custom]
  }

  /**
   * 获取自定义快捷键
   */
  getCustomShortcuts(): ShortcutInfo[] {
    return [...this.custom]
  }

  /**
   * 获取预置 id 集合（只读）
   */
  getPresetIds(): ReadonlySet<string> {
    return this.presetIds
  }

  /**
   * 是否为预置快捷键（预置不可编辑、不可删除）
   */
  isPreset(id: string): boolean {
    return this.presetIds.has(id)
  }

  /**
   * 获取指定分类的快捷键
   */
  getByCategory(category: string): ShortcutInfo[] {
    return this.getAllShortcuts().filter((item) => item.category === category)
  }

  /**
   * 搜索快捷键（筛选逻辑与视图层共用 utils.searchShortcuts）
   */
  search(keyword: string): ShortcutInfo[] {
    return searchShortcuts(this.getAllShortcuts(), keyword)
  }

  /**
   * 新增或更新自定义快捷键（预置 id 一律拒绝）
   * @returns 是否落盘成功
   */
  async addOrUpdateCustom(shortcut: ShortcutInfo): Promise<boolean> {
    if (this.isPreset(shortcut.id)) {
      console.warn(`[shortcut] ${shortcut.id} 是预置快捷键，不可覆盖`)
      return false
    }

    const index = this.custom.findIndex((item) => item.id === shortcut.id)
    if (index === -1) {
      this.custom.push(shortcut)
    } else {
      this.custom[index] = shortcut
    }
    return this.triggerSave()
  }

  /**
   * 删除自定义快捷键（预置 id 拒绝）
   * @returns 是否找到并落盘成功
   */
  async removeCustom(id: string): Promise<boolean> {
    const index = this.custom.findIndex((item) => item.id === id)
    if (index === -1 || this.isPreset(id)) {
      return false
    }
    this.custom.splice(index, 1)
    return this.triggerSave()
  }

  /**
   * 整体替换自定义段（导入合并后写入）
   * @returns 是否落盘成功
   */
  async replaceCustom(list: ShortcutInfo[]): Promise<boolean> {
    this.custom = list.filter((item) => !this.isPreset(item.id))
    return this.triggerSave()
  }

  /**
   * 清空自定义段（重置）
   * @returns 是否落盘成功
   */
  async clearCustom(): Promise<boolean> {
    this.custom = []
    return this.triggerSave()
  }
}

/**
 * 全局快捷键管理器实例
 */
let globalManager: ShortcutManager | null = null

/**
 * 获取全局快捷键管理器
 */
export function getShortcutManager(): ShortcutManager {
  if (!globalManager) {
    globalManager = new ShortcutManager()
  }
  return globalManager
}
