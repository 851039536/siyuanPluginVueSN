/**
 * 数据管理 - 按模块导出 / 导入
 *
 * 导出载荷为单个 JSON（仅 `slots`）；导入只接受注册表内的 slot key，
 * 未知 key 一律拒绝。旧版导出文件里的 `tables` / `schemas` 字段会被忽略。
 */
import type { StorageOwner } from "@/config/storage"
import { JSON_SLOTS } from "@/config/storage"
import {
  loadSettings,
  saveFeatureFlagsSync,
} from "@/config/settings"
import { emitCustomEvent } from "@/utils/eventBus"
import { PluginStorage } from "@/utils/pluginStorage"
import type {
  ImportReport,
  ModuleExportPayload,
} from "../types/model"
import type { StorageContext } from "./context"

const JSON_BY_KEY = new Map(JSON_SLOTS.map((slot) => [slot.key, slot]))
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"])

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

  for (const slot of JSON_SLOTS) {
    if (!belongsToOwner(slot.owners, owners)) continue
    if (!slot.exportable) continue
    if (slot.sensitive && !options.includeSensitive) continue
    const value = await storage.load(slot.key)
    if (value !== null) slots[slot.key] = value
  }

  return {
    version: 1,
    exportedAt: Date.now(),
    owners,
    slots,
  }
}

/** 载荷 → 可下载的 Blob */
export function blobFromPayload(payload: ModuleExportPayload): Blob {
  const text = JSON.stringify(payload, null, 2)
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
  ) {
    return { error: "invalidPayload" }
  }
  // 快照之前先拒绝未登记的 key，避免「备份已生成但导入整体非法」
  for (const key of Object.keys(candidate.slots || {})) {
    if (!JSON_BY_KEY.has(key)) return { error: "unregisteredKey" }
  }
  return {
    payload: {
      version: 1,
      exportedAt: Number(candidate.exportedAt) || 0,
      owners: Array.isArray(candidate.owners) ? candidate.owners : [],
      slots: candidate.slots || {},
    },
  }
}
