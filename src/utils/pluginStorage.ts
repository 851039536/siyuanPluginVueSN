/**
 * 插件存储通用工具类
 * 封装思源插件的 saveData 和 loadData 方法
 */
import { Plugin } from "siyuan";

/**
 * 插件存储管理器
 * 提供类型安全的数据存储和加载功能
 */
export class PluginStorage {
  private plugin: Plugin;

  constructor(plugin: Plugin) {
    this.plugin = plugin;
  }

  /**
   * 保存数据
   * @param key 存储键名
   * @param data 要存储的数据
   * @returns 是否保存成功
   */
  async save<T>(key: string, data: T): Promise<boolean> {
    try {
      await this.plugin.saveData(key, data);
      return true;
    } catch (error) {
      console.error(`保存数据失败 [${key}]:`, error);
      return false;
    }
  }

  /**
   * 加载数据
   * @param key 存储键名
   * @returns 加载的数据，失败返回 null
   */
  async load<T>(key: string): Promise<T | null> {
    try {
      const data = await this.plugin.loadData(key);
      return data as T;
    } catch (error) {
      console.error(`加载数据失败 [${key}]:`, error);
      return null;
    }
  }

  /**
   * 加载数据（带默认值）
   * @param key 存储键名
   * @param defaultValue 默认值
   * @returns 加载的数据，失败或不存在时返回默认值
   */
  async loadWithDefault<T>(key: string, defaultValue: T): Promise<T> {
    const data = await this.load<T>(key);
    return data ?? defaultValue;
  }

  /**
   * 删除数据（通过保存空字符串实现）
   * @param key 存储键名
   * @returns 是否删除成功
   */
  async remove(key: string): Promise<boolean> {
    try {
      await this.plugin.saveData(key, "");
      return true;
    } catch (error) {
      console.error(`删除数据失败 [${key}]:`, error);
      return false;
    }
  }

  /**
   * 检查数据是否存在
   * @param key 存储键名
   * @returns 数据是否存在
   */
  async exists(key: string): Promise<boolean> {
    const data = await this.load(key);
    return data !== null && data !== undefined && data !== "";
  }
}

/**
 * 创建插件存储实例的工厂函数
 * @param plugin 插件实例
 * @returns PluginStorage 实例
 */
export function createPluginStorage(plugin: Plugin): PluginStorage {
  return new PluginStorage(plugin);
}
