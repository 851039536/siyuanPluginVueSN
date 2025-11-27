/**
 * 快捷键模块 - 持久化存储
 * 负责快捷键数据的保存和加载
 */
import { Plugin } from 'siyuan'
import type { ShortcutInfo } from './types'

/**
 * 快捷键存储键
 */
const SHORTCUTS_STORAGE_KEY = 'plugin-shortcuts-custom'

/**
 * 加载自定义快捷键数据
 * @param plugin 插件实例
 * @returns 自定义快捷键数组
 */
export async function loadCustomShortcuts(plugin: Plugin): Promise<ShortcutInfo[]> {
  try {
    const data = await plugin.loadData(SHORTCUTS_STORAGE_KEY)
    if (!data || !Array.isArray(data)) {
      console.log('未找到已保存的自定义快捷键')
      return []
    }
    console.log('已加载自定义快捷键:', data)
    return data
  } catch (error) {
    console.error('加载自定义快捷键失败:', error)
    return []
  }
}

/**
 * 保存自定义快捷键数据
 * @param plugin 插件实例
 * @param shortcuts 快捷键数组
 * @returns 保存是否成功
 */
export async function saveCustomShortcuts(plugin: Plugin, shortcuts: ShortcutInfo[]): Promise<boolean> {
  try {
    // 只保存自定义快捷键（category === 'custom'）
    const customShortcuts = shortcuts.filter(s => s.category === 'custom')
    await plugin.saveData(SHORTCUTS_STORAGE_KEY, customShortcuts)
    console.log('自定义快捷键已保存:', customShortcuts)
    return true
  } catch (error) {
    console.error('保存自定义快捷键失败:', error)
    return false
  }
}

/**
 * 清空所有自定义快捷键数据
 * @param plugin 插件实例
 * @returns 清空是否成功
 */
export async function clearCustomShortcuts(plugin: Plugin): Promise<boolean> {
  try {
    await plugin.saveData(SHORTCUTS_STORAGE_KEY, [])
    console.log('自定义快捷键已清空')
    return true
  } catch (error) {
    console.error('清空自定义快捷键失败:', error)
    return false
  }
}
