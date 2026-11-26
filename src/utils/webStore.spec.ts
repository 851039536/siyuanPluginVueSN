// src/renderer/src/utils/webStore.spec.ts — Web Storage 安全读写单元测试
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  safeLocalGet,
  safeLocalSet,
  safeSessionGet,
  safeSessionSet,
} from "./webStore"

/** 造一个最小可用的 Storage 桩 */
function makeStorage(): Storage {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value) },
    removeItem: (key: string) => { store.delete(key) },
    clear: () => { store.clear() },
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() { return store.size },
  }
}

describe("webStore", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("无 Storage（Node / 不可用环境）时读写安全降级", () => {
    expect(safeSessionGet("k")).toBeNull()
    expect(() => safeSessionSet("k", "v")).not.toThrow()
    expect(safeLocalGet("k")).toBeNull()
    expect(() => safeLocalSet("k", "v")).not.toThrow()
  })

  it("存在 Storage 时正常读写", () => {
    vi.stubGlobal("sessionStorage", makeStorage())
    vi.stubGlobal("localStorage", makeStorage())
    safeSessionSet("sk", "sv")
    safeLocalSet("lk", "lv")
    expect(safeSessionGet("sk")).toBe("sv")
    expect(safeLocalGet("lk")).toBe("lv")
  })

  it("原生 API 抛错（隐私模式拒绝存取）时静默降级", () => {
    const denied = {
      getItem: () => { throw new Error("denied") },
      setItem: () => { throw new Error("denied") },
    }
    vi.stubGlobal("sessionStorage", denied)
    vi.stubGlobal("localStorage", denied)
    expect(safeSessionGet("k")).toBeNull()
    expect(() => safeSessionSet("k", "v")).not.toThrow()
    expect(safeLocalGet("k")).toBeNull()
    expect(() => safeLocalSet("k", "v")).not.toThrow()
  })
})
