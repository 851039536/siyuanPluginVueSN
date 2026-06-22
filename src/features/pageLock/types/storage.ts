import { Plugin } from "siyuan"
import { PluginStorage } from "@/utils/pluginStorage"
import {
  hashPassword,
  verifyPassword,
} from "../utils/crypto"

/**
 * 页面锁定信息
 */
export interface PageLockInfo {
  docId: string
  passwordHash: string
  salt: string
  locked: boolean
  createdAt: number
  updatedAt: number
}

/** 全局密码存储结构 */
interface GlobalPasswordData {
  hash: string
  salt: string
}

const STORAGE_KEY = "page-lock-data"
const GLOBAL_PASSWORD_KEY = "global-password"

/**
 * 页面锁定存储管理类
 */
export class PageLockStorage {
  private storage: PluginStorage

  constructor(plugin: Plugin) {
    this.storage = new PluginStorage(plugin)
  }

  async init(): Promise<void> {
    const data = await this.storage.load(STORAGE_KEY)
    if (!data) {
      await this.storage.save(STORAGE_KEY, {})
    }
  }

  private async getAllLocks(): Promise<Record<string, PageLockInfo>> {
    const data = await this.storage.load<Record<string, PageLockInfo>>(
      STORAGE_KEY,
    )
    return data || {}
  }

  private async saveAllLocks(locks: Record<string, PageLockInfo>): Promise<boolean> {
    return this.storage.save(STORAGE_KEY, locks)
  }

  async lockPage(docId: string, password: string): Promise<boolean> {
    try {
      const { hash: passwordHash, salt } = await hashPassword(password)
      const locks = await this.getAllLocks()

      locks[docId] = {
        docId,
        passwordHash,
        salt,
        locked: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      return await this.saveAllLocks(locks)
    } catch (error) {
      console.error("锁定页面失败:", error)
      return false
    }
  }

  async unlockPage(docId: string, password: string): Promise<boolean> {
    try {
      const locks = await this.getAllLocks()
      const lockInfo = locks[docId]

      if (!lockInfo) {
        return false
      }

      const isValid = await verifyPassword(
        password,
        lockInfo.passwordHash,
        lockInfo.salt,
      )
      if (isValid) {
        delete locks[docId]
        return await this.saveAllLocks(locks)
      }

      return false
    } catch (error) {
      console.error("解锁页面失败:", error)
      return false
    }
  }

  async isPageLocked(docId: string): Promise<boolean> {
    const locks = await this.getAllLocks()
    return !!locks[docId]?.locked
  }

  async verifyPagePassword(
    docId: string,
    password: string,
  ): Promise<boolean> {
    try {
      const locks = await this.getAllLocks()
      const lockInfo = locks[docId]

      if (!lockInfo) {
        return false
      }

      return await verifyPassword(
        password,
        lockInfo.passwordHash,
        lockInfo.salt,
      )
    } catch (error) {
      console.error("验证密码失败:", error)
      return false
    }
  }

  async getLockInfo(docId: string): Promise<PageLockInfo | null> {
    const locks = await this.getAllLocks()
    return locks[docId] || null
  }

  async changePassword(
    docId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<boolean> {
    try {
      const locks = await this.getAllLocks()
      const lockInfo = locks[docId]

      if (!lockInfo) {
        return false
      }

      const isValid = await verifyPassword(
        oldPassword,
        lockInfo.passwordHash,
        lockInfo.salt,
      )
      if (!isValid) {
        return false
      }

      const { hash: newHash, salt: newSalt } = await hashPassword(newPassword)
      locks[docId] = {
        ...lockInfo,
        passwordHash: newHash,
        salt: newSalt,
        updatedAt: Date.now(),
      }

      return await this.saveAllLocks(locks)
    } catch (error) {
      console.error("修改密码失败:", error)
      return false
    }
  }

  // ==================== 全局密码管理 ====================
  //
  // 持久层：仅存储 PBKDF2 哈希 + 盐值（hash:salt 格式）
  // 内存层：会话期间缓存明文密码，用于锁页/解锁页时的即时操作

  private globalHash: string | null = null
  private globalSalt: string | null = null
  private globalPassword: string | null = null

  /** 加载全局密码数据（仅加载哈希 + 盐值，明文需重新验证获取） */
  async loadGlobalPassword(): Promise<void> {
    try {
      const data = await this.storage.load<GlobalPasswordData>(
        GLOBAL_PASSWORD_KEY,
      )
      if (data?.hash && data?.salt) {
        this.globalHash = data.hash
        this.globalSalt = data.salt
      }
    } catch (error) {
      console.error("加载全局密码失败:", error)
    }
  }

  /** 保存全局密码（持久化哈希 + 盐值，同时缓存明文供会话使用） */
  async saveGlobalPassword(password: string): Promise<boolean> {
    try {
      const { hash, salt } = await hashPassword(password)
      const success = await this.storage.save(GLOBAL_PASSWORD_KEY, {
        hash,
        salt,
      })
      if (success) {
        this.globalHash = hash
        this.globalSalt = salt
        this.globalPassword = password
      }
      return success
    } catch (error) {
      console.error("保存全局密码失败:", error)
      return false
    }
  }

  /** 全局密码是否已设置（持久层判断） */
  isGlobalPasswordSet(): boolean {
    return !!(this.globalHash && this.globalSalt)
  }

  /** 获取内存中的明文密码（仅当前会话，重启后需重新验证 */ 
  getGlobalPassword(): string | null {
    return this.globalPassword
  }

  /** 验证输入的密码是否与全局密码匹配。匹配成功后自动缓存明文供会话使用 */
  async verifyGlobalPassword(password: string): Promise<boolean> {
    if (!this.globalHash || !this.globalSalt) {
      return false
    }
    const valid = await verifyPassword(password, this.globalHash, this.globalSalt)
    if (valid) {
      this.globalPassword = password
    }
    return valid
  }
}
