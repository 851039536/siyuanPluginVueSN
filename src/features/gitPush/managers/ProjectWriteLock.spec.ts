// 项目级写锁的单测：纯 Promise 编排，不启动任何 git 进程
//
// 锁住四件事（都是「看起来没事、出问题却极难复现」的那类）：
//   1. 同一目录的不同写法必须落进**同一条**串行链（Windows 大小写/斜杠/尾斜杠）；
//   2. 不同目录不得互相阻塞（读写并行是设计前提）；
//   3. 前驱失败不阻塞后续任务，且错误语义原样抛给调用方；
//   4. 链 settle 后要回收键，否则长会话里项目反复增删会让 Map 无界增长。
import { describe, expect, it } from "vitest"
import { ProjectWriteLock } from "./ProjectWriteLock"

const sleep = (ms: number) => new Promise<void>((r) => { setTimeout(r, ms) })

/** 读取私有 chains（白盒：这里要断言的正是「有没有残留条目」，没有公开访问器也无需为测试加接口） */
function chainsOf(lock: ProjectWriteLock): Map<string, unknown> {
  return (lock as unknown as { chains: Map<string, unknown> }).chains
}

describe("ProjectWriteLock", () => {
  it("同一目录的不同写法（大小写 / 反斜杠 / 尾斜杠）必须互斥", async () => {
    const lock = new ProjectWriteLock()
    const order: string[] = []

    const first = lock.runExclusive("E:\\Repo\\App", async () => {
      order.push("a-start")
      await sleep(30)
      order.push("a-end")
    })
    const second = lock.runExclusive("e:/repo/app/", async () => {
      order.push("b-start")
      order.push("b-end")
    })
    await Promise.all([first, second])

    // 若 key 未归一化，两次任务会并发，顺序变成 a-start/b-start/a-end/b-end
    expect(order).toEqual(["a-start", "a-end", "b-start", "b-end"])
  })

  it("不同目录可以并行（互不阻塞）", async () => {
    const lock = new ProjectWriteLock()
    const started: string[] = []

    await Promise.all([
      lock.runExclusive("E:/repo-a", async () => {
        started.push("a")
        await sleep(30)
      }),
      lock.runExclusive("E:/repo-b", async () => {
        started.push("b")
        await sleep(30)
      }),
    ])

    expect(started.sort()).toEqual(["a", "b"])
  })

  it("前驱失败不阻塞后续任务，且错误原样抛出", async () => {
    const lock = new ProjectWriteLock()

    const failed = lock.runExclusive("E:/repo", async () => {
      throw new Error("boom")
    })
    await expect(failed).rejects.toThrow("boom")
    await expect(lock.runExclusive("E:/repo", async () => "ok")).resolves.toBe("ok")
  })

  it("链 settle 后回收键，不随项目数无界增长", async () => {
    const lock = new ProjectWriteLock()
    const chains = chainsOf(lock)

    await lock.runExclusive("E:/repo", async () => 1)
    await sleep(0)

    expect(chains.size).toBe(0)
  })

  it("回收不会误删期间挂上的新链尾", async () => {
    const lock = new ProjectWriteLock()
    const chains = chainsOf(lock)

    const first = lock.runExclusive("E:/repo", async () => {
      await sleep(20)
    })
    // 第一个任务还在跑时追加第二个：新链尾不能被第一条的回收逻辑删掉
    const second = lock.runExclusive("E:/repo", async () => {
      await sleep(20)
    })
    await first
    expect(chains.size).toBe(1)
    await second
    await sleep(0)
    expect(chains.size).toBe(0)
  })

  it("destroy 后拒绝新任务", async () => {
    const lock = new ProjectWriteLock()
    lock.destroy()
    await expect(lock.runExclusive("E:/repo", async () => 1)).rejects.toThrow("已卸载")
  })
})
