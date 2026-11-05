/**
 * 存储槽注册表 - 工厂函数
 *
 * ⚠️ 一槽一行调用，便于 scripts/audit-storage.mjs 用正则稳定解析。
 * 不要改成循环生成或跨行拼接。
 */
import type {
  FileStorageSlot,
  JsonStorageSlot,
  LocalStorageSlot,
  SlotOptions,
  SqliteStorageSlot,
  StorageOwner,
} from "./types"

export function jsonSlot(
  id: string,
  owners: readonly StorageOwner[],
  key: string,
  defaultLabel: string,
  options: SlotOptions = {},
): JsonStorageSlot {
  return {
    id,
    owners,
    kind: "json",
    key,
    defaultLabel,
    labelI18nKey: options.labelI18nKey,
    growth: options.growth ?? false,
    sensitive: options.sensitive ?? false,
    exportable: options.exportable ?? true,
    resettable: options.resettable ?? true,
    restorable: options.restorable ?? true,
    legacyName: options.legacyName ?? false,
    notes: options.notes,
  }
}

export function sqliteSlot(
  id: string,
  owners: readonly StorageOwner[],
  table: string,
  defaultLabel: string,
  options: SlotOptions = {},
): SqliteStorageSlot {
  return {
    id,
    owners,
    kind: "sqlite",
    key: table,
    defaultLabel,
    labelI18nKey: options.labelI18nKey,
    growth: options.growth ?? true,
    sensitive: options.sensitive ?? false,
    exportable: options.exportable ?? true,
    resettable: options.resettable ?? true,
    restorable: options.restorable ?? true,
    legacyName: options.legacyName ?? false,
    notes: options.notes,
  }
}

export function fileSlot(
  id: string,
  owners: readonly StorageOwner[],
  relativePath: string,
  defaultLabel: string,
  options: SlotOptions = {},
): FileStorageSlot {
  return {
    id,
    owners,
    kind: "file",
    key: relativePath,
    defaultLabel,
    labelI18nKey: options.labelI18nKey,
    growth: options.growth ?? false,
    sensitive: options.sensitive ?? false,
    exportable: options.exportable ?? false,
    resettable: options.resettable ?? false,
    restorable: options.restorable ?? false,
    legacyName: options.legacyName ?? false,
    notes: options.notes,
  }
}

export function localStorageSlot(
  id: string,
  owners: readonly StorageOwner[],
  key: string,
  defaultLabel: string,
  options: SlotOptions = {},
): LocalStorageSlot {
  return {
    id,
    owners,
    kind: "localStorage",
    key,
    defaultLabel,
    labelI18nKey: options.labelI18nKey,
    growth: options.growth ?? false,
    sensitive: options.sensitive ?? false,
    exportable: options.exportable ?? false,
    resettable: options.resettable ?? true,
    restorable: options.restorable ?? false,
    legacyName: options.legacyName ?? false,
    notes: options.notes,
  }
}
