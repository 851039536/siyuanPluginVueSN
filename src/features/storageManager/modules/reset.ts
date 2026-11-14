/**
 * 数据管理 - 单槽清空 / 恢复默认
 *
 * 只允许注册表标记 `resettable: true` 的槽位；core 与高敏槽位一律拒绝。
 */
import { getSlot } from "@/config/storage"
import { PluginStorage } from "@/utils/pluginStorage"
import type { SlotActionResult } from "../types/model"
import type { StorageContext } from "./context"

export async function resetSlot(ctx: StorageContext, slotId: string): Promise<SlotActionResult> {
  const slot = getSlot(slotId)
  if (!slot) return { slotId, ok: false, error: "slotNotRegistered" }
  if (!slot.resettable) return { slotId, ok: false, error: "notResettable" }

  switch (slot.kind) {
    case "json": {
      const ok = await new PluginStorage(ctx.plugin).remove(slot.key)
      return { slotId, ok, error: ok ? undefined : "removeFailed" }
    }
    case "localStorage": {
      try {
        window.localStorage.removeItem(slot.key)
        return { slotId, ok: true }
      } catch {
        return { slotId, ok: false, error: "removeFailed" }
      }
    }
    case "file": {
      try {
        ctx.fs.rmSync(ctx.path.join(ctx.dataDir, slot.key), { recursive: true, force: true })
        return { slotId, ok: true }
      } catch {
        return { slotId, ok: false, error: "removeFailed" }
      }
    }
  }
}
