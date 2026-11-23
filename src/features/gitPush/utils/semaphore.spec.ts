// semaphore.spec.ts — 按需 diff 的并发槽位
import { describe, expect, it } from "vitest"
import { createSemaphore } from "./semaphore"

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe("createSemaphore", () => {
  it("上限内的请求立即放行", async () => {
    const sem = createSemaphore(2)
    const r1 = await sem.acquire()
    const r2 = await sem.acquire()
    expect(typeof r1).toBe("function")
    r1()
    r2()
  })

  it("超出的请求排队，释放后按序转交槽位", async () => {
    const sem = createSemaphore(1)
    const release1 = await sem.acquire()
    const order: number[] = []
    const p2 = sem.acquire().then((release) => {
      order.push(2)
      return release
    })
    const p3 = sem.acquire().then((release) => {
      order.push(3)
      return release
    })
    await flush()
    expect(order).toEqual([])

    release1()
    const release2 = await p2
    expect(order).toEqual([2])
    release2()
    const release3 = await p3
    expect(order).toEqual([2, 3])
    release3()
  })
})
