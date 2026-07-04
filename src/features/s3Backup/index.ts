/**
 * S3 备份功能模块
 *
 * 提供 S3 兼容存储的工作区文件备份功能。
 * 支持手动/自动备份、备份列表管理、恢复和删除。
 * 使用 AWS Signature V4 签名，兼容 MinIO、Ceph 等 S3 实现。
 *
 * S3Backup 类同时管理自动备份定时器和备份执行，
 * 不依赖 Vue 面板的生命周期，确保自动备份在后台可靠运行。
 */
import type { ModalAppInstance } from "@/utils/vueAppHelper"
import { Plugin } from "siyuan"
import { emitCustomEvent } from "@/utils/eventBus"
import { createModalVueApp } from "@/utils/vueAppHelper"
import { getWorkspaceDir } from "@/api"
import { checkIsMobile } from "../generalSettings/utils/styles"
import { BackupManager } from "./modules/BackupManager"
import { S3Client } from "./types/s3Client"
import S3BackupPanel from "./index.vue"
import { S3BackupStorage } from "./types"
import type { S3Config } from "./types"

let s3BackupInstance: S3Backup | null = null

/** 获取当前 S3Backup 实例（供 Vue 面板查询工作区路径等状态） */
export function getS3BackupInstance(): S3Backup | null {
  return s3BackupInstance
}

export class S3Backup {
  private plugin: Plugin
  private storage: S3BackupStorage
  private modal: ModalAppInstance
  private autoBackupTimer: number | null = null
  private lastBackupTimestamp = 0
  private _openHandler: (() => void) | null = null

  // 自动备份所需的内部状态
  private backupManager: BackupManager | null = null
  private s3Client: S3Client | null = null
  private cachedWorkspacePath = ""
  private cachedWorkspaceRoot = ""
  private keepBackupCount = 7

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

  /** 获取当前工作区 data 路径（供 Vue 面板读取） */
  getWorkspacePath(): string {
    return this.cachedWorkspacePath
  }

  /** 获取持久化存储实例（供 Vue 面板共用，避免重复创建） */
  getStorage(): S3BackupStorage {
    return this.storage
  }

  // ========== 自动备份 ==========

  private async initAutoBackup(): Promise<void> {
    try {
      const data = await this.storage.backupSettings.loadOrDefault()
      this.lastBackupTimestamp = data.lastBackupTimestamp || 0

      const isMobile = checkIsMobile()
      const autoBackupEnabled = data.autoBackupEnabled ?? false
      const backupFrequency = data.backupFrequency ?? "daily"
      const backupTime = data.backupTime ?? "03:00"
      this.keepBackupCount = data.keepBackupCount ?? 7

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
        await this.executeAutoBackup()
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

  /** 执行自动备份（独立于 Vue 面板运行） */
  private async executeAutoBackup(): Promise<void> {
    try {
      if (!this.backupManager) {
        if (!this.cachedWorkspacePath) {
          await this.detectAndInitWorkspace()
        }
        if (this.cachedWorkspacePath) {
          this.backupManager = new BackupManager(this.cachedWorkspacePath, this.cachedWorkspaceRoot)
        }
      }
      if (!this.backupManager) {
        console.warn("自动备份: 工作区路径未设置，跳过")
        return
      }

      // 加载 S3 配置
      if (!this.s3Client) {
        const savedConfig = await this.storage.s3Config.load()
        if (savedConfig) {
          this.s3Client = new S3Client(savedConfig)
        }
      }
      if (!this.s3Client) {
        console.warn("自动备份: S3 未配置，跳过")
        return
      }

      // 本地打包
      const result = await this.backupManager.performFullBackup({})
      const config = await this.storage.s3Config.load()
      const prefix = config?.prefix || "siyuan-backup/"
      const s3Key = `${prefix}${result.fileName}`

      // 上传到 S3
      await this.s3Client.upload(result.filePath, s3Key)

      // 更新备份记录（保留用户现有设置，只更新时间戳和路径）
      this.lastBackupTimestamp = Date.now()
      const lastBackupTime = new Date().toLocaleString()
      const currentSettings = await this.storage.backupSettings.loadOrDefault()
      await this.storage.backupSettings.save({
        ...currentSettings,
        lastBackupTimestamp: this.lastBackupTimestamp,
        lastBackupTime,
        workspacePath: this.cachedWorkspacePath,
        workspaceRoot: this.cachedWorkspaceRoot,
      })

      // 清理本地临时 zip
      try {
        await this.backupManager.deleteBackupFile(result.filePath)
      } catch { /* 清理失败不影响主流程 */ }

      console.info(`自动备份完成: ${result.fileName}`)

      // 按保留数量裁剪旧备份
      await this.pruneOldBackups(prefix)

      // 通知 Vue 面板刷新列表
      emitCustomEvent("s3BackupRefreshList")
    } catch (error) {
      console.error("自动备份失败:", error)
    }
  }

  /** 按 keepBackupCount 裁剪云端旧备份 */
  private async pruneOldBackups(prefix: string): Promise<void> {
    if (!this.s3Client || this.keepBackupCount <= 0) return
    try {
      const files = await this.s3Client.list(prefix)
      if (files.length <= this.keepBackupCount) return
      const sorted = files.sort(
        (a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime(),
      )
      const toDelete = sorted.slice(this.keepBackupCount)
      for (const file of toDelete) {
        await this.s3Client.delete(file.key)
      }
    } catch (error) {
      console.warn("裁剪旧备份失败:", error)
    }
  }

  // ========== 工作区检测 ==========

  private async detectAndInitWorkspace(): Promise<void> {
    // 1. 环境变量
    const envRoot = (window as any).__SIYUAN_WORKSPACE__ || (window as any).SIYUAN_WORKSPACE
    if (envRoot) {
      this.setWorkspacePaths(envRoot)
      return
    }

    // 2. 持久化存储
    try {
      const data = await this.storage.backupSettings.loadOrDefault()
      if (data.workspaceRoot) {
        this.setWorkspacePaths(data.workspaceRoot)
        return
      }
    } catch { /* ignore */ }

    // 3. plugin.dataPath
    try {
      if (this.plugin?.dataPath) {
        this.setWorkspacePaths(this.plugin.dataPath)
        return
      }
    } catch { /* ignore */ }

    // 4. API
    try {
      const dir = await getWorkspaceDir()
      if (dir) {
        this.setWorkspacePaths(dir)
        return
      }
    } catch { /* ignore */ }
  }

  /** 更新工作区路径（供 Vue 面板在用户手动选择路径后同步） */
  setWorkspacePaths(root: string): void {
    this.cachedWorkspaceRoot = root
    this.cachedWorkspacePath = `${root}/data`
    if (this.backupManager) {
      this.backupManager.updateWorkspacePaths(this.cachedWorkspacePath, this.cachedWorkspaceRoot)
    }
  }

  // ========== 自动备份设置管理 ==========

  async loadAutoBackupSettings(): Promise<{
    autoBackupEnabled: boolean
    backupFrequency: string
    backupTime: string
    keepBackupCount: number
    lastBackupTime: string
    lastBackupTimestamp: number
  }> {
    try {
      const data = await this.storage.backupSettings.loadOrDefault()
      return {
        autoBackupEnabled: data.autoBackupEnabled ?? false,
        backupFrequency: data.backupFrequency ?? "daily",
        backupTime: data.backupTime ?? "03:00",
        keepBackupCount: data.keepBackupCount ?? 7,
        lastBackupTime: data.lastBackupTime ?? "",
        lastBackupTimestamp: data.lastBackupTimestamp ?? 0,
      }
    } catch {
      return {
        autoBackupEnabled: false,
        backupFrequency: "daily",
        backupTime: "03:00",
        keepBackupCount: 7,
        lastBackupTime: "",
        lastBackupTimestamp: 0,
      }
    }
  }

  async saveAutoBackupSettings(settings: {
    autoBackupEnabled: boolean
    backupFrequency: string
    backupTime: string
    keepBackupCount: number
    lastBackupTimestamp: number
    lastBackupTime: string
    workspacePath: string
    workspaceRoot: string
  }): Promise<void> {
    await this.storage.backupSettings.save(settings)
    this.keepBackupCount = settings.keepBackupCount
  }

  /** 重启自动备份定时器（Vue 面板设置变更后调用） */
  restartAutoBackupTimer(enabled: boolean, frequency: string, backupTime = "03:00"): void {
    this.stopAutoBackupTimer()
    if (enabled) {
      this.startAutoBackupTimer(frequency, backupTime)
    }
  }

  /** 刷新云端备份列表（自动备份完成后供外部调用） */
  async refreshCloudBackupList(): Promise<void> {
    if (!this.s3Client) {
      const config = await this.storage.s3Config.load()
      if (config) {
        this.s3Client = new S3Client(config)
      }
    }
    if (!this.s3Client) return

    try {
      const config = await this.storage.s3Config.load()
      const prefix = config?.prefix || "siyuan-backup/"
      await this.s3Client.list(prefix)
    } catch (error) {
      console.warn("刷新云端备份列表失败:", error)
    }
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
  ;(plugin as any).__s3Backup = s3BackupInstance
}
