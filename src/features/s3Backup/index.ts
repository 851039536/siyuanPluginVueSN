/**
 * S3 备份功能模块
 *
 * 提供 S3 兼容存储的手动工作区备份功能。
 * 支持手动备份、备份列表管理、恢复和删除。
 * S3Backup 类管理持久化 Modal 和工作区路径，不涉及自动备份。
 */
import type { ModalAppInstance } from "@/utils/vueAppHelper"
import { Plugin } from "siyuan"
import { createModalVueApp } from "@/utils/vueAppHelper"
import { getWorkspaceDir } from "@/api"
import S3BackupPanel from "./index.vue"
import { S3BackupStorage } from "./types"

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

  private cachedWorkspacePath = ""
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

  // ========== 工作区设置持久化 ==========

  async loadWorkspaceSettings(): Promise<{
    lastBackupTime: string
  }> {
    try {
      const data = await this.storage.backupSettings.loadOrDefault()
      return {
        lastBackupTime: data.lastBackupTime ?? "",
      }
    } catch {
      return { lastBackupTime: "" }
    }
  }

  async saveWorkspaceSettings(settings: {
    lastBackupTime: string
    workspacePath: string
    workspaceRoot: string
  }): Promise<void> {
    await this.storage.backupSettings.save(settings)
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
      const dataPath = (this.plugin as any)?.dataPath as string | undefined
      if (dataPath) {
        this.setWorkspacePaths(dataPath)
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
    this.cachedWorkspacePath = root
  }

  // ========== 生命周期 ==========

  destroy(): void {
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
