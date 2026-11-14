/**
 * 数据管理 - 存储用量盘点
 *
 * JSON 槽按落盘文件 stat（一 key 一裸文件）；文件槽递归统计（上限 5000 项）；
 * localStorage 按 UTF-8 字节估算。插件不使用 SQLite。
 */
import type { StorageSlot } from "@/config/storage"
import {
  FILE_SLOTS,
  groupSlotsByOwner,
  JSON_SLOTS,
  LOCAL_STORAGE_SLOTS,
  STORAGE_SLOTS,
} from "@/config/storage"
import type {
  DiagnosticFinding,
  SlotUsage,
  StorageInventory,
} from "../types/model"
import { isGrowthWarning, sum } from "../utils"
import type { StorageContext } from "./context"

/** 单个文件槽递归统计的条目上限（超出显示 ≥ 并由 UI 提示） */
const FILE_SCAN_LIMIT = 5000

function emptyUsage(slot: StorageSlot): SlotUsage {
  return {
    slotId: slot.id,
    kind: slot.kind,
    key: slot.key,
    bytes: 0,
    missing: true,
  }
}

function measureJson(ctx: StorageContext, slot: StorageSlot): SlotUsage {
  const usage = emptyUsage(slot)
  try {
    const stat = ctx.fs.statSync(ctx.path.join(ctx.dataDir, slot.key))
    usage.bytes = stat.size
    usage.updatedAt = stat.mtimeMs
    usage.missing = false
  } catch {
    usage.missing = true
  }
  return usage
}

function measureFile(ctx: StorageContext, slot: StorageSlot): SlotUsage {
  const usage = emptyUsage(slot)
  const root = ctx.path.join(ctx.dataDir, slot.key)

  let rootStat: import("node:fs").Stats
  try {
    rootStat = ctx.fs.statSync(root)
  } catch {
    return usage
  }

  usage.missing = false
  usage.updatedAt = rootStat.mtimeMs
  // 文件槽既可能是目录（git-push-index / cover），也可能是单文件（feature-flags.json）
  if (rootStat.isFile()) {
    usage.bytes = rootStat.size
    return usage
  }

  let bytes = 0
  let count = 0
  const walk = (dir: string): void => {
    if (count >= FILE_SCAN_LIMIT) return
    let entries: import("node:fs").Dirent[]
    try {
      entries = ctx.fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (count >= FILE_SCAN_LIMIT) return
      const fullPath = ctx.path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
        continue
      }
      try {
        bytes += ctx.fs.statSync(fullPath).size
        count++
      } catch {
        // 文件在扫描中被删除：忽略
      }
    }
  }
  walk(root)
  usage.bytes = bytes
  usage.missing = false
  return usage
}

function measureLocalStorage(slot: StorageSlot): SlotUsage {
  const usage = emptyUsage(slot)
  try {
    const value = window.localStorage.getItem(slot.key)
    if (value === null) return usage
    usage.bytes = new TextEncoder().encode(value).length
    usage.missing = false
  } catch {
    usage.unavailableReason = "read-failed"
  }
  return usage
}

/** 构建存储总览 */
export async function buildInventory(ctx: StorageContext): Promise<StorageInventory> {
  const usageById = new Map<string, SlotUsage>()

  for (const slot of JSON_SLOTS) {
    usageById.set(slot.id, measureJson(ctx, slot))
  }
  for (const slot of FILE_SLOTS) {
    usageById.set(slot.id, measureFile(ctx, slot))
  }
  for (const slot of LOCAL_STORAGE_SLOTS) {
    usageById.set(slot.id, measureLocalStorage(slot))
  }

  const groups = groupSlotsByOwner().map(({ owner, slots }) => ({
    owner,
    slots: slots.map((slot) => usageById.get(slot.id) || emptyUsage(slot)),
    bytes: sum(slots.map((slot) => usageById.get(slot.id)?.bytes ?? 0)),
  }))

  const usages = STORAGE_SLOTS.map((slot) => usageById.get(slot.id)).filter((u): u is SlotUsage => !!u)
  const totals = {
    json: sum(usages.filter((u) => u.kind === "json").map((u) => u.bytes)),
    file: sum(usages.filter((u) => u.kind === "file").map((u) => u.bytes)),
    localStorage: sum(usages.filter((u) => u.kind === "localStorage").map((u) => u.bytes)),
    bytes: 0,
    sensitiveCount: STORAGE_SLOTS.filter((slot) => slot.sensitive).length,
  }
  totals.bytes = totals.json + totals.file + totals.localStorage

  const warnings: DiagnosticFinding[] = []
  for (const slot of STORAGE_SLOTS) {
    const usage = usageById.get(slot.id)
    if (!usage || usage.missing) continue
    if (isGrowthWarning(slot.growth, usage.bytes)) {
      warnings.push({
        slotId: slot.id,
        level: "warning",
        code: "growth-large",
        bytes: usage.bytes,
      })
    }
  }

  return {
    dataDir: ctx.dataDir,
    capturedAt: Date.now(),
    groups,
    totals,
    warnings,
  }
}
