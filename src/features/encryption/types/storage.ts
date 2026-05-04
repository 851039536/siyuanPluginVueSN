/**
 * 加密/解密功能 - 数据存储管理
 * 使用 PluginStorage + TypedStorage 统一存储模式
 */
import { Plugin } from "siyuan"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"
import { CONSTANTS } from "./index"

/**
 * 加密密码存储结构
 */
export interface EncryptionPasswordData {
  password: string
}

/**
 * 加密存储管理类
 */
export class EncryptionStorage {
  readonly passwordData: TypedStorage<EncryptionPasswordData>

  private storage: PluginStorage

  constructor(plugin: Plugin) {
    this.storage = new PluginStorage(plugin)
    this.passwordData = new TypedStorage(this.storage, CONSTANTS.STORAGE_KEY)
  }

  /**
   * 保存密码到存储
   */
  async save(password: string): Promise<boolean> {
    return this.passwordData.save({ password })
  }

  /**
   * 从存储中加载密码
   */
  async load(): Promise<string | null> {
    const data = await this.passwordData.load()
    return data?.password ?? null
  }
}
