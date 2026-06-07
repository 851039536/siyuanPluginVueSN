/**
 * 数据备份功能模块
 *
 * 管理自动备份定时器、备份数据存储，以及弹窗 UI。
 * 通过 statusBar 功能抽屉触发打开。
 * 弹窗使用 persistent 模式，关闭时保留 Vue 实例状态（备份进度等）。
 */
import type { ModalAppInstance } from "@/utils/vueAppHelper"
import { Plugin } from "siyuan"
import { emitCustomEvent } from "@/utils/eventBus"
import { createModalVueApp } from "@/utils/vueAppHelper"
import { checkIsMobile } from "../generalSettings/utils/styles"
import DataBackupPanel from "./index.vue"
import { DataBackupStorage } from "./types"

let dataBackupInstance: DataBackup | null = null

export class DataBackup {
  private plugin: Plugin
  private storage: DataBackupStorage
  private modal: ModalAppInstance
  private autoBackupTimer: number | null = null
  private lastBackupTimestamp = 0
  private _openHandler: (() => void) | null = null

  constructor(plugin: Plugin) {
    this.plugin = plugin
    this.storage = new DataBackupStorage(plugin)

    this.modal = createModalVueApp(DataBackupPanel, {
      maskId: "data-backup-mask",
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

  getStorage(): DataBackupStorage {
    return this.storage
  }

  public async init() {
    await this.initAutoBackup()
    this._openHandler = () => this.open()
    window.addEventListener("openDataBackup", this._openHandler)

    // 触发 Vue 组件 mount 以注册 autoBackupTrigger 事件监听器
    // persistent 模式下 open 创建实例，close 仅隐藏 DOM，状态常驻
    this.modal.open()
    this.modal.close()
  }

  public open() {
    this.modal.open()
  }

  public close = () => {
    this.modal.close()
  }

  public toggle() {
    if (this.modal.visible) {
      this.close()
    } else {
      this.open()
    }
  }

  private async initAutoBackup() {
    try {
      const data = await this.storage.backup.loadOrDefault()
      this.lastBackupTimestamp = data.lastBackupTimestamp || 0

      const isMobile = checkIsMobile()
      const autoBackupEnabled = data.autoBackupEnabled ?? false
      const backupFrequency = data.backupFrequency ?? "daily"
      const backupTime = data.backupTime ?? "03:00"

      if (!isMobile && autoBackupEnabled) {
        this.startAutoBackupTimer(backupFrequency, backupTime)
      }
    } catch (error) {
      console.error("初始化自动备份失败:", error)
    }
  }

  private startAutoBackupTimer(backupFrequency: string, backupTime: string) {
    this.stopAutoBackupTimer()

    const timerStartTime = Date.now()
    let lastExecutedHour = -1
    let lastExecutedDateStr = ""

    const checkAndBackup = async () => {
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
        emitCustomEvent("autoBackupTrigger")
      }
    }

    this.autoBackupTimer = window.setInterval(checkAndBackup, 60000)
  }

  private stopAutoBackupTimer() {
    if (this.autoBackupTimer) {
      clearInterval(this.autoBackupTimer)
      this.autoBackupTimer = null
    }
  }

  public updateLastBackupTime(timestamp: number) {
    this.lastBackupTimestamp = timestamp
  }

  public restartAutoBackupTimer(enabled: boolean, frequency: string, backupTime: string = "03:00") {
    this.stopAutoBackupTimer()
    if (enabled) {
      this.startAutoBackupTimer(frequency, backupTime)
    }
  }

  public destroy() {
    this.stopAutoBackupTimer()
    if (this._openHandler) {
      window.removeEventListener("openDataBackup", this._openHandler)
      this._openHandler = null
    }
    this.modal.destroy()
  }
}

/**
 * 注册数据备份功能
 */
export function registerDataBackup(plugin: Plugin) {
  dataBackupInstance = new DataBackup(plugin)
  dataBackupInstance.init()
  ;(plugin as any).__dataBackup = dataBackupInstance
}

/**
 * 获取数据备份实例
 */
export function getDataBackupInstance(): DataBackup | null {
  return dataBackupInstance
}
