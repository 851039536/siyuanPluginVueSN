/**
 * 数据管理 - 按模块导出 / 导入
 *
 * 导出载荷为单个 JSON（`slots` + `tables`）；导入只接受注册表内的 slot key，
 * 未知 key 一律拒绝。SQLite 表按「整表替换 + 单表事务」写回。
 */
import type { StorageOwner } from "@/config/storage"
import {
  JSON_SLOTS,
  SQLITE_SLOTS,
} from "@/config/storage"
import {
  loadSettings,
  saveFeatureFlagsSync,
} from "@/config/settings"
import { emitCustomEvent } from "@/utils/eventBus"
import { PluginStorage } from "@/utils/pluginStorage"
import { openPluginDatabase } from "@/utils/sqliteDb"
import type {
  ImportReport,
  ModuleExportPayload,
} from "../types/model"
import { isSafeTableName, type StorageContext } from "./context"

const JSON_BY_KEY = new Map(JSON_SLOTS.map((slot) => [slot.key, slot]))
const SQLITE_BY_KEY = new Map(SQLITE_SLOTS.map((slot) => [slot.key, slot]))
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"])

function belongsToOwner(slotOwners: readonly StorageOwner[], owners: StorageOwner[]): boolean {
  return slotOwners.some((owner) => owners.includes(owner))
}

/** 采集指定 owner 的可导出槽位 */
export async function buildModulePayload(
  ctx: StorageContext,
  owners: StorageOwner[],
  options: { includeSensitive?: boolean } = {},
): Promise<ModuleExportPayload> {
  const storage = new PluginStorage(ctx.plugin)
  const slots: Record<string, unknown> = {}
  const tables: Record<string, Record<string, unknown>[]> = {}

  for (const slot of JSON_SLOTS) {
    if (!belongsToOwner(slot.owners, owners)) continue
    if (!slot.exportable) continue
    if (slot.sensitive && !options.includeSensitive) continue
    const value = await storage.load(slot.key)
    if (value !== null) slots[slot.key] = value
  }

  if (SQLITE_SLOTS.some((slot) => belongsToOwner(slot.owners, owners) && slot.exportable)) {
    const open = await openPluginDatabase(ctx.plugin)
    if (open.ok) {
      try {
        for (const slot of SQLITE_SLOTS) {
          if (!belongsToOwner(slot.owners, owners) || !slot.exportable) continue
          if (!isSafeTableName(slot.key)) continue
          const exists = open.db.get(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
            slot.key,
          )
          if (!exists) continue
          tables[slot.key] = open.db.all<Record<string, unknown>>(`SELECT * FROM "${slot.key}"`)
        }
      } finally {
        open.db.close()
      }
    }
  }

  return {
    version: 1,
    exportedAt: Date.now(),
    owners,
    slots,
    tables,
  }
}

/** 载荷 → 可下载的 Blob（BigInt 转 Number，避免 SQLite 行序列化失败） */
export function blobFromPayload(payload: ModuleExportPayload): Blob {
  const text = JSON.stringify(payload, (_key, value) => (typeof value === "bigint" ? Number(value) : value), 2)
  return new Blob([text], { type: "application/json" })
}

/** 导入后刷新插件设置快照（开关/敏感配置可能变化） */
async function refreshSettingsSnapshot(ctx: StorageContext): Promise<void> {
  try {
    const refreshed = await loadSettings(ctx.plugin)
    ;(ctx.plugin as any).settings = refreshed
    saveFeatureFlagsSync(refreshed)
  } catch (error) {
    console.error("[storageManager] 刷新设置快照失败:", error)
  }
}

async function applyJsonSlots(
  ctx: StorageContext,
  payload: ModuleExportPayload,
  report: ImportReport,
): Promise<void> {
  const storage = new PluginStorage(ctx.plugin)
  for (const [key, value] of Object.entries(payload.slots || {})) {
    if (FORBIDDEN_KEYS.has(key)) continue
    const slot = JSON_BY_KEY.get(key)
    if (!slot) {
      report.failed.push({ slotId: key, error: "unregisteredKey" })
      continue
    }
    if (!slot.exportable) {
      report.skipped.push({ slotId: slot.id, reason: "notExportable" })
      continue
    }
    const ok = await storage.save(key, value)
    if (ok) report.applied.push(slot.id)
    else report.failed.push({ slotId: slot.id, error: "saveFailed" })
  }
}

async function applySqliteTables(
  ctx: StorageContext,
  payload: ModuleExportPayload,
  report: ImportReport,
): Promise<void> {
  const entries = Object.entries(payload.tables || {})
  if (!entries.length) return

  const open = await openPluginDatabase(ctx.plugin)
  if (!open.ok) {
    for (const [table] of entries) {
      report.failed.push({ slotId: table, error: "sqliteUnavailable" })
    }
    return
  }

  const db = open.db
  try {
    for (const [table, rows] of entries) {
      const slot = SQLITE_BY_KEY.get(table)
      if (!slot || !isSafeTableName(table)) {
        report.failed.push({ slotId: table, error: "unregisteredTable" })
        continue
      }
      if (!Array.isArray(rows)) {
        report.failed.push({ slotId: slot.id, error: "invalidPayload" })
        continue
      }
      const exists = db.get(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
        table,
      )
      if (!exists) {
        report.skipped.push({ slotId: slot.id, reason: "tableMissing" })
        continue
      }

      const dbColumns = new Set(
        db.all<{ name: string }>(`PRAGMA table_info("${table}")`).map((column) => column.name),
      )
      const first = rows?.[0]
      const columns = first
        ? Object.keys(first).filter((column) => dbColumns.has(column))
        : []
      if (rows?.length && !columns.length) {
        report.skipped.push({ slotId: slot.id, reason: "columnMismatch" })
        continue
      }

      try {
        db.withTransaction(() => {
          db.exec(`DELETE FROM "${table}"`)
          if (!columns.length) return
          const columnList = columns.map((column) => `"${column}"`).join(", ")
          const placeholders = columns.map(() => "?").join(", ")
          const sql = `INSERT INTO "${table}" (${columnList}) VALUES (${placeholders})`
          for (const row of rows) {
            db.run(sql, ...columns.map((column) => row[column]))
          }
        })
        report.applied.push(slot.id)
      } catch (error) {
        report.failed.push({
          slotId: slot.id,
          error: error instanceof Error ? error.message : "sqliteWriteFailed",
        })
      }
    }
  } finally {
    db.close()
  }
}

/** 应用载荷（不含自动备份；调用方负责先快照） */
export async function applyPayload(
  ctx: StorageContext,
  payload: ModuleExportPayload,
  report: ImportReport = {
    applied: [],
    skipped: [],
    failed: [],
    requiresReload: false,
  },
): Promise<ImportReport> {
  await applyJsonSlots(ctx, payload, report)
  await applySqliteTables(ctx, payload, report)

  if (payload.slots && payload.slots["plugin-settings"] !== undefined) {
    await refreshSettingsSnapshot(ctx)
  }

  report.requiresReload = report.applied.length > 0
  if (report.applied.length) {
    emitCustomEvent("storageRestored")
  }
  return report
}

/** 解析导入 JSON（只校验格式与版本，不落盘） */
export function parseModulePayload(text: string): { payload: ModuleExportPayload } | { error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { error: "invalidJson" }
  }

  if (!parsed || typeof parsed !== "object") {
    return { error: "invalidPayload" }
  }
  const candidate = parsed as Partial<ModuleExportPayload>
  if (candidate.version !== 1 || typeof candidate.slots !== "object" || typeof candidate.tables !== "object") {
    return { error: "invalidPayload" }
  }
  // 快照之前先拒绝未登记的 key/表，避免「备份已生成但导入整体非法」
  for (const key of Object.keys(candidate.slots || {})) {
    if (!JSON_BY_KEY.has(key)) return { error: "unregisteredKey" }
  }
  for (const table of Object.keys(candidate.tables || {})) {
    if (!SQLITE_BY_KEY.has(table)) return { error: "unregisteredTable" }
  }
  return {
    payload: {
      version: 1,
      exportedAt: Number(candidate.exportedAt) || 0,
      owners: Array.isArray(candidate.owners) ? candidate.owners : [],
      slots: candidate.slots || {},
      tables: candidate.tables || {},
    },
  }
}
