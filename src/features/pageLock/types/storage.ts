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
  locked: boolean
  createdAt: number
  updatedAt: number
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
      const passwordHash = await hashPassword(password)
      const locks = await this.getAllLocks()

      locks[docId] = {
        docId,
        passwordHash,
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

      const isValid = await verifyPassword(password, lockInfo.passwordHash)
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

      return await verifyPassword(password, lockInfo.passwordHash)
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
      )
      if (!isValid) {
        return false
      }

      const newPasswordHash = await hashPassword(newPassword)
      locks[docId] = {
        ...lockInfo,
        passwordHash: newPasswordHash,
        updatedAt: Date.now(),
      }

      return await this.saveAllLocks(locks)
    } catch (error) {
      console.error("修改密码失败:", error)
      return false
    }
  }

  // ==================== 全局密码管理 ====================

  private globalPassword: string | null = null

  async loadGlobalPassword(): Promise<void> {
    try {
      this.globalPassword = await this.storage.load<string>(
        GLOBAL_PASSWORD_KEY,
      )
    } catch (error) {
      console.error("加载全局密码失败:", error)
    }
  }

  async saveGlobalPassword(password: string): Promise<boolean> {
    try {
      const success = await this.storage.save(GLOBAL_PASSWORD_KEY, password)
      if (success) {
        this.globalPassword = password
      }
      return success
    } catch (error) {
      console.error("保存全局密码失败:", error)
      return false
    }
  }

  getGlobalPassword(): string | null {
    return this.globalPassword
  }
}
