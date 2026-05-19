/**
 * 类型安全的存储槽
 * 将 key + type + defaultValue 绑定为单一实体，消除重复的 save/load 样板代码
 *
 * 用法：
 *   const font = new TypedStorage<FontSettings>(storage, "font-settings", DEFAULT_FONT);
 *   await font.save(settings);
 *   const data = await font.loadOrDefault();
 */
import { PluginStorage } from "./pluginStorage"

export class TypedStorage<T> {
  private _storage: PluginStorage
  private _key: string
  private _defaultValue: T | undefined

  constructor(storage: PluginStorage, key: string, defaultValue?: T) {
    this._storage = storage
    this._key = key
    this._defaultValue = defaultValue
  }

  /** 保存数据 */
  async save(data: T): Promise<boolean> {
    return this._storage.save(this._key, data)
  }

  /** 加载数据，不存在返回 null */
  async load(): Promise<T | null> {
    return this._storage.load<T>(this._key)
  }

  /**
   * 加载数据，若不存在则返回默认值
   * 对象类型会与默认值进行浅合并（{ ...defaultValue, ...saved }），
   * 确保新增字段有默认值兜底
   * 数组类型会校验返回值的类型，非数组时回退到默认值
   */
  async loadOrDefault(): Promise<T> {
    const data = await this._storage.load<T>(this._key)
    // 数据不存在时返回默认值
    if (data === null || data === undefined) {
      return this._getDefault()
    }
    // 默认值是数组时，校验当前值是否为数组
    if (this._defaultValue !== undefined && Array.isArray(this._defaultValue)) {
      if (!Array.isArray(data)) {
        console.warn(`[TypedStorage] key="${this._key}" 存储的数据不是数组，已回退到默认值`)
        return this._defaultValue as T
      }
      return data
    }
    // 默认值是对象时，进行浅合并
    if (
      this._defaultValue !== undefined
      && typeof this._defaultValue === "object"
      && this._defaultValue !== null
    ) {
      return {
        ...this._defaultValue,
        ...data,
      } as T
    }
    return data
  }

  /** 获取默认值的独立副本 */
  private _getDefault(): T {
    if (this._defaultValue === undefined) {
      return undefined as unknown as T
    }
    if (Array.isArray(this._defaultValue)) {
      return [] as unknown as T
    }
    if (typeof this._defaultValue === "object" && this._defaultValue !== null) {
      return { ...this._defaultValue } as T
    }
    return this._defaultValue
  }

  /** 删除数据 */
  async remove(): Promise<boolean> {
    return this._storage.remove(this._key)
  }

  /** 检查数据是否存在 */
  async exists(): Promise<boolean> {
    return this._storage.exists(this._key)
  }
}
