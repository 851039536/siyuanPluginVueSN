/**
 * 插件存储通用工具类
 * 封装思源插件的 saveData 和 loadData 方法
 */
// 仅作类型使用（从未作为值引用）：写成 import type 才能让本模块及其下游
// 在纯 Node 环境（单元测试）中被加载——siyuan 包的 exports 字段在 node 条件下不可解析，
// 值导入会把整个运行时依赖钉进模块图。构建产物不受影响（类型导入本就会被擦除）。
import type { Plugin } from "siyuan"

/**
 * 插件存储管理器
 * 提供类型安全的数据存储和加载功能
 */
export class PluginStorage {
  private plugin: Plugin

  constructor(plugin: Plugin) {
    this.plugin = plugin
  }

  /**
   * 保存数据
   * @param key 存储键名
   * @param data 要存储的数据
   * @returns 是否保存成功
   */
  async save<T>(key: string, data: T): Promise<boolean> {
    try {
      await this.plugin.saveData(key, data)
      return true
    } catch (error) {
      console.error(`保存数据失败 [${key}]:`, error)
      return false
    }
  }

  /**
   * 加载数据
   * @param key 存储键名
   * @returns 加载的数据，失败返回 null
   */
  async load<T>(key: string): Promise<T | null> {
    try {
      const data = await this.plugin.loadData(key)
      // 思源 loadData 在文件不存在（404）时返回 ""，remove() 也以写入 "" 实现删除
      // 统一将空字符串归一化为 null，避免下游误判为损坏数据
      if (data === "" || data === undefined) {
        return null
      }
      return data as T
    } catch (error) {
      console.error(`加载数据失败 [${key}]:`, error)
      return null
    }
  }

  /**
   * 加载数据（**区分「键不存在」与「读取失败」**）。
   *
   * 为什么不直接用 {@link load}：`load()` 在读取异常时也返回 null，
   * 调用方无法分辨「这个键从没写过」与「这次读取失败了」。
   * 对于**一次性数据迁移**这是危险的——把读取失败当成「从未设置」并落迁移标记，
   * 会让迁移永久跳过；反之把「从未设置」当成失败则会每次启动重试。
   *
   * @returns `{ ok: true, value }`（value 为 null 表示键确实不存在）；
   *          `{ ok: false, error }` 读取异常，调用方应跳过本次并稍后重试
   */
  async loadSafe<T>(key: string): Promise<{ ok: true, value: T | null } | { ok: false, error: unknown }> {
    try {
      const data = await this.plugin.loadData(key)
      if (data === "" || data === undefined) {
        return {
          ok: true,
          value: null,
        }
      }
      return {
        ok: true,
        value: data as T,
      }
    } catch (error) {
      console.error(`加载数据失败 [${key}]:`, error)
      return {
        ok: false,
        error,
      }
    }
  }

  /**
   * 删除数据（通过保存空字符串实现）
   * @param key 存储键名
   * @returns 是否删除成功
   */
  async remove(key: string): Promise<boolean> {
    try {
      await this.plugin.saveData(key, "")
      return true
    } catch (error) {
      console.error(`删除数据失败 [${key}]:`, error)
      return false
    }
  }

  /**
   * 检查数据是否存在
   * @param key 存储键名
   * @returns 数据是否存在
   */
  async exists(key: string): Promise<boolean> {
    const data = await this.load(key)
    return data !== null && data !== undefined && data !== ""
  }
}
