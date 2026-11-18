// 提示词库存储行为断言 —— 覆盖审查发现的高风险路径：
//   P1-1 写入失败必须抛错（否则回滚与错误提示全是死代码）
//   P2-3 并发写串行（读-改-写不被交错覆盖）
//   P2-4 一次性迁移由 marker 守卫；读取失败不落标记、下次重试
import type { Plugin } from "siyuan"
import type { Prompt } from "./index"
import {
  describe,
  expect,
  it,
  vi,
} from "vitest"
import { PromptsStorage } from "./storage"

const KEY_PROMPTS = "siyuan-prompts"
const KEY_LEGACY = "siyuan-skills"
const KEY_MIGRATION = "siyuan-prompts-migration-v1"

function makePrompt(id: string, title = `t-${id}`): Prompt {
  return { id, title, description: "", contents: [], category: "default" }
}

interface FakePluginOptions {
  seed?: Record<string, unknown>
  failSave?: boolean
  failLoadKeys?: string[]
  saveDelayMs?: number
}

/** 内存版 Plugin：实现 loadData / saveData，可注入失败与延迟 */
function createFakePlugin(options: FakePluginOptions = {}) {
  const { seed = {}, failSave = false, failLoadKeys = [], saveDelayMs = 0 } = options
  const data: Record<string, unknown> = { ...seed }
  const plugin = {
    name: "fake-prompts-plugin",
    loadData: async (key: string) => {
      if (failLoadKeys.includes(key)) throw new Error(`load failed: ${key}`)
      return key in data ? data[key] : ""
    },
    saveData: async (key: string, value: unknown) => {
      if (saveDelayMs > 0) await new Promise((r) => setTimeout(r, saveDelayMs))
      if (failSave) throw new Error(`save failed: ${key}`)
      data[key] = value
      return true
    },
  }
  return { plugin: plugin as unknown as Plugin, data, saveData: plugin.saveData }
}

describe("PromptsStorage.persistOrThrow (P1-1)", () => {
  it("save 返回 true 时正常写入", async () => {
    const { plugin, data } = createFakePlugin()
    const storage = new PromptsStorage(plugin)
    const list = [makePrompt("p1")]
    await storage.persistOrThrow(storage.prompts, list)
    expect(data[KEY_PROMPTS]).toEqual(list)
  })

  it("save 抛错（底层返回 false 等价）时向上抛，使调用方回滚生效", async () => {
    const { plugin } = createFakePlugin({ failSave: true })
    const storage = new PromptsStorage(plugin)
    await expect(storage.persistOrThrow(storage.prompts, [makePrompt("p1")])).rejects.toThrow("写入失败")
  })
})

describe("PromptsStorage.migrateOnce (P2-4)", () => {
  it("marker 已置位时不读取旧 key（杜绝每次打开侦测）", async () => {
    const legacy = [makePrompt("legacy")]
    const { plugin } = createFakePlugin({
      seed: { [KEY_MIGRATION]: 1, [KEY_LEGACY]: legacy },
    })
    const storage = new PromptsStorage(plugin)
    const loadSpy = vi.spyOn(plugin, "loadData")
    await storage.migrateOnce()
    // 不应尝试读取旧 key
    expect(loadSpy.mock.calls.some(([k]) => k === KEY_LEGACY)).toBe(false)
    expect(await storage.loadPrompts()).toEqual([])
  })

  it("读取失败时不落 marker，下次可重试", async () => {
    const { plugin, data } = createFakePlugin({ failLoadKeys: [KEY_PROMPTS] })
    const storage = new PromptsStorage(plugin)
    await storage.migrateOnce()
    expect(data[KEY_MIGRATION]).toBeUndefined()
  })

  it("旧 key 回退成功并落 marker", async () => {
    const legacy = [makePrompt("legacy")]
    const { plugin, data } = createFakePlugin({ seed: { [KEY_LEGACY]: legacy } })
    const storage = new PromptsStorage(plugin)
    await storage.migrateOnce()
    expect(await storage.loadPrompts()).toEqual(legacy)
    expect(data[KEY_MIGRATION]).toBe(1)
  })

  it("旧格式 content* 迁移为 contents[] 后回写", async () => {
    const legacyPrompt = {
      id: "old",
      title: "旧提示词",
      description: "",
      category: "default",
      content: "第一段",
      content2: "第二段",
      content3: "",
    }
    const { plugin } = createFakePlugin({ seed: { [KEY_PROMPTS]: [legacyPrompt] } })
    const storage = new PromptsStorage(plugin)
    await storage.migrateOnce()
    const [migrated] = await storage.loadPrompts()
    expect(migrated.contents).toHaveLength(2)
    expect(migrated.contents[0].text).toBe("第一段")
    expect((migrated as any).content).toBeUndefined()
  })
})

describe("PromptsStorage.runExclusive (P2-3)", () => {
  it("并发任务按入队顺序串行执行，互不交错", async () => {
    const { plugin } = createFakePlugin({ saveDelayMs: 5 })
    const storage = new PromptsStorage(plugin)
    const order: number[] = []
    const tasks = [1, 2, 3].map((n) =>
      storage.runExclusive(async () => {
        order.push(n)
        await Promise.resolve()
        order.push(n * 10)
      }),
    )
    await Promise.all(tasks)
    // 若并行交错，顺序会是 [1,2,3,10,20,30]；串行则为 [1,10,2,20,3,30]
    expect(order).toEqual([1, 10, 2, 20, 3, 30])
  })

  it("前一个任务失败不影响后续任务执行", async () => {
    const { plugin } = createFakePlugin()
    const storage = new PromptsStorage(plugin)
    const failed = storage.runExclusive(async () => {
      throw new Error("boom")
    })
    const succeeded = storage.runExclusive(async () => "ok")
    await expect(failed).rejects.toThrow("boom")
    await expect(succeeded).resolves.toBe("ok")
  })
})
