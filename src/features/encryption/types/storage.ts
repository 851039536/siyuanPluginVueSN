/**
 * 加密/解密功能 - 数据存储管理
 *
 * 密码经 settingsCrypto 加密后落盘（应用层加密，非安全边界）。
 * 旧 key `encryption_password.json` 为明文且命名不合规，首次加载时一次性迁移到
 * `encryption-password`，成功后删除旧 key（迁移本身幂等，无需额外标记键）。
 */
import { Plugin } from "siyuan"
import { PluginStorage } from "@/utils/pluginStorage"
import {
  decryptSetting,
  encryptSetting,
} from "@/utils/settingsCrypto"
import { TypedStorage } from "@/utils/typedStorage"

const STORAGE_KEY = "encryption-password"
const LEGACY_STORAGE_KEY = "encryption_password.json"

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
    this.passwordData = new TypedStorage(this.storage, STORAGE_KEY)
  }

  /**
   * 一次性迁移旧 key（幂等）：仅当新 key 为空且旧 key 有值时执行
   */
  async init(): Promise<void> {
    const current = await this.passwordData.load()
    if (current?.password) {
      // 新 key 已是权威值：旧 key 即便残留也不再使用，best-effort 清掉
      const stale = await this.storage.loadSafe<EncryptionPasswordData>(LEGACY_STORAGE_KEY)
      if (stale.ok && stale.value?.password) {
        await this.storage.remove(LEGACY_STORAGE_KEY)
      }
      return
    }

    const legacy = await this.storage.loadSafe<EncryptionPasswordData>(LEGACY_STORAGE_KEY)
    if (!legacy.ok || !legacy.value?.password) return

    const saved = await this.save(legacy.value.password)
    if (saved) {
      await this.storage.remove(LEGACY_STORAGE_KEY)
    }
  }

  /**
   * 保存密码到存储（加密后落盘）
   */
  async save(password: string): Promise<boolean> {
    return this.passwordData.save({ password: await encryptSetting(password) })
  }

  /**
   * 从存储中加载密码（兼容历史上未加密的明文值）
   */
  async load(): Promise<string | null> {
    const data = await this.passwordData.load()
    if (!data?.password) return null
    return decryptSetting(data.password)
  }
}
