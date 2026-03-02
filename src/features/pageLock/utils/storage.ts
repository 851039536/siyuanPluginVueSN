import type { Plugin } from 'siyuan'
import { hashPassword, verifyPassword } from './crypto'
import type { PageLockInfo } from '../types'

export class PageLockStorage {
  private plugin: Plugin
  private readonly STORAGE_KEY = 'page-lock-data'

  constructor(plugin: Plugin) {
    this.plugin = plugin
  }

  async init() {
    const data = await this.plugin.loadData(this.STORAGE_KEY)
    if (!data) {
      await this.plugin.saveData(this.STORAGE_KEY, {})
    }
  }

  private async getAllLocks(): Promise<Record<string, PageLockInfo>> {
    const data = await this.plugin.loadData(this.STORAGE_KEY)
    return data || {}
  }

  private async saveAllLocks(locks: Record<string, PageLockInfo>) {
    await this.plugin.saveData(this.STORAGE_KEY, locks)
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
        updatedAt: Date.now()
      }

      await this.saveAllLocks(locks)
      return true
    } catch (error) {
      console.error('锁定页面失败:', error)
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
        await this.saveAllLocks(locks)
        return true
      }

      return false
    } catch (error) {
      console.error('解锁页面失败:', error)
      return false
    }
  }

  async isPageLocked(docId: string): Promise<boolean> {
    const locks = await this.getAllLocks()
    return !!locks[docId]?.locked
  }

  async verifyPagePassword(docId: string, password: string): Promise<boolean> {
    try {
      const locks = await this.getAllLocks()
      const lockInfo = locks[docId]

      if (!lockInfo) {
        return false
      }

      return await verifyPassword(password, lockInfo.passwordHash)
    } catch (error) {
      console.error('验证密码失败:', error)
      return false
    }
  }

  async getLockInfo(docId: string): Promise<PageLockInfo | null> {
    const locks = await this.getAllLocks()
    return locks[docId] || null
  }

  async changePassword(docId: string, oldPassword: string, newPassword: string): Promise<boolean> {
    try {
      const locks = await this.getAllLocks()
      const lockInfo = locks[docId]

      if (!lockInfo) {
        return false
      }

      const isValid = await verifyPassword(oldPassword, lockInfo.passwordHash)
      if (!isValid) {
        return false
      }

      const newPasswordHash = await hashPassword(newPassword)
      locks[docId] = {
        ...lockInfo,
        passwordHash: newPasswordHash,
        updatedAt: Date.now()
      }

      await this.saveAllLocks(locks)
      return true
    } catch (error) {
      console.error('修改密码失败:', error)
      return false
    }
  }
}
