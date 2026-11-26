// 分类写操作并发安全单测（P1-2）
//
// 背景：`addCategory` / `updateCategory` 原实现没有走 `serializeWrite`，而
// `getCategories()` 每次都真读盘（等价于 `JSON.parse`，每次拿到**独立副本**）。
// 于是两次并发新增各自基于同一份旧数组 push、再各存一份 —— 后写覆盖先写，
// 用户看到的是「刚建的分类凭空消失」。删除 + 新增交错还会把已删分类写回来。
//
// 本文件的假存储刻意做两件事，缺一不可：
//   1. 每次 `loadOrDefault` 返回**深拷贝**（若返回同一引用，两次 push 会落进同一个数组，
//      丢更新被引用共享掩盖，用例就测不出真问题）；
//   2. `save` 前让出事件循环（模拟真实落盘的异步间隙，让两个读-改-写窗口真正重叠）。
import type { GitPushStorage, ProjectCategory } from "../types/storage"
import type { GitExecutor } from "./GitExecutor"
import { describe, expect, it } from "vitest"
import { UNGROUPED_ID } from "../types/storage"
import { ProjectStore } from "./ProjectStore"

const tick = (): Promise<void> => new Promise((resolve) => { setTimeout(resolve, 5) })

function makeSlot<T>(initial: T) {
  let value = structuredClone(initial)
  const box = {
    saves: 0,
    read: (): T => structuredClone(value),
  }
  const slot = {
    loadOrDefault: async () => {
      await tick()
      return structuredClone(value)
    },
    load: async () => {
      await tick()
      return structuredClone(value)
    },
    save: async (next: T) => {
      await tick()
      box.saves++
      value = structuredClone(next)
      return true
    },
  }
  return { box, slot }
}

const ungrouped: ProjectCategory = { id: UNGROUPED_ID, name: "未分组", color: "#888888", order: 0 }

function makeStore(categories: ProjectCategory[] = [ungrouped]) {
  const projects = makeSlot([])
  const cats = makeSlot(categories)
  const tags = makeSlot<string[]>([])
  const commitTemplates = makeSlot([])
  const storage = {
    projects: projects.slot,
    categories: cats.slot,
    tags: tags.slot,
    commitTemplates: commitTemplates.slot,
  } as unknown as GitPushStorage
  return { store: new ProjectStore(storage, {} as GitExecutor), cats }
}

describe("分类写操作并发安全", () => {
  it("并发新增两个分类：两个都必须落盘（不再丢更新）", async () => {
    const { store, cats } = makeStore()

    const [a, b] = await Promise.all([
      store.addCategory("前端"),
      store.addCategory("后端"),
    ])

    const names = cats.box.read().map((c) => c.name)
    expect(names).toContain("前端")
    expect(names).toContain("后端")
    // 两次写入都必须带独立 id，否则 UI 里会出现「同名同 id」的幽灵项
    expect(a.id).not.toBe(b.id)
    expect(cats.box.read().filter((c) => c.name === "前端")).toHaveLength(1)
  })

  it("改名与新增交错：改名结果不被新增覆盖", async () => {
    const seed: ProjectCategory = { id: "c1", name: "旧名", color: "#111111", order: 1 }
    const { store, cats } = makeStore([ungrouped, seed])

    await Promise.all([
      store.updateCategory("c1", { name: "新名" }),
      store.addCategory("后端"),
    ])

    const list = cats.box.read()
    expect(list.find((c) => c.id === "c1")?.name).toBe("新名")
    expect(list.map((c) => c.name)).toContain("后端")
  })

  it("删除与新增交错：被删分类不会复活", async () => {
    const doomed: ProjectCategory = { id: "c1", name: "待删", color: "#222222", order: 1 }
    const { store, cats } = makeStore([ungrouped, doomed])

    await Promise.all([
      store.deleteCategory("c1"),
      store.addCategory("后端"),
    ])

    const list = cats.box.read()
    expect(list.some((c) => c.id === "c1")).toBe(false)
    expect(list.map((c) => c.name)).toContain("后端")
  })

  it("未分组不可改名：即使调用也不写盘", async () => {
    const { store, cats } = makeStore()

    await store.updateCategory(UNGROUPED_ID, { name: "改掉" })

    expect(cats.box.saves).toBe(0)
    expect(cats.box.read()[0].name).toBe("未分组")
  })
})
