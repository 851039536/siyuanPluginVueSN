// 并发数默认值一次性迁移单测 —— 配置迁移必须幂等，且绝不能覆盖用户显式选择。
//
// 迁移是「读一次、写一次、落标记」的不可逆操作，一旦出错会让用户的设置被
// 静默改掉（且永远发现不了）。故逐分支覆盖：
//   - 已迁移 → 什么都不做（幂等，含用户手动改回 3 的情况）
//   - 从未设置 → 新默认生效，只落标记
//   - 仍是旧默认 3 → 提升到 10
//   - 用户自定义（6/8/10）→ 保留原值
import type { Plugin } from "siyuan"
import {
  describe,
  expect,
  it,
} from "vitest"
import {
  DEFAULT_GIT_CONCURRENCY,
  GIT_CONCURRENCY_MIGRATION_VERSION,
  GitPushStorage,
  LEGACY_GIT_CONCURRENCY,
} from "./storage"

/** 内存版 Plugin：只实现迁移路径用到的 loadData / saveData / name */
function createFakePlugin(seed: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = { ...seed }
  const plugin = {
    name: "fake-plugin",
    loadData: async (key: string) => (key in data ? data[key] : ""),
    saveData: async (key: string, value: unknown) => {
      data[key] = value
      return true
    },
  }
  return {
    plugin: plugin as unknown as Plugin,
    data,
  }
}

const CONCURRENCY_KEY = "git-push-concurrency"
const MIGRATION_KEY = "git-push-concurrency-migration"

describe("并发数默认值迁移", () => {
  it("常量自洽：新默认 10，旧默认 3", () => {
    expect(DEFAULT_GIT_CONCURRENCY).toBe(10)
    expect(LEGACY_GIT_CONCURRENCY).toBe(3)
    expect(GIT_CONCURRENCY_MIGRATION_VERSION).toBeGreaterThan(0)
  })

  it("从未设置过：不写并发键（新默认自然生效），只落迁移标记", async () => {
    const {
      plugin,
      data,
    } = createFakePlugin()
    const storage = new GitPushStorage(plugin)
    await storage.init()

    // 并发键保持不存在 → GitExecutor.loadGitConcurrency 走默认值 10
    expect(await storage.gitConcurrency.load()).toBeNull()
    expect(await storage.gitConcurrency.loadOrDefault()).toBe(DEFAULT_GIT_CONCURRENCY)
    // 标记已落盘，下次短路
    expect(data[MIGRATION_KEY]).toBe(GIT_CONCURRENCY_MIGRATION_VERSION)
  })

  it("仍是旧默认 3：提升到 10", async () => {
    const {
      plugin,
      data,
    } = createFakePlugin({ [CONCURRENCY_KEY]: LEGACY_GIT_CONCURRENCY })
    const storage = new GitPushStorage(plugin)
    await storage.init()

    expect(data[CONCURRENCY_KEY]).toBe(DEFAULT_GIT_CONCURRENCY)
    expect(data[MIGRATION_KEY]).toBe(GIT_CONCURRENCY_MIGRATION_VERSION)
  })

  it("用户已自定义（6/8/10）：一律保留原值", async () => {
    for (const custom of [1, 2, 4, 6, 8, 10]) {
      const {
        plugin,
        data,
      } = createFakePlugin({ [CONCURRENCY_KEY]: custom })
      const storage = new GitPushStorage(plugin)
      await storage.init()
      expect(data[CONCURRENCY_KEY]).toBe(custom)
      expect(data[MIGRATION_KEY]).toBe(GIT_CONCURRENCY_MIGRATION_VERSION)
    }
  })

  it("幂等：重复 init 不改变结果", async () => {
    const {
      plugin,
      data,
    } = createFakePlugin({ [CONCURRENCY_KEY]: LEGACY_GIT_CONCURRENCY })
    const storage = new GitPushStorage(plugin)
    await storage.init()
    await storage.init()
    await storage.init()
    expect(data[CONCURRENCY_KEY]).toBe(DEFAULT_GIT_CONCURRENCY)
  })

  it("已迁移后用户手动改回 3：不会被再次覆盖（关键：标记优先）", async () => {
    const {
      plugin,
      data,
    } = createFakePlugin({
      [CONCURRENCY_KEY]: LEGACY_GIT_CONCURRENCY,
      [MIGRATION_KEY]: GIT_CONCURRENCY_MIGRATION_VERSION,
    })
    const storage = new GitPushStorage(plugin)
    await storage.init()

    // 标记已存在 → 直接返回，用户的 3 被保留
    expect(data[CONCURRENCY_KEY]).toBe(LEGACY_GIT_CONCURRENCY)
  })

  it("字符串形式的旧值（loadData 可能返回字符串）也能识别并迁移", async () => {
    const {
      plugin,
      data,
    } = createFakePlugin({ [CONCURRENCY_KEY]: "3" })
    const storage = new GitPushStorage(plugin)
    await storage.init()
    expect(data[CONCURRENCY_KEY]).toBe(DEFAULT_GIT_CONCURRENCY)
  })

  it("读取异常时不落标记（下次重试），避免永久跳过迁移", async () => {
    // PluginStorage.load() 内部 catch 后返回 null，与「键不存在」无法区分。
    // 若此时键其实存在（存着 3），落标记会让迁移永久跳过 —— 必须避免。
    let loadCalls = 0
    const plugin = {
      name: "fake-plugin",
      loadData: async (key: string) => {
        if (key === CONCURRENCY_KEY) {
          loadCalls++
          throw new Error("transient load failure")
        }
        return ""
      },
      saveData: async () => true,
    } as unknown as Plugin

    const storage = new GitPushStorage(plugin)
    await expect(storage.init()).resolves.toBeUndefined()

    // 关键断言：标记**没有**被写入 → 下次启动会重试
    expect(await storage.gitConcurrencyMigration.load()).toBeNull()
    expect(loadCalls).toBeGreaterThan(0)
  })

  it("提升写入失败（save 返回 false）时不落标记，下次启动重试", async () => {
    // PluginStorage.save() 失败时**不抛错、只返回 false**。
    // 若忽略返回值继续落标记，会留下「值仍是 3 + 标记说已迁移」的永久不一致 ——
    // 正是本迁移要避免的失效模式。
    let saveCalls = 0
    const plugin = {
      name: "fake-plugin",
      loadData: async (key: string) => {
        if (key === CONCURRENCY_KEY) return LEGACY_GIT_CONCURRENCY
        return ""
      },
      saveData: async (key: string) => {
        if (key === CONCURRENCY_KEY) {
          saveCalls++
          throw new Error("disk full")
        }
        return true
      },
    } as unknown as Plugin

    const storage = new GitPushStorage(plugin)
    await expect(storage.init()).resolves.toBeUndefined()

    expect(saveCalls).toBeGreaterThan(0)
    // 核心断言：标记没有被写入 → 下次启动会重试
    expect(await storage.gitConcurrencyMigration.load()).toBeNull()
  })

  it("并发值损坏为 NaN 时不落标记（下次重试），也不误判为用户自定义", async () => {
    const { plugin, data } = createFakePlugin({ [CONCURRENCY_KEY]: "not-a-number" })
    const storage = new GitPushStorage(plugin)
    await storage.init()

    // 损坏值既不提升也不落标记
    expect(data[CONCURRENCY_KEY]).toBe("not-a-number")
    expect(await storage.gitConcurrencyMigration.load()).toBeNull()
  })

  it("不干扰既有的默认分类与项目 categoryId 迁移", async () => {
    const {
      plugin,
      data,
    } = createFakePlugin({
      "git-push-projects": [{
        id: "p1",
        name: "P1",
        path: "/x",
        addedAt: 1,
      }],
    })
    const storage = new GitPushStorage(plugin)
    await storage.init()

    const projects = data["git-push-projects"] as Array<{ categoryId?: string }>
    expect(projects[0].categoryId).toBe("__ungrouped__")
  })
})
