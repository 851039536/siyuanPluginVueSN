// ProjectStore 写放大守卫单测（P2-1）
//
// 背景：`recordLastActivity` / `applyRemotes` / `refreshRemotes` 原实现无条件
// `saveProjects`，即「全量序列化整份项目 JSON + 失效缓存」。后果：
//   · 每次 loadLog 后回传最近活动时间都写一次盘（多数刷新并无新提交）；
//   · 「刷新全部远程」N 个项目 = N 次全量写，且 `git remote -v` 还在写锁内串行，
//     一个本地 git 进程会把其他项目的提交/编辑一起堵住。
// 本文件锁住三条不变量：时间未变不写、远程未变不写、探测不在写锁内。
import type { GitProject, GitPushStorage, GitRemoteInfo } from "../types/storage"
import type { GitExecutor } from "./GitExecutor"
import { describe, expect, it } from "vitest"
import { UNGROUPED_ID } from "../types/storage"
import { ProjectStore } from "./ProjectStore"

interface SlotBox<T> {
  value: T
  saves: number
}

function makeSlot<T>(initial: T) {
  const box: SlotBox<T> = { value: initial, saves: 0 }
  const slot = {
    loadOrDefault: async () => box.value,
    load: async () => box.value,
    save: async (next: T) => {
      box.saves++
      box.value = next
      return true
    },
  }
  return { box, slot }
}

function makeStore(init: { projects: GitProject[], executor?: GitExecutor }) {
  const projects = makeSlot(init.projects)
  const categories = makeSlot([{ id: UNGROUPED_ID, name: "未分组", color: "#888888", order: 0 }])
  const tags = makeSlot<string[]>([])
  const templates = makeSlot([])
  const storage = {
    projects: projects.slot,
    categories: categories.slot,
    tags: tags.slot,
    commitTemplates: templates.slot,
  } as unknown as GitPushStorage
  const store = new ProjectStore(storage, init.executor ?? ({} as GitExecutor))
  return { store, projects }
}

function project(overrides: Partial<GitProject> = {}): GitProject {
  return {
    id: "p1",
    name: "Repo",
    path: "E:/code/repo",
    categoryId: UNGROUPED_ID,
    addedAt: 1000,
    ...overrides,
  }
}

function remote(name: string, flags: Partial<GitRemoteInfo> = {}): GitRemoteInfo {
  return {
    name,
    url: `https://example.com/${name}.git`,
    isGithub: false,
    isGitee: false,
    isCnb: false,
    isGitea: false,
    ...flags,
  }
}

describe("ProjectStore 写放大守卫", () => {
  it("lastActivity 未变化：不落盘", async () => {
    const { store, projects } = makeStore({
      projects: [project({ lastActivity: "2026-01-01T00:00:00Z" })],
    })
    await store.recordLastActivity("p1", "2026-01-01T00:00:00Z")
    expect(projects.box.saves).toBe(0)
    expect(projects.box.value[0].lastActivity).toBe("2026-01-01T00:00:00Z")
  })

  it("lastActivity 变化：落盘一次", async () => {
    const { store, projects } = makeStore({
      projects: [project({ lastActivity: "2026-01-01T00:00:00Z" })],
    })
    await store.recordLastActivity("p1", "2026-02-02T00:00:00Z")
    expect(projects.box.saves).toBe(1)
    expect(projects.box.value[0].lastActivity).toBe("2026-02-02T00:00:00Z")
  })

  it("远程映射未变化：applyRemotes 不落盘", async () => {
    const { store, projects } = makeStore({
      projects: [project({ githubRemote: "origin" })],
    })
    const updated = await store.applyRemotes("p1", [remote("origin", { isGithub: true })])
    expect(updated?.githubRemote).toBe("origin")
    expect(projects.box.saves).toBe(0)
  })

  it("远程映射变化：applyRemotes 落盘一次并写入新远程名", async () => {
    const { store, projects } = makeStore({
      projects: [project({ githubRemote: "origin" })],
    })
    const updated = await store.applyRemotes("p1", [remote("mirror", { isGithub: true })])
    expect(updated?.githubRemote).toBe("mirror")
    expect(projects.box.saves).toBe(1)
    expect(projects.box.value[0].githubRemote).toBe("mirror")
  })

  it("远程消失：applyRemotes 清空对应远程名并落盘", async () => {
    const { store, projects } = makeStore({
      projects: [project({ githubRemote: "origin" })],
    })
    const updated = await store.applyRemotes("p1", [])
    expect(updated?.githubRemote).toBeUndefined()
    expect(projects.box.saves).toBe(1)
  })

  it("refreshRemotes 的 git 探测在写锁外：期间其他写操作不被阻塞", async () => {
    let release: () => void = () => {}
    let markStarted: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const started = new Promise<void>((resolve) => {
      markStarted = resolve
    })
    const executor = {
      execGit: async () => {
        // 模拟一次慢 `git remote -v`：卡在 gate 上，直到本用例放行
        markStarted()
        await gate
        return "origin\thttps://github.com/a/b.git (fetch)\n"
      },
    } as unknown as GitExecutor
    const { store, projects } = makeStore({ projects: [project()], executor })

    const refreshing = store.refreshRemotes("p1")
    // 等到 `git remote -v` 真的发出（此时它已不在写锁内）
    await started

    // 若探测仍在写锁内，这次 toggleStar 会一直等到 release() 之后 —— 用竞速断言
    const starred = await Promise.race([
      store.toggleStar("p1").then(() => "done" as const),
      new Promise<"blocked">((resolve) => setTimeout(() => resolve("blocked"), 300)),
    ])
    expect(starred).toBe("done")
    expect(projects.box.saves).toBe(1)

    release()
    const updated = await refreshing
    // origin 命中 github 平台 → 探测结果写回项目（第二次落盘）
    expect(updated?.githubRemote).toBe("origin")
    expect(projects.box.saves).toBe(2)
  })

  it("探测期间项目路径被改：丢弃旧路径探测出的远程映射", async () => {
    let release: () => void = () => {}
    let markStarted: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const started = new Promise<void>((resolve) => {
      markStarted = resolve
    })
    const executor = {
      execGit: async () => {
        markStarted()
        await gate
        // 旧路径仓库上的 origin
        return "origin\thttps://github.com/a/b.git (fetch)\n"
      },
    } as unknown as GitExecutor
    const { store, projects } = makeStore({ projects: [project()], executor })

    const refreshing = store.refreshRemotes("p1")
    await started
    // 探测还在飞：用户把项目改指向另一个仓库（此时 origin 属于旧仓库，不该带过来）
    await store.updateProjectMeta("p1", { path: "E:/code/other" })
    release()

    const updated = await refreshing
    expect(updated?.githubRemote).toBeUndefined()
    expect(projects.box.value[0].path).toBe("E:/code/other")
    // 只有 updateProjectMeta 那一次落盘（远程映射被复核拦下，不产生第二次写）
    expect(projects.box.saves).toBe(1)
  })
})
