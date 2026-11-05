/**
 * 存储槽注册表不变量测试
 *
 * 只校验元数据自洽性（唯一性 / 命名 / owner / 敏感项声明），
 * 源码与实际 key 的一致性由 `pnpm audit:storage` 负责。
 */
import { describe, expect, it } from "vitest"
import { FEATURE_CONFIG } from "../../features/config"
import {
  getSlot,
  groupSlotsByOwner,
  STORAGE_SLOTS,
} from "./index"

const FEATURE_IDS = new Set<string>(FEATURE_CONFIG.map((feature) => feature.id))
const KEBAB_CASE = /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/
const SQLITE_TABLE = /^[a-z][a-z0-9]*_[a-z0-9_]+$/

describe("storage registry", () => {
  it("id 唯一", () => {
    const ids = STORAGE_SLOTS.map((slot) => slot.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("(kind, key) 唯一", () => {
    const pairs = STORAGE_SLOTS.map((slot) => `${slot.kind}:${slot.key}`)
    expect(new Set(pairs).size).toBe(pairs.length)
  })

  it("owner 必须非空且为 core 或合法 FeatureId", () => {
    for (const slot of STORAGE_SLOTS) {
      expect(slot.owners.length).toBeGreaterThan(0)
      for (const owner of slot.owners) {
        expect(owner === "core" || FEATURE_IDS.has(owner), `${slot.id} 的 owner ${owner} 非法`).toBe(true)
      }
    }
  })

  it("JSON key 默认符合 kebab-case，存量键已标 legacyName", () => {
    for (const slot of STORAGE_SLOTS) {
      if (slot.kind !== "json" || slot.legacyName) continue
      expect(KEBAB_CASE.test(slot.key), `${slot.id} 的 key ${slot.key} 不符合 kebab-case`).toBe(true)
    }
  })

  it("SQLite 表名符合 <前缀>_<实体>", () => {
    for (const slot of STORAGE_SLOTS) {
      if (slot.kind !== "sqlite") continue
      expect(SQLITE_TABLE.test(slot.key), `${slot.id} 的表名 ${slot.key} 不合规`).toBe(true)
    }
  })

  it("敏感槽位必须写明处理方式", () => {
    for (const slot of STORAGE_SLOTS) {
      if (!slot.sensitive) continue
      expect((slot.notes || "").trim().length, `${slot.id} 标了 sensitive 但没有 notes`).toBeGreaterThan(0)
    }
  })

  it("localStorage 槽位不可导出、不可还原", () => {
    for (const slot of STORAGE_SLOTS) {
      if (slot.kind !== "localStorage") continue
      expect(slot.exportable).toBe(false)
      expect(slot.restorable).toBe(false)
    }
  })

  it("restorable 只允许 JSON / SQLite / 文件槽", () => {
    for (const slot of STORAGE_SLOTS) {
      if (slot.kind === "localStorage") continue
      if (!slot.restorable) continue
      expect(["json", "sqlite", "file"]).toContain(slot.kind)
    }
  })

  it("核心槽位已登记", () => {
    expect(getSlot("core.pluginSettings")).toBeDefined()
    expect(getSlot("core.pluginDb")).toBeDefined()
    expect(getSlot("core.featureFlags")).toBeDefined()
  })

  it("分组时 core 排在最前", () => {
    const groups = groupSlotsByOwner()
    expect(groups[0]?.owner).toBe("core")
  })
})
