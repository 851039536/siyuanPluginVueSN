/**
 * 数据管理 - Manager 类
 *
 * 持有插件实例与短期用量缓存；所有用例委托给 `modules/` 下的纯 IO 实现。
 * 导入/还原前强制全量快照，失败即中止。
 */
import type { Plugin } from "siyuan"
import type { StorageOwner } from "@/config/storage"
import type {
  BackupResult,
  PluginBackupListItem,
} from "@/utils/settingsBackup"
import {
  createFullBackup as createFullBackupOp,
  deleteBackup as deleteBackupOp,
  listBackups as listBackupsOp,
  loadBackupZip,
} from "../modules/backup"
import { createStorageContext, type StorageContext } from "../modules/context"
import { buildInventory } from "../modules/inventory"
import {
  applyPayload,
  blobFromPayload,
  buildModulePayload,
  parseModulePayload,
} from "../modules/moduleTransfer"
import { resetSlot as resetSlotOp } from "../modules/reset"
import type {
  ImportReport,
  SlotActionResult,
  StorageInventory,
} from "./model"

export * from "./model"

const INVENTORY_TTL_MS = 30_000

function emptyReport(error?: string): ImportReport {
  return {
    applied: [],
    skipped: [],
    failed: error ? [{ slotId: "*", error }] : [],
    requiresReload: false,
  }
}

export class StorageManager {
  private ctx: StorageContext | null = null
  private cache: { at: number, inventory: StorageInventory } | null = null
  private destroyed = false

  constructor(private readonly plugin: Plugin) {}

  private async context(): Promise<StorageContext> {
    if (this.destroyed) throw new Error("destroyed")
    if (!this.ctx) {
      const ctx = await createStorageContext(this.plugin)
      if (!ctx) throw new Error("dataDirUnavailable")
      this.ctx = ctx
    }
    return this.ctx
  }

  /** 存储总览（默认 30s 缓存，force=true 强制重算） */
  async getInventory(force = false): Promise<StorageInventory> {
    const ctx = await this.context()
    if (!force && this.cache && Date.now() - this.cache.at < INVENTORY_TTL_MS) {
      return this.cache.inventory
    }
    const inventory = await buildInventory(ctx)
    this.cache = { at: Date.now(), inventory }
    return inventory
  }

  /** 按模块导出 JSON */
  async exportModule(
    owners: StorageOwner[],
    options: { includeSensitive?: boolean } = {},
  ): Promise<Blob> {
    const ctx = await this.context()
    return blobFromPayload(await buildModulePayload(ctx, owners, options))
  }

  /** 按模块导入 JSON（先校验格式，再自动全量快照，最后写回） */
  async importModule(file: File): Promise<ImportReport> {
    const ctx = await this.context()
    let text: string
    try {
      text = await file.text()
    } catch {
      return emptyReport("invalidJson")
    }

    const parsed = parseModulePayload(text)
    if ("error" in parsed) {
      return emptyReport(parsed.error)
    }

    let backup: BackupResult
    try {
      backup = await createFullBackupOp(ctx)
    } catch {
      return emptyReport("backupFailed")
    }

    const report = await applyPayload(ctx, parsed.payload)
    report.snapshotPath = backup.filePath
    this.cache = null
    return report
  }

  /** 创建全量备份 */
  async createFullBackup(): Promise<BackupResult> {
    return createFullBackupOp(await this.context())
  }

  /** 列出全量备份 */
  async listBackups(): Promise<PluginBackupListItem[]> {
    return listBackupsOp()
  }

  /** 删除全量备份 */
  async deleteBackup(fileName: string): Promise<boolean> {
    return deleteBackupOp(fileName)
  }

  /** 从 zip 逻辑还原（先解析校验，再自动全量快照，最后写回） */
  async restoreFromZip(file: File): Promise<ImportReport> {
    const ctx = await this.context()
    const { payload, report, fileSource } = await loadBackupZip(ctx, file)
    if (!payload) return report

    let backup: BackupResult
    try {
      backup = await createFullBackupOp(ctx)
    } catch {
      return emptyReport("backupFailed")
    }

    const merged = await applyPayload(ctx, payload, report)
    if (fileSource) {
      try {
        const restoredFiles = await fileSource.write(ctx)
        if (restoredFiles > 0) merged.applied.push("gitPush.index")
      } catch (error) {
        // 文件槽写失败不回滚已写回的 JSON/SQLite，但必须在报告里显式失败
        merged.failed.push({
          slotId: "gitPush.index",
          error: error instanceof Error ? error.message : "removeFailed",
        })
      }
    }
    merged.snapshotPath = backup.filePath
    this.cache = null
    return merged
  }

  /** 清空/恢复单个槽位 */
  async resetSlot(slotId: string): Promise<SlotActionResult> {
    const result = await resetSlotOp(await this.context(), slotId)
    if (result.ok) this.cache = null
    return result
  }

  destroy(): void {
    this.destroyed = true
    this.ctx = null
    this.cache = null
  }
}
