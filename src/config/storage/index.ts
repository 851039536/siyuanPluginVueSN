/**
 * 存储槽注册表 - 聚合入口
 *
 * `STORAGE_SLOTS` 是全部持久化资产的元数据单一事实源，
 * 供 storageManager 面板、导出/还原与 audit-storage.mjs 使用。
 *
 * 插件不使用 SQLite（`plugin.db` 位于思源同步目录，Windows 文件锁会让同步 rename 失败）。
 */
import { FILE_SLOTS } from "./fileSlots"
import { JSON_SLOTS } from "./jsonSlots"
import { LOCAL_STORAGE_SLOTS } from "./localStorageSlots"
import type {
  StorageOwner,
  StorageSlot,
} from "./types"

export type {
  FileStorageSlot,
  JsonStorageSlot,
  LocalStorageSlot,
  SlotOptions,
  StorageKind,
  StorageOwner,
  StorageSlot,
} from "./types"
export { FILE_SLOTS } from "./fileSlots"
export { JSON_SLOTS } from "./jsonSlots"
export { LOCAL_STORAGE_SLOTS } from "./localStorageSlots"

/** 全部槽位（JSON → 文件 → localStorage 的顺序即面板展示顺序） */
export const STORAGE_SLOTS: readonly StorageSlot[] = [
  ...JSON_SLOTS,
  ...FILE_SLOTS,
  ...LOCAL_STORAGE_SLOTS,
]

/** id → 槽位 */
export const SLOT_BY_ID: ReadonlyMap<string, StorageSlot> = new Map(
  STORAGE_SLOTS.map((slot) => [slot.id, slot]),
)

/** 按 id 取槽位 */
export function getSlot(id: string): StorageSlot | undefined {
  return SLOT_BY_ID.get(id)
}

/** 取某功能名下的槽位（共享槽会出现在每个 owner 下） */
export function getSlotsByOwner(owner: StorageOwner): StorageSlot[] {
  return STORAGE_SLOTS.filter((slot) => slot.owners.includes(owner))
}

/**
 * 按主 owner 分组（共享槽只出现一次，挂在 owners[0] 下）。
 * 顺序：core 优先，其余按注册表出现顺序。
 */
export function groupSlotsByOwner(): { owner: StorageOwner, slots: StorageSlot[] }[] {
  const groups = new Map<StorageOwner, StorageSlot[]>()
  for (const slot of STORAGE_SLOTS) {
    const owner = slot.owners[0]
    const list = groups.get(owner)
    if (list) {
      list.push(slot)
    } else {
      groups.set(owner, [slot])
    }
  }
  return [...groups.entries()]
    .map(([owner, slots]) => ({ owner, slots }))
    .sort((a, b) => {
      if (a.owner === b.owner) return 0
      if (a.owner === "core") return -1
      if (b.owner === "core") return 1
      return 0
    })
}

/** 敏感槽位（导出默认排除） */
export function getSensitiveSlots(): StorageSlot[] {
  return STORAGE_SLOTS.filter((slot) => slot.sensitive)
}
