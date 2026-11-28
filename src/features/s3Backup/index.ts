import type {
  BackupFrequency,
  BackupSettings,
} from "./types"
import type { TimerHandle } from "@/utils/timerRegistry"
/**
 * S3 备份功能模块
 *
 * 提供统一的备份功能：本地 ZIP 压缩备份 + S3 兼容存储上传。
 * 支持手动备份、自动备份定时器、备份列表管理（本地 + 云端）。
 * S3Backup 类管理 persistent Modal、自动备份调度与备份时间戳（运行时唯一事实源）；
 * 模块级单例引用由 instance.ts 持有（避免与面板组件循环依赖）。
 */
import type { ModalAppInstance } from "@/utils/vueAppHelper"
import { Plugin } from "siyuan"
import { emitCustomEvent } from "@/utils/eventBus"
import {

  TimerRegistry,
} from "@/utils/timerRegistry"
import { createModalVueApp } from "@/utils/vueAppHelper"
import S3BackupPanel from "./index.vue"
import {
  getS3BackupInstance,
  setS3BackupInstance,
} from "./instance"
import {
  AUTO_BACKUP_TRIGGER_EVENT,
  DEFAULT_BACKUP_SETTINGS,
  S3BackupStorage,
} from "./types"

/** 自动备份定时器的检查间隔（每分钟 tick 一次） */
const AUTO_BACKUP_TICK_MS = 60 * 1000

export class S3Backup {
  private plugin: Plugin
  private storage: S3BackupStorage
  private modal: ModalAppInstance
  private _openHandler: (() => void) | null = null
  private readonly timers = new TimerRegistry()
  private autoBackupTimer: TimerHandle | null = null
  /** 上次备份时间戳（运行时唯一事实源；持久化值经 initAutoBackup 回填，完成后经 updateLastBackupTime 更新） */
  private lastBackupTimestamp = 0
  /** 防重执行状态（实例字段，重启定时器时不会被闭包重置丢失） */
  private lastExecutedHour = -1
  private lastExecutedDateStr = ""
  /** 设置保存串行链：面板多个 @update 连发时防止 load-merge-save 交错覆盖 */
  private saveChain: Promise<void> = Promise.resolve()

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
      }),
    })
  }

  async init(): Promise<void> {
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

  /** 获取持久化存储实例（供 Vue 面板共用，避免重复创建） */
  getStorage(): S3BackupStorage {
    return this.storage
  }

  // ========== 自动备份定时器 ==========

  private async initAutoBackup(): Promise<void> {
    try {
      const data = await this.storage.backupSettings.loadOrDefault()
      this.lastBackupTimestamp = data.lastBackupTimestamp || 0

      // loadOrDefault 已与 DEFAULT_BACKUP_SETTINGS 浅合并，字段保证完整
      if (data.autoBackupEnabled) {
        this.startAutoBackupTimer(data.backupFrequency, data.backupTime)
      }
    } catch (error) {
      console.error("[S3备份] 初始化自动备份失败:", error)
    }
  }

  public startAutoBackupTimer(backupFrequency: BackupFrequency, backupTime: string): void {
    this.stopAutoBackupTimer()

    this.lastExecutedHour = -1
    this.lastExecutedDateStr = ""
    this.backfillExecutionMarks(backupFrequency)

    const timerStartTime = Date.now()
    this.autoBackupTimer = this.timers.setInterval(() => {
      if (this.shouldTriggerBackup(backupFrequency, backupTime, timerStartTime, new Date())) {
        emitCustomEvent(AUTO_BACKUP_TRIGGER_EVENT)
      }
    }, AUTO_BACKUP_TICK_MS)
  }

  /** 用持久化的 lastBackupTimestamp 回填防重标记，防止程序重启后 daily/hourly 模式误触发 */
  private backfillExecutionMarks(backupFrequency: BackupFrequency): void {
    if (this.lastBackupTimestamp <= 0) {
      return
    }
    const lastBackupDate = new Date(this.lastBackupTimestamp)
    const todayStr = new Date().toDateString()
    if (lastBackupDate.toDateString() !== todayStr) {
      return
    }
    this.lastExecutedDateStr = todayStr
    if (backupFrequency === "hourly") {
      this.lastExecutedHour = lastBackupDate.getHours()
    }
  }

  /** 解析 "HH:mm" 格式的备份时间；格式异常返回 null，避免 NaN 使 daily 模式永不触发 */
  private parseBackupTime(backupTime: string): { hour: number, minute: number } | null {
    const parts = backupTime.split(":")
    if (parts.length < 2 || parts.some((p) => Number.isNaN(Number(p)))) {
      console.warn(`[S3备份] backupTime 格式异常: "${backupTime}"，跳过本次检查`)
      return null
    }
    return {
      hour: Number(parts[0]),
      minute: Number(parts[1]),
    }
  }

  /**
   * 判定本 tick 是否应触发自动备份；命中时同步写入防重标记（下次 tick 不再重复触发）。
   * 所有频率都要求定时器已运行 ≥ 1 分钟，避免程序启动瞬间立即误触发。
   */
  private shouldTriggerBackup(
    backupFrequency: BackupFrequency,
    backupTime: string,
    timerStartTime: number,
    now: Date,
  ): boolean {
    const timeSinceTimerStart = now.getTime() - timerStartTime
    const timeSinceLastBackup = now.getTime() - this.lastBackupTimestamp
    const timerReady = timeSinceTimerStart >= 60 * 1000

    switch (backupFrequency) {
      case "minute":
        return timerReady && timeSinceLastBackup >= 60 * 1000

      case "hourly": {
        // 用 lastExecutedHour 防重：setInterval 精度有限，精确匹配整点会因 tick 偏移而错过
        const currentHour = now.getHours()
        if (this.lastExecutedHour === currentHour || !timerReady || timeSinceLastBackup < 60 * 60 * 1000) {
          return false
        }
        this.lastExecutedHour = currentHour
        return true
      }

      case "daily": {
        const target = this.parseBackupTime(backupTime)
        if (!target) {
          return false
        }
        // 宽松窗口避免 setInterval 偏移错过目标时间；今天已执行过则不再触发
        const currentTotal = now.getHours() * 60 + now.getMinutes()
        const targetTotal = target.hour * 60 + target.minute
        if (
          currentTotal < targetTotal
          || !timerReady
          || this.lastExecutedDateStr === now.toDateString()
          || timeSinceLastBackup < 60 * 1000
        ) {
          return false
        }
        this.lastExecutedDateStr = now.toDateString()
        return true
      }
    }
    return false
  }

  public stopAutoBackupTimer(): void {
    this.timers.clear(this.autoBackupTimer)
    this.autoBackupTimer = null
  }

  public updateLastBackupTime(timestamp: number): void {
    this.lastBackupTimestamp = timestamp
    // 备份完成后立即恢复防重标记，避免长时间任务期间 busy 分支反复 resetExecutionMarks
    // 导致每天/每小时任务在完成后被下一分钟重复触发。
    const backupDate = new Date(timestamp)
    if (backupDate.toDateString() === new Date().toDateString()) {
      this.lastExecutedDateStr = backupDate.toDateString()
      this.lastExecutedHour = backupDate.getHours()
    }
  }

  /**
   * 回滚防重标记：自动备份触发被吞（忙时跳过/执行失败）时由面板调用，
   * 使下一个 tick 可重试；重试频率由 timeSinceLastBackup 守卫限幅，不会风暴
   */
  public resetExecutionMarks(): void {
    this.lastExecutedHour = -1
    this.lastExecutedDateStr = ""
  }

  public restartAutoBackupTimer(enabled: boolean, frequency: BackupFrequency, backupTime: string): void {
    this.stopAutoBackupTimer()
    if (enabled) {
      this.startAutoBackupTimer(frequency, backupTime)
    }
  }

  // ========== 工作区设置持久化 ==========

  /** 加载备份设置（loadOrDefault 已与 DEFAULT_BACKUP_SETTINGS 浅合并，字段保证完整） */
  async loadWorkspaceSettings(): Promise<BackupSettings> {
    try {
      return await this.storage.backupSettings.loadOrDefault()
    } catch {
      return {
        ...DEFAULT_BACKUP_SETTINGS,
        backupMode: { ...DEFAULT_BACKUP_SETTINGS.backupMode },
      }
    }
  }

  async saveWorkspaceSettings(settings: Partial<BackupSettings>): Promise<void> {
    // 串行执行 load-merge-save：并发调用交错读写会用过期快照覆盖刚写入的字段
    const task = this.saveChain.then(async () => {
      const existing = await this.storage.backupSettings.loadOrDefault()
      await this.storage.backupSettings.save({
        ...existing,
        ...settings,
      })
    })
    // 链上吞错防断链，错误仍通过 task 抛给当前调用方
    this.saveChain = task.catch(() => {})
    return task
  }

  /** 获取上次备份时间戳（运行时单一事实源，供设置持久化读取） */
  getLastBackupTimestamp(): number {
    return this.lastBackupTimestamp
  }

  // ========== 生命周期 ==========

  destroy(): void {
    this.stopAutoBackupTimer()
    // 注册表全量兜底清理，防止未来新增定时器后遗漏单独 stop 逻辑
    this.timers.clearAll()
    if (this._openHandler) {
      window.removeEventListener("openS3Backup", this._openHandler)
      this._openHandler = null
    }
    this.modal.destroy()
    // 释放模块级单例引用，避免卸载后 Vue 面板拿到失效实例
    setS3BackupInstance(null)
  }
}

/**
 * 注册 S3 备份功能
 */
export function registerS3Backup(plugin: Plugin): void {
  // 重复注册防护：先销毁旧实例，避免定时器/监听器/persistent Modal 泄漏
  getS3BackupInstance()?.destroy()
  const instance = new S3Backup(plugin)
  setS3BackupInstance(instance)
  // 挂到 plugin 实例供 onunload() 销毁钩子调用（缺失会导致定时器与事件监听器泄漏）
  ;(plugin as any).__s3Backup = instance
  instance.init().catch((err) => {
    console.error("[S3备份] 初始化失败:", err)
  })
}
