/**
 * 页面锁定数据存储管理
 */
import { Plugin } from 'siyuan'
import { sql } from '@/api'
import { hashPassword, verifyPassword } from './crypto'

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

/**
 * 页面锁定存储管理器
 */
export class PageLockStorage {
  private plugin: Plugin
  private readonly STORAGE_KEY = 'page-lock-data'

  constructor(plugin: Plugin) {
    this.plugin = plugin
  }

  /**
   * 初始化存储（从插件存储加载数据）
   */
  async init() {
    const data = await this.plugin.loadData(this.STORAGE_KEY)
    if (!data) {
      await this.plugin.saveData(this.STORAGE_KEY, {})
    }
  }

  /**
   * 获取所有锁定页面数据
   */
  private async getAllLocks(): Promise<Record<string, PageLockInfo>> {
    const data = await this.plugin.loadData(this.STORAGE_KEY)
    return data || {}
  }

  /**
   * 保存所有锁定页面数据
   */
  private async saveAllLocks(locks: Record<string, PageLockInfo>) {
    await this.plugin.saveData(this.STORAGE_KEY, locks)
  }

  /**
   * 锁定页面
   */
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

  /**
   * 解锁页面
   */
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

  /**
   * 检查页面是否已锁定
   */
  async isPageLocked(docId: string): Promise<boolean> {
    const locks = await this.getAllLocks()
    return !!locks[docId]?.locked
  }

  /**
   * 验证页面密码
   */
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

  /**
   * 获取锁定信息
   */
  async getLockInfo(docId: string): Promise<PageLockInfo | null> {
    const locks = await this.getAllLocks()
    return locks[docId] || null
  }

  /**
   * 修改页面密码
   */
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
