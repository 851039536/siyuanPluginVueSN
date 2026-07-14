/**
 * S3 备份功能模块
 *
 * 提供统一的备份功能：本地 ZIP 压缩备份 + S3 兼容存储上传。
 * 支持手动备份、自动备份定时器、备份列表管理（本地 + 云端）。
 * S3Backup 类管理 persistent Modal、工作区路径、自动备份调度。
 */
import type { ModalAppInstance } from "@/utils/vueAppHelper"
import { Plugin } from "siyuan"
import { emitCustomEvent } from "@/utils/eventBus"
import { createModalVueApp } from "@/utils/vueAppHelper"
import { getWorkspaceDir } from "@/api"
import S3BackupPanel from "./index.vue"
import { S3BackupStorage } from "./types"
import type { BackupSettings } from "./types"

let s3BackupInstance: S3Backup | null = null

/** 获取当前 S3Backup 实例（供 Vue 面板查询工作区路径等状态） */
export function getS3BackupInstance(): S3Backup | null {
  return s3BackupInstance
}

export class S3Backup {
  private plugin: Plugin
  private storage: S3BackupStorage
  private modal: ModalAppInstance
  private _openHandler: (() => void) | null = null
  private autoBackupTimer: number | null = null
  private lastBackupTimestamp = 0
  /** A6 修复：防重复执行状态提升为实例字段，避免重启定时器时丢失 */
  private lastExecutedHour = -1
  private lastExecutedDateStr = ""

  private cachedWorkspaceRoot = ""

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
    await this.detectAndInitWorkspace()
    await this.initAutoBackup()

    this._openHandler = () => this.open()
    window.addEventListener("openS3Backup", this._openHandler)

    // 触发 Vue 组件 mount 以注册 autoBackupTrigger 事件监听器
    this.modal.open()
    this.modal.close()
  }

  open(): void {
    this.modal.open()
  }

  close = (): void => {
    this.modal.close()
  }

  /** 获取当前工作区根目录（供 Vue 面板读取） */
  getWorkspaceRoot(): string {
    return this.cachedWorkspaceRoot
  }

  /** 获取持久化存储实例（供 Vue 面板共用，避免重复创建） */
  getStorage(): S3BackupStorage {
    return this.storage
  }

  // ========== 自动备份定时器 ==========

  private async initAutoBackup() {
    try {
      const data = await this.storage.backupSettings.loadOrDefault()
      this.lastBackupTimestamp = data.lastBackupTimestamp || 0

      const autoBackupEnabled = data.autoBackupEnabled ?? false
      const backupFrequency = data.backupFrequency ?? "daily"
      const backupTime = data.backupTime ?? "03:00"

      if (autoBackupEnabled) {
        this.startAutoBackupTimer(backupFrequency, backupTime)
      }
    } catch (error) {
      console.error("初始化自动备份失败:", error)
    }
  }

  public startAutoBackupTimer(backupFrequency: string, backupTime: string) {
    this.stopAutoBackupTimer()

    // A6 修复：重置实例字段而非闭包局部变量
    this.lastExecutedHour = -1
    this.lastExecutedDateStr = ""

    // B17 修复：基于持久化的 lastBackupTimestamp 回填防重复标记
    // 防止程序重启后因 lastExecutedDateStr="" 导致 daily/hourly 模式误触发
    if (this.lastBackupTimestamp > 0) {
      const lastBackupDate = new Date(this.lastBackupTimestamp)
      const todayStr = new Date().toDateString()
      if (lastBackupDate.toDateString() === todayStr) {
        this.lastExecutedDateStr = todayStr
        if (backupFrequency === "hourly") {
          this.lastExecutedHour = lastBackupDate.getHours()
        }
      }
    }

    const timerStartTime = Date.now()

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
          // B12 修复：移除 currentMinute === 0 精确匹配，改用 lastExecutedHour 防重复
          // setInterval(60000) 精度有限，tick 偏移到 :01 就会错过整小时
          if (
            this.lastExecutedHour !== currentHour
            && timeSinceTimerStart >= 60 * 1000
            && timeSinceLastBackup >= 60 * 60 * 1000
          ) {
            shouldBackup = true
            this.lastExecutedHour = currentHour
          }
          break

        case "daily": {
          const parts = backupTime.split(":")
          // B19 修复：校验 backupTime 格式，防止异常输入产生 NaN 导致 daily 模式永不触发
          if (parts.length < 2 || parts.some((p) => Number.isNaN(Number(p)))) {
            console.warn(`[S3备份] backupTime 格式异常: "${backupTime}"，跳过本次检查`)
            break
          }
          const targetHour = Number(parts[0])
          const targetMinute = Number(parts[1])
          // A5 修复：用宽松窗口替代精确分钟匹配，避免因 setInterval 偏移错过备份
          // B18 修复：增加 timeSinceTimerStart 守卫，防止程序重启时第一 tick 立即误触发
          // 条件：当前时间已过目标时间、定时器已运行 ≥ 60s、今天尚未执行、距离上次备份 ≥ 1 分钟
          const targetTotal = targetHour * 60 + targetMinute
          const currentTotal = currentHour * 60 + currentMinute
          if (
            currentTotal >= targetTotal
            && timeSinceTimerStart >= 60 * 1000
            && this.lastExecutedDateStr !== currentDateStr
            && timeSinceLastBackup >= 60 * 1000
          ) {
            shouldBackup = true
            this.lastExecutedDateStr = currentDateStr
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

  public stopAutoBackupTimer() {
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

  // ========== 工作区设置持久化 ==========

  async loadWorkspaceSettings(): Promise<{
    lastBackupTime: string
    useDateFolder: boolean
    autoBackupEnabled: boolean
    backupFrequency: string
    backupTime: string
    keepBackupCount: number
    lastBackupTimestamp: number
    localBackupDir: string
    s3SubPrefix: string
  }> {
    try {
      const data = await this.storage.backupSettings.loadOrDefault()
      return {
        lastBackupTime: data.lastBackupTime ?? "",
        useDateFolder: data.useDateFolder ?? true,
        autoBackupEnabled: data.autoBackupEnabled ?? false,
        backupFrequency: data.backupFrequency ?? "daily",
        backupTime: data.backupTime ?? "03:00",
        keepBackupCount: data.keepBackupCount ?? 7,
        lastBackupTimestamp: data.lastBackupTimestamp ?? 0,
        localBackupDir: data.localBackupDir ?? "data-backup",
        s3SubPrefix: data.s3SubPrefix ?? "data-backup",
      }
    } catch {
      return { lastBackupTime: "", useDateFolder: true, autoBackupEnabled: false, backupFrequency: "daily", backupTime: "03:00", keepBackupCount: 7, lastBackupTimestamp: 0, localBackupDir: "data-backup", s3SubPrefix: "data-backup" }
    }
  }

  async saveWorkspaceSettings(settings: {
    lastBackupTime: string
    workspacePath: string
    workspaceRoot: string
    useDateFolder?: boolean
    autoBackupEnabled?: boolean
    backupFrequency?: string
    backupTime?: string
    keepBackupCount?: number
    backupMode?: { localZip: boolean; s3Upload: boolean }
    lastBackupTimestamp?: number
    localBackupDir?: string
    s3SubPrefix?: string
  }): Promise<void> {
    const existing = await this.storage.backupSettings.loadOrDefault()
    await this.storage.backupSettings.save({ ...existing, ...settings } as BackupSettings)
  }

  // ========== 工作区检测 ==========

  private async detectAndInitWorkspace(): Promise<void> {
    // 1. 环境变量（最高优先级）
    const envRoot = (window as any).__SIYUAN_WORKSPACE__ || (window as any).SIYUAN_WORKSPACE
    if (envRoot) {
      this.setWorkspacePaths(envRoot)
      return
    }

    // 2. API 自动获取（最可靠的方式）
    try {
      const dir = await getWorkspaceDir()
      if (dir) {
        this.setWorkspacePaths(dir)
        return
      }
    } catch { /* ignore */ }

    // 3. 持久化存储（兜底）
    try {
      const data = await this.storage.backupSettings.loadOrDefault()
      if (data.workspaceRoot) {
        this.setWorkspacePaths(data.workspaceRoot)
        return
      }
    } catch { /* ignore */ }
  }

  setWorkspacePaths(root: string): void {
    this.cachedWorkspaceRoot = root
  }

  // ========== 生命周期 ==========

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
  s3BackupInstance.init().catch((err) => {
    console.error("S3 备份初始化失败:", err)
  })
}
