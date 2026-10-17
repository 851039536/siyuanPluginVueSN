// src/utils/sqliteDb.spec.ts — SQLite 基础设施纯逻辑测试（表命名空间、路径安全、工作区解析容错）
//
// 说明：openWithRetry 依赖思源运行时（plugin 实例 / 内核 API），无法在纯 Node 中完整驱动；
// 此处覆盖可独立推理的纯函数契约，重点是**路径相对性拒绝**（曾把库建到错误目录）
// 与**工作区解析在无 window 环境下的容错**（不得抛错）。
import { afterEach, describe, expect, it, vi } from "vitest"
import { buildDbPath, featureTables, resolvePluginDataDir } from "./sqliteDb"

/** 构造一个最小 plugin 桩（本模块只用 name / dataDir） */
function fakePlugin(dataDir?: unknown): any {
  return { name: "test-plugin", dataDir }
}

describe("featureTables", () => {
  it("按功能前缀生成表名", () => {
    const t = featureTables("wn", ["entries", "categories"] as const)
    expect(t.entries).toBe("wn_entries")
    expect(t.categories).toBe("wn_categories")
  })

  it("不同功能前缀不冲突", () => {
    const a = featureTables("wn", ["entries"] as const)
    const b = featureTables("rs", ["entries"] as const)
    expect(a.entries).not.toBe(b.entries)
  })

  it("空的实体列表返回空对象", () => {
    expect(featureTables("x", [] as const)).toEqual({})
  })
})

describe("buildDbPath", () => {
  it("在插件数据目录下生成库文件绝对路径", () => {
    const dataDir = process.platform === "win32"
      ? "C:\\ws\\data\\storage\\petal\\my-plugin"
      : "/ws/data/storage/petal/my-plugin"
    const p = buildDbPath(dataDir, "plugin")
    expect(p.endsWith("plugin.db")).toBe(true)
    expect(p.startsWith(dataDir)).toBe(true)
  })

  it("空目录返回空串（不兜底成当前目录）", () => {
    expect(buildDbPath("", "plugin")).toBe("")
  })

  it("拒绝相对路径 —— 否则库会被建到渲染进程 CWD 而非工作区", () => {
    // 这正是历史上的真实故障：plugin.dataDir 为 undefined 时拼出相对路径，
    // 库落到了 <cwd>/storage/petal/<plugin>/ 而不是 <workspace>/data/storage/petal/<plugin>/
    expect(buildDbPath("storage\\petal\\my-plugin", "plugin")).toBe("")
    expect(buildDbPath("data/storage/petal/plain", "plugin")).toBe("")
  })

  it("相对路径变体一律拒绝", () => {
    for (const bad of [".", "..", "./data", "../data", "data"]) {
      expect(buildDbPath(bad, "plugin")).toBe("")
    }
  })

  it("库文件名可定制（同一库内多个库文件场景）", () => {
    const dataDir = process.platform === "win32" ? "C:\\ws" : "/ws"
    expect(buildDbPath(dataDir, "cache")).toContain("cache.db")
    expect(buildDbPath(dataDir)).toContain("plugin.db")
  })
})

describe("resolvePluginDataDir", () => {
  const WS = process.platform === "win32" ? "C:\\ws" : "/ws"

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("优先采用 plugin.dataDir（绝对路径）", async () => {
    const dataDir = process.platform === "win32" ? "C:\\ws\\petal\\p" : "/ws/petal/p"
    expect(await resolvePluginDataDir(fakePlugin(dataDir))).toBe(dataDir)
  })

  it("plugin.dataDir 是相对路径时不采用（防建到 CWD）", async () => {
    // 相对路径被拒 → 回退到内核配置；此处无 window 且 fetch 失败 → 空串
    vi.stubGlobal("window", undefined)
    vi.stubGlobal("fetch", () => Promise.reject(new Error("no network")))
    expect(await resolvePluginDataDir(fakePlugin("storage/petal/p"))).toBe("")
  })

  it("从 window.siyuan.config 读取工作区根并拼出插件数据目录", async () => {
    vi.stubGlobal("window", { siyuan: { config: { system: { workspaceDir: WS } } } })
    const got = await resolvePluginDataDir(fakePlugin(undefined))
    expect(got).toBe(`${WS}/data/storage/petal/test-plugin`.split("/").join(process.platform === "win32" ? "\\" : "/"))
  })

  it("window 不可用且 fetch 失败时返回空串，不抛错", async () => {
    vi.stubGlobal("window", undefined)
    vi.stubGlobal("fetch", () => Promise.reject(new Error("no network")))
    await expect(resolvePluginDataDir(fakePlugin(undefined))).resolves.toBe("")
  })

  it("fetch 回退可用时也能解析出工作区", async () => {
    vi.stubGlobal("window", undefined)
    vi.stubGlobal("fetch", () => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ code: 0, data: { conf: { system: { workspaceDir: WS } } } }),
    }))
    const got = await resolvePluginDataDir(fakePlugin(undefined))
    expect(got).toContain("data")
    expect(got).toContain("petal")
    expect(got).toContain("test-plugin")
  })

  it("内核返回非 0 code 时视为失败", async () => {
    vi.stubGlobal("window", undefined)
    vi.stubGlobal("fetch", () => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ code: -1, data: null }),
    }))
    expect(await resolvePluginDataDir(fakePlugin(undefined))).toBe("")
  })
})
