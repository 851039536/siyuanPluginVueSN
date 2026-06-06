/**
 * 数据备份功能模块
 *
 * 管理自动备份定时器、备份数据存储，以及弹窗 UI。
 * 通过 statusBar 功能抽屉触发打开。
 * 弹窗使用隐藏/显示模式，关闭时保留 Vue 实例状态（备份进度等）。
 */
import type { App as VueApp } from "vue"
import { Plugin } from "siyuan"
import {
  createApp,
  h,
} from "vue"
import { emitCustomEvent } from "@/utils/eventBus"
import { checkIsMobile } from "../generalSettings/utils/styles"
import DataBackupPanel from "./index.vue"
import { DataBackupStorage } from "./types"

let dataBackupInstance: DataBackup | null = null

const MASK_ID = "data-backup-mask"
const MASK_STYLE = `
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
`
const CONTAINER_STYLE = `
  width: 720px;
  height: 80vh;
  background: var(--b3-theme-background);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
`

export class DataBackup {
  private plugin: Plugin
  private storage: DataBackupStorage
  private app: VueApp | null = null
  private mask: HTMLElement | null = null
  private container: HTMLElement | null = null
  private autoBackupTimer: number | null = null
  private lastBackupTimestamp = 0
  private _openHandler: (() => void) | null = null

  constructor(plugin: Plugin) {
    this.plugin = plugin
    this.storage = new DataBackupStorage(plugin)
  }

  getStorage(): DataBackupStorage {
    return this.storage
  }

  public async init() {
    await this.initAutoBackup()
    this._openHandler = () => this.open()
    window.addEventListener("openDataBackup", this._openHandler)
  }

  /**
   * 打开弹窗（首次创建，后续仅显示）
   */
  public open() {
    if (this.mask) {
      // 已存在，仅显示
      this.mask.style.display = "flex"
      return
    }

    this.mask = document.createElement("div")
    this.mask.id = MASK_ID
    this.mask.style.cssText = MASK_STYLE

    this.container = document.createElement("div")
    this.container.style.cssText = CONTAINER_STYLE

    this.mask.appendChild(this.container)
    document.body.appendChild(this.mask)

    // 点击遮罩关闭
    this.mask.onclick = (e) => {
      if (e.target === this.mask) {
        this.close()
      }
    }

    const plugin = this.plugin
    const onClose = () => this.close()

    this.app = createApp({
      setup: () => {
        return () => h(DataBackupPanel as any, {
          i18n: plugin.i18n,
          plugin,
          onClose,
        })
      },
    })

    this.app.mount(this.container)
  }

  /**
   * 关闭弹窗（隐藏，保留状态）
   */
  public close = () => {
    if (this.mask) {
      this.mask.style.display = "none"
    }
  }

  public toggle() {
    if (this.mask && this.mask.style.display !== "none") {
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
    if (this.app) {
      this.app.unmount()
      this.app = null
    }
    if (this.mask) {
      this.mask.remove()
      this.mask = null
      this.container = null
    }
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
