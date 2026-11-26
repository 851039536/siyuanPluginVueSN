// src/renderer/src/utils/sessionStore.spec.ts — sessionStorage 安全读写单元测试
import { afterEach, describe, expect, it, vi } from "vitest"
import { safeSessionGet, safeSessionSet } from "./sessionStore"

describe("sessionStore", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("无 sessionStorage（Node / 不可用环境）时读写安全降级", () => {
    expect(safeSessionGet("k")).toBeNull()
    expect(() => safeSessionSet("k", "v")).not.toThrow()
  })

  it("存在 sessionStorage 时正常读写", () => {
    const store = new Map<string, string>()
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value) },
    })
    safeSessionSet("k", "v")
    expect(safeSessionGet("k")).toBe("v")
  })

  it("原生 API 抛错（隐私模式拒绝存取）时静默降级", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => { throw new Error("denied") },
      setItem: () => { throw new Error("denied") },
    })
    expect(safeSessionGet("k")).toBeNull()
    expect(() => safeSessionSet("k", "v")).not.toThrow()
  })
})
