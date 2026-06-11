/**
 * 快捷键模块 - 管理器
 * 负责快捷键数据的存储、查询和管理
 */
import type { ShortcutInfo } from "./types"

/**
 * 快捷键管理器
 */
export class ShortcutManager {
  private shortcuts: ShortcutInfo[] = []
  private onSave?: (shortcuts: ShortcutInfo[]) => Promise<void>

  constructor() {
    this.shortcuts = []
  }

  /**
   * 设置保存回调函数
   * 当快捷键数据发生变化时调用
   */
  setSaveCallback(
    callback: (shortcuts: ShortcutInfo[]) => Promise<void>,
  ): void {
    this.onSave = callback
  }

  /**
   * 触发保存
   */
  private async triggerSave(): Promise<void> {
    if (this.onSave) {
      try {
        await this.onSave(this.shortcuts)
      } catch (error) {
        console.error("保存快捷键失败:", error)
      }
    }
  }

  /**
   * 添加快捷键
   */
  async addShortcut(shortcut: ShortcutInfo): Promise<void> {
    // 检查ID是否已存在
    const existing = this.shortcuts.find((s) => s.id === shortcut.id)
    if (existing) {
      console.warn(`快捷键 ${shortcut.id} 已存在，将被覆盖`)
      const index = this.shortcuts.indexOf(existing)
      this.shortcuts[index] = shortcut
    } else {
      this.shortcuts.push(shortcut)
    }
    // 触发保存
    await this.triggerSave()
  }

  /**
   * 批量添加快捷键
   */
  async addShortcuts(shortcuts: ShortcutInfo[]): Promise<void> {
    for (const s of shortcuts) {
      const existing = this.shortcuts.find((item) => item.id === s.id)
      if (existing) {
        const index = this.shortcuts.indexOf(existing)
        this.shortcuts[index] = s
      } else {
        this.shortcuts.push(s)
      }
    }
    // 触发保存
    await this.triggerSave()
  }

  /**
   * 获取所有快捷键
   */
  getAllShortcuts(): ShortcutInfo[] {
    return [...this.shortcuts]
  }

  /**
   * 获取指定分类的快捷键
   */
  getByCategory(category: string): ShortcutInfo[] {
    return this.shortcuts.filter((s) => s.category === category)
  }

  /**
   * 按ID查询快捷键
   */
  getById(id: string): ShortcutInfo | undefined {
    return this.shortcuts.find((s) => s.id === id)
  }

  /**
   * 删除快捷键
   */
  async removeShortcut(id: string): Promise<boolean> {
    const index = this.shortcuts.findIndex((s) => s.id === id)
    if (index !== -1) {
      this.shortcuts.splice(index, 1)
      // 触发保存
      await this.triggerSave()
      return true
    }
    return false
  }

  /**
   * 清空所有快捷键
   */
  clear(): void {
    this.shortcuts = []
  }

  /**
   * 搜索快捷键
   */
  search(keyword: string): ShortcutInfo[] {
    const lowerKeyword = keyword.toLowerCase()
    return this.shortcuts.filter(
      (s) =>
        s.name.toLowerCase().includes(lowerKeyword)
        || s.description.toLowerCase().includes(lowerKeyword)
        || s.keys.toLowerCase().includes(lowerKeyword),
    )
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
