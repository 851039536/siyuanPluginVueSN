/**
 * 类型安全的存储槽
 * 将 key + type + defaultValue 绑定为单一实体，消除重复的 save/load 样板代码
 *
 * 用法：
 *   const font = new TypedStorage<FontSettings>(storage, "font-settings", DEFAULT_FONT);
 *   await font.save(settings);
 *   const data = await font.loadOrDefault();
 */
import { PluginStorage } from "./pluginStorage";

export class TypedStorage<T> {
  private _storage: PluginStorage;
  private _key: string;
  private _defaultValue: T | undefined;

  constructor(storage: PluginStorage, key: string, defaultValue?: T) {
    this._storage = storage;
    this._key = key;
    this._defaultValue = defaultValue;
  }

  /** 保存数据 */
  async save(data: T): Promise<boolean> {
    return this._storage.save(this._key, data);
  }

  /** 加载数据，不存在返回 null */
  async load(): Promise<T | null> {
    return this._storage.load<T>(this._key);
  }

  /**
   * 加载数据，若不存在则返回默认值
   * 对象类型会与默认值进行浅合并（{ ...defaultValue, ...saved }），
   * 确保新增字段有默认值兜底
   */
  async loadOrDefault(): Promise<T> {
    const data = await this._storage.load<T>(this._key);
    if (data === null || data === undefined) {
      if (this._defaultValue !== undefined) {
        if (
          typeof this._defaultValue === "object" &&
          !Array.isArray(this._defaultValue) &&
          this._defaultValue !== null
        ) {
          return { ...this._defaultValue } as T;
        }
        return this._defaultValue;
      }
      return data as T;
    }
    if (
      this._defaultValue !== undefined &&
      typeof this._defaultValue === "object" &&
      !Array.isArray(this._defaultValue) &&
      this._defaultValue !== null
    ) {
      return { ...this._defaultValue, ...data } as T;
    }
    return data;
  }

  /** 删除数据 */
  async remove(): Promise<boolean> {
    return this._storage.remove(this._key);
  }

  /** 检查数据是否存在 */
  async exists(): Promise<boolean> {
    return this._storage.exists(this._key);
  }
}
