// 提示词/分类 manager 的条数上限行为断言 —— 覆盖审查补充发现：
//   达到 MAX 时新增必须显式拒绝（抛出上限错误），不得静默丢弃新条目后提示成功。
import type { Plugin } from "siyuan"
import type { Prompt, PromptCategory } from "../types"
import { describe, expect, it } from "vitest"
import { shallowRef } from "vue"
import {
  MAX_CATEGORIES,
  MAX_PROMPTS,
} from "../types"
import { PromptsStorage } from "../types/storage"
import { PROMPTS_LIMIT_ERROR } from "../utils"
import { useCategoryManager } from "./useCategoryManager"
import { usePrompts } from "./usePrompts"

function createFakePlugin() {
  const data: Record<string, unknown> = {}
  const plugin = {
    name: "fake-prompts-plugin",
    loadData: async (key: string) => (key in data ? data[key] : ""),
    saveData: async (key: string, value: unknown) => {
      data[key] = value
      return true
    },
  }
  return { plugin: plugin as unknown as Plugin, data }
}

function makePrompt(id: string): Prompt {
  return { id, title: `t-${id}`, description: "", contents: [], category: "default" }
}

function makeCategory(id: string): PromptCategory {
  return { id, name: id, color: "#123456" }
}

describe("usePrompts 上限 (补充修复)", () => {
  it("未达上限：正常新增并写入存储", async () => {
    const { plugin, data } = createFakePlugin()
    const storageRef = shallowRef<PromptsStorage | null>(new PromptsStorage(plugin))
    const manager = usePrompts(storageRef)

    await manager.add(makePrompt("p1"))
    expect(manager.prompts.value).toHaveLength(1)
    expect(data["siyuan-prompts"]).toHaveLength(1)
  })

  it("已达 MAX_PROMPTS：拒绝新增并抛出上限错误，不静默丢弃", async () => {
    const { plugin } = createFakePlugin()
    const storageRef = shallowRef<PromptsStorage | null>(new PromptsStorage(plugin))
    const manager = usePrompts(storageRef)
    manager.prompts.value = Array.from({ length: MAX_PROMPTS }, (_, i) => makePrompt(`p${i}`))

    await expect(manager.add(makePrompt("overflow"))).rejects.toThrow(PROMPTS_LIMIT_ERROR)
    // 原列表长度不变，且新条目未被加入
    expect(manager.prompts.value).toHaveLength(MAX_PROMPTS)
    expect(manager.prompts.value.some((p) => p.id === "overflow")).toBe(false)
  })
})

describe("useCategoryManager 上限 (补充修复)", () => {
  it("已达 MAX_CATEGORIES：拒绝新增并抛出上限错误", async () => {
    const { plugin } = createFakePlugin()
    const storageRef = shallowRef<PromptsStorage | null>(new PromptsStorage(plugin))
    const manager = useCategoryManager(storageRef)
    manager.categories.value = Array.from({ length: MAX_CATEGORIES }, (_, i) => makeCategory(`c${i}`))

    await expect(manager.add(makeCategory("overflow"))).rejects.toThrow(PROMPTS_LIMIT_ERROR)
    expect(manager.categories.value).toHaveLength(MAX_CATEGORIES)
  })

  it("内置分类 id 不允许作为用户分类新增", async () => {
    const { plugin } = createFakePlugin()
    const storageRef = shallowRef<PromptsStorage | null>(new PromptsStorage(plugin))
    const manager = useCategoryManager(storageRef)

    await manager.add(makeCategory("default"))
    expect(manager.categories.value.some((c) => c.id === "default")).toBe(false)
  })
})
