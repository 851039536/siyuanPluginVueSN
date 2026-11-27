/**
 * 传输批处理骨架单元测试
 *
 * 覆盖软取消、失败收集、字节分数聚合与不定态判定 —— 上传/下载共用的语义，
 * 全部用例注入假任务，不触网、不碰文件系统。
 */
import { describe, it, expect } from "vitest"
import { runTransferBatch } from "./transferBatch"
import type { TransferTask } from "./transferBatch"

/** 构造任务：默认立即成功（不回报字节分数） */
function task(label: string, run?: TransferTask["run"]): TransferTask {
  return {
    key: label,
    label,
    run: run ?? (async () => undefined),
  }
}

/** 采集进度上报的假 report */
function collector() {
  const calls: Array<{ currentFile: string; done: number; total: number; fractionSum: number; indeterminate: boolean }> = []
  const report = (
    _label: string,
    currentFile: string,
    done: number,
    total: number,
    fractionSum: number,
    indeterminate: boolean,
  ): void => {
    calls.push({ currentFile, done, total, fractionSum, indeterminate })
  }
  return { calls, report }
}

describe("runTransferBatch", () => {
  it("全部成功：failed 为空、successCount 计满、done 推进到任务数", async () => {
    const { calls, report } = collector()
    const result = await runTransferBatch([task("a"), task("b"), task("c")], {
      label: "上传中",
      isCancelled: () => false,
      report,
    })

    expect(result.failed).toEqual([])
    expect(result.successCount).toBe(3)
    expect(calls[calls.length - 1]).toMatchObject({ done: 3, total: 3 })
  })

  it("单个任务失败不中断整批：计入 failed、其余照常成功", async () => {
    const errors: Array<{ key: string; error: unknown }> = []
    const { report } = collector()
    const result = await runTransferBatch(
      [
        task("ok-1"),
        task("bad", async () => { throw new Error("boom") }),
        task("ok-2"),
      ],
      {
        label: "上传中",
        isCancelled: () => false,
        report,
        onTaskError: (t, err) => errors.push({ key: t.key, error: err }),
      },
    )

    expect(result.failed).toEqual(["bad"])
    expect(result.successCount).toBe(2)
    expect(errors).toHaveLength(1)
    expect(errors[0].key).toBe("bad")
    expect((errors[0].error as Error).message).toBe("boom")
  })

  it("取消标志恒真：一个任务都不开始，且不算失败", async () => {
    let started = 0
    const { report } = collector()
    const result = await runTransferBatch(
      [task("a", async () => { started++ }), task("b", async () => { started++ })],
      { label: "下载中", isCancelled: () => true, report },
    )

    expect(started).toBe(0)
    expect(result.successCount).toBe(0)
    expect(result.failed).toEqual([])
  })

  it("取消发生在批次进行中：已开始的任务照常计数，未开始的不计入失败", async () => {
    let calls = 0
    const { report } = collector()
    const result = await runTransferBatch(
      [task("a"), task("b"), task("c")],
      {
        label: "下载中",
        // 并发 2：前两次判定放行（a、b 同时占满两个 worker），第三个任务开始前判定为取消
        isCancelled: () => ++calls > 2,
        report,
      },
    )

    expect(result.successCount).toBe(2)
    expect(result.failed).toEqual([])
  })

  it("并发任务的字节分数求和后参与进度，避免进度回退", async () => {
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => { release = resolve })
    const { calls, report } = collector()
    const fractionTask = (label: string): TransferTask => ({
      key: label,
      label,
      run: async (onProgress) => {
        onProgress(0.5)
        await gate
      },
    })

    const pending = runTransferBatch([fractionTask("a"), fractionTask("b")], {
      label: "上传中",
      isCancelled: () => false,
      report,
    })

    // 两个 worker 都已启动并各回报 0.5：done 仍为 0，分数和应为 1
    const inFlight = calls[calls.length - 1]
    expect(inFlight.done).toBe(0)
    expect(inFlight.fractionSum).toBeCloseTo(1)

    release?.()
    const result = await pending
    expect(result.successCount).toBe(2)
  })

  it("不定态判定收到的是任务总数（下载侧单文件未知字节量时用）", async () => {
    const { calls, report } = collector()
    await runTransferBatch([task("only")], {
      label: "下载中",
      isCancelled: () => false,
      report,
      isIndeterminate: (taskCount) => taskCount === 1,
    })

    expect(calls.every((c) => c.indeterminate)).toBe(true)
    expect(calls.every((c) => c.total === 1)).toBe(true)
  })

  it("空任务列表：不调用进度上报，直接返回空结果", async () => {
    const { calls, report } = collector()
    const result = await runTransferBatch([], { label: "上传中", isCancelled: () => false, report })

    expect(calls).toEqual([])
    expect(result).toEqual({ failed: [], successCount: 0 })
  })
})
