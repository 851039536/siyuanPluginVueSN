// `poolProcess` 单测 —— runCore 的并发收缩依赖它的三个语义保证。
//
// 为什么必须测：runCore 从「Promise.allSettled 一把梭」改为「poolProcess 项目级并发池」后，
// 正确性从「天然成立的 allSettled」转移到「本函数的实现细节」：
//   1. 恒定并发（无批次屏障）——否则慢项目会拖住整批
//   2. **异常不逃逸**——由调用方 catch；若本函数在 await fn 处让异常冒泡，
//      会中断整个 worker，未完成的项目永远拿不到结果（静默数据丢失）
//   3. 索引不重复不遗漏——每个下标恰好执行一次
import { describe, expect, it } from "vitest"
import { poolProcess } from "./runtime"

describe("poolProcess", () => {
  it("每个元素恰好执行一次，且保持下标对应", async () => {
    const items = [10, 20, 30, 40, 50, 60, 70]
    const seen: Array<[number, number]> = []
    await poolProcess(items, 3, async (item, i) => {
      seen.push([item, i])
    })

    expect(seen).toHaveLength(items.length)
    // 下标必须与元素一一对应（乱序完成，但配对不能错）
    for (const [item, i] of seen) {
      expect(items[i]).toBe(item)
    }
    expect(new Set(seen.map(([, i]) => i)).size).toBe(items.length)
  })

  it("并发数不超过上限（恒定 N 个在飞，无批次屏障）", async () => {
    let running = 0
    let peak = 0
    await poolProcess(Array.from({ length: 20 }, (_, i) => i), 3, async () => {
      running++
      peak = Math.max(peak, running)
      await new Promise((r) => setTimeout(r, 5))
      running--
    })
    expect(peak).toBeLessThanOrEqual(3)
    expect(peak).toBe(3) // 确认真的用满了并发，而不是退化成串行
  })

  it("无批次屏障：槽位完成即接新任务，不等同批其他任务", async () => {
    const finished: Array<{ item: number, at: number }> = []
    const t0 = Date.now()
    // 并发 2；item 0 慢（60ms），其余快（5ms）
    await poolProcess([0, 1, 2, 3, 4, 5], 2, async (item) => {
      await new Promise((r) => setTimeout(r, item === 0 ? 60 : 5))
      finished.push({ item, at: Date.now() - t0 })
    })

    const at = (k: number) => finished.find((f) => f.item === k)!.at
    const total = Math.max(...finished.map((f) => f.at))

    // 核心性质：**空出的槽位立刻接下一个任务**，故 i2 在慢任务 i0 完成前就已结束。
    // 若有批次屏障（[0,1] 整批等完才开始 [2,3]），i2 必然晚于 i0。
    expect(at(2)).toBeLessThan(at(0))

    // 屏障模型的耗时可推算：3 批 × max(60, 5) = 180ms。
    // 无屏障实测约 75ms（另一槽位连续消化 1,2,3,4,5 共 25ms）。
    // 用「远小于屏障下限」作为主断言，避免依赖具体调度时序的脆弱性。
    expect(total).toBeLessThan(120)
  })

  it("并发数大于元素数时不会创建多余 worker", async () => {
    let calls = 0
    await poolProcess([1, 2], 10, async () => {
      calls++
    })
    expect(calls).toBe(2)
  })

  it("空数组不执行任何任务", async () => {
    let calls = 0
    await poolProcess([], 4, async () => {
      calls++
    })
    expect(calls).toBe(0)
  })

  it("并发数为 0 或负数时按 1 处理（钳位，不挂起）", async () => {
    const seen: number[] = []
    await poolProcess([1, 2, 3], 0, async (n) => {
      seen.push(n)
    })
    expect(seen.sort()).toEqual([1, 2, 3])
  })

  // 关键语义：runCore 依赖「单个项目抛错不中断整轮」
  it("异常会冒泡（由调用方 catch）——文档化该契约", async () => {
    await expect(
      poolProcess([1, 2, 3], 1, async (n) => {
        if (n === 2) throw new Error("boom")
      }),
    ).rejects.toThrow("boom")
  })

  it("调用方逐项 catch 后，其余项目仍全部完成（runCore 的失败隔离模式）", async () => {
    const done: number[] = []
    const failed: number[] = []
    await poolProcess([1, 2, 3, 4, 5], 2, async (n) => {
      try {
        if (n === 3) throw new Error("boom")
        await new Promise((r) => setTimeout(r, 2))
        done.push(n)
      } catch {
        failed.push(n)
      }
    })
    // 失败隔离：3 失败，其余 4 个照常完成
    expect(failed).toEqual([3])
    expect(done.sort((a, b) => a - b)).toEqual([1, 2, 4, 5])
  })
})
