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
const CREATE_TABLE_RE = /^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`[]?([A-Za-z_][A-Za-z0-9_]*)/i

/**
 * 只接受「单条、表名与目标槽一致」的 CREATE TABLE 语句。
 * DDL 来自用户上传的备份，不能把多条语句交给 exec。
 */
function safeCreateTableSql(sql: string, table: string): string | null {
  const trimmed = sql.trim().replace(/;+\s*$/, "")
  if (trimmed.includes(";")) return null
  const match = trimmed.match(CREATE_TABLE_RE)
  return match && match[1] === table ? trimmed : null
}

/** 插件实例上可写的运行时设置快照（避免使用 any） */
interface PluginWithSettings {
  settings?: unknown
}

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
  const schemas: Record<string, string> = {}

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
          const schema = open.db.get<{ sql?: string }>(
            "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
            slot.key,
          )
          if (schema?.sql) schemas[slot.key] = schema.sql
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
    schemas,
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
    ;(ctx.plugin as unknown as PluginWithSettings).settings = refreshed
    saveFeatureFlagsSync(refreshed)
  } catch (error) {
    console.error("[storageManager] 刷新设置快照失败:", error)
  }
}

async function applyJsonSlots(
  ctx: StorageContext,
  payload: ModuleExportPayload,
  report: ImportReport,
  allowNonExportable: boolean,
): Promise<void> {
  const storage = new PluginStorage(ctx.plugin)
  for (const [key, value] of Object.entries(payload.slots || {})) {
    if (FORBIDDEN_KEYS.has(key)) continue
    const slot = JSON_BY_KEY.get(key)
    if (!slot) {
      report.failed.push({ slotId: key, error: "unregisteredKey" })
      continue
    }
    // exportable 是「按模块导出」的约束；全量备份还原应镜像备份内容，不受它限制
    if (!slot.exportable && !allowNonExportable) {
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
        // 全新安装 / 功能从未启用时目标库没有该表：用备份里采集的 DDL 重建，
        // 否则整表数据会被静默丢弃（正是「备份有、还原无」的根因之一）。
        const rawSchema = payload.schemas?.[table]
        const ddl = rawSchema ? safeCreateTableSql(rawSchema, table) : null
        if (!ddl) {
          report.skipped.push({ slotId: slot.id, reason: "tableMissing" })
          continue
        }
        try {
          db.exec(ddl)
        } catch (error) {
          report.failed.push({
            slotId: slot.id,
            error: error instanceof Error ? error.message : "createTableFailed",
          })
          continue
        }
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

/** applyPayload 选项 */
export interface ApplyPayloadOptions {
  /** 全量备份还原：忽略 JSON 槽的 exportable（镜像备份内容） */
  allowNonExportable?: boolean
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
  options: ApplyPayloadOptions = {},
): Promise<ImportReport> {
  await applyJsonSlots(ctx, payload, report, options.allowNonExportable === true)
  await applySqliteTables(ctx, payload, report)

  if (payload.slots && payload.slots["plugin-settings"] !== undefined) {
    await refreshSettingsSnapshot(ctx)
  }

  return report
}

/**
 * 应用完成后的统一收尾：按最终 applied 判定 requiresReload 并广播事件。
 * 必须在文件槽写回之后调用，否则「只有 git-push-index 被还原」时不会提示重载。
 */
export function finalizeReport(report: ImportReport): ImportReport {
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
  if (
    candidate.version !== 1
    || !candidate.slots
    || typeof candidate.slots !== "object"
    || Array.isArray(candidate.slots)
    || !candidate.tables
    || typeof candidate.tables !== "object"
    || Array.isArray(candidate.tables)
  ) {
    return { error: "invalidPayload" }
  }
  // 快照之前先拒绝未登记的 key/表，避免「备份已生成但导入整体非法」
  for (const key of Object.keys(candidate.slots || {})) {
    if (!JSON_BY_KEY.has(key)) return { error: "unregisteredKey" }
  }
  for (const table of Object.keys(candidate.tables || {})) {
    if (!SQLITE_BY_KEY.has(table)) return { error: "unregisteredTable" }
  }
  const schemas: Record<string, string> = {}
  if (candidate.schemas && typeof candidate.schemas === "object" && !Array.isArray(candidate.schemas)) {
    for (const [table, ddl] of Object.entries(candidate.schemas)) {
      if (typeof ddl === "string") schemas[table] = ddl
    }
  }
  return {
    payload: {
      version: 1,
      exportedAt: Number(candidate.exportedAt) || 0,
      owners: Array.isArray(candidate.owners) ? candidate.owners : [],
      slots: candidate.slots || {},
      tables: candidate.tables || {},
      schemas,
    },
  }
}
