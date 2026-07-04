/**
 * S3 备份功能模块
 *
 * 提供 S3 兼容存储的工作区文件备份功能。
 * 支持手动/自动备份、备份列表管理、恢复和删除。
 * 使用 AWS Signature V4 签名，兼容 MinIO、Ceph 等 S3 实现。
 */
import type { ModalAppInstance } from "@/utils/vueAppHelper"
import { Plugin } from "siyuan"
import { emitCustomEvent } from "@/utils/eventBus"
import { createModalVueApp } from "@/utils/vueAppHelper"
import { checkIsMobile } from "../generalSettings/utils/styles"
import S3BackupPanel from "./index.vue"
import { S3BackupStorage } from "./types"

let s3BackupInstance: S3Backup | null = null

export class S3Backup {
  private plugin: Plugin
  private storage: S3BackupStorage
  private modal: ModalAppInstance
  private autoBackupTimer: number | null = null
  private lastBackupTimestamp = 0
  private _openHandler: (() => void) | null = null

  constructor(plugin: Plugin) {
    this.plugin = plugin
    this.storage = new S3BackupStorage(plugin)

    this.modal = createModalVueApp(S3BackupPanel, {
      maskId: "s3-backup-mask",
      width: "720px",
      height: "80vh",
      persistent: true,
      getCloseHandler: () => this.close,
      buildProps: () => ({
        onClose: this.close,
        i18n: this.plugin.i18n,
        plugin: this.plugin,
      }),
    })
  }

  async init(): Promise<void> {
    await this.initAutoBackup()
    this._openHandler = () => this.open()
    window.addEventListener("openS3Backup", this._openHandler)

    // 触发 Vue 组件 mount 以注册事件监听器
    this.modal.open()
    this.modal.close()
  }

  open(): void {
    this.modal.open()
  }

  close = (): void => {
    this.modal.close()
  }

  private async initAutoBackup(): Promise<void> {
    try {
      const data = await this.storage.backupSettings.loadOrDefault()
      this.lastBackupTimestamp = data.lastBackupTimestamp || 0

      const isMobile = checkIsMobile()
      const autoBackupEnabled = data.autoBackupEnabled ?? false
      const backupFrequency = data.backupFrequency ?? "daily"
      const backupTime = data.backupTime ?? "03:00"

      if (!isMobile && autoBackupEnabled) {
        this.startAutoBackupTimer(backupFrequency, backupTime)
      }
    } catch (error) {
      console.error("初始化 S3 自动备份失败:", error)
    }
  }

  private startAutoBackupTimer(backupFrequency: string, backupTime: string): void {
    this.stopAutoBackupTimer()

    const timerStartTime = Date.now()
    let lastExecutedHour = -1
    let lastExecutedDateStr = ""

    const checkAndBackup = async (): Promise<void> => {
      const now = new Date()
      const currentTime = now.getTime()
      const currentHour = now.getHours()
      const currentMinute = now.getMinutes()
      const currentDateStr = now.toDateString()
      const timeSinceTimerStart = currentTime - timerStartTime
      const timeSinceLastBackup = currentTime - this.lastBackupTimestamp

      let shouldBackup = false

      switch (backupFrequency) {
        case "minute":
          if (timeSinceLastBackup >= 60 * 1000 && timeSinceTimerStart >= 60 * 1000) {
            shouldBackup = true
          }
          break

        case "hourly":
          if (
            currentMinute === 0
            && lastExecutedHour !== currentHour
            && timeSinceTimerStart >= 60 * 1000
            && timeSinceLastBackup >= 60 * 60 * 1000
          ) {
            shouldBackup = true
            lastExecutedHour = currentHour
          }
          break

        case "daily": {
          const [targetHour, targetMinute] = backupTime.split(":").map(Number)
          if (
            currentHour === targetHour
            && currentMinute === targetMinute
            && lastExecutedDateStr !== currentDateStr
            && timeSinceTimerStart >= 60 * 1000
          ) {
            shouldBackup = true
            lastExecutedDateStr = currentDateStr
          }
          break
        }
      }

      if (shouldBackup) {
        emitCustomEvent("autoS3BackupTrigger")
      }
    }

    this.autoBackupTimer = window.setInterval(checkAndBackup, 60000)
  }

  private stopAutoBackupTimer(): void {
    if (this.autoBackupTimer) {
      clearInterval(this.autoBackupTimer)
      this.autoBackupTimer = null
    }
  }

  updateLastBackupTime(timestamp: number): void {
    this.lastBackupTimestamp = timestamp
  }

  restartAutoBackupTimer(enabled: boolean, frequency: string, backupTime = "03:00"): void {
    this.stopAutoBackupTimer()
    if (enabled) {
      this.startAutoBackupTimer(frequency, backupTime)
    }
  }

  destroy(): void {
    this.stopAutoBackupTimer()
    if (this._openHandler) {
      window.removeEventListener("openS3Backup", this._openHandler)
      this._openHandler = null
    }
    this.modal.destroy()
  }
}

/**
 * 注册 S3 备份功能
 */
export function registerS3Backup(plugin: Plugin): void {
  s3BackupInstance = new S3Backup(plugin)
  s3BackupInstance.init()
  ;(plugin as any).__s3Backup = s3BackupInstance
}
