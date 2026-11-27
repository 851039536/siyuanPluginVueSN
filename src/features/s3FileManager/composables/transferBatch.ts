/**
 * 传输批处理骨架（上传/下载共用）
 *
 * 从 useS3Transfer 中抽出，独立成文件的两个原因：
 *   1. 与 Vue / siyuan / Electron 完全无关（只依赖共享并发池），可直接单元测试；
 *   2. 软取消、字节分数聚合、失败收集这套语义是传输链路的公共部分，
 *      上传与下载此前各写一遍，改一处容易漏另一处。
 */
import { runWithConcurrency } from "@/utils/s3/concurrency"
import { TRANSFER_CONCURRENCY } from "../types"

/** 批处理中的单个传输任务 */
export interface TransferTask {
  /** 聚合进度用的唯一标识（上传为对象 key，下载为目标本地路径） */
  key: string
  /** 进度条上展示的文件名 */
  label: string
  /** 失败日志附加上下文（上传为本地绝对路径；下载不需要，缺省用 key） */
  context?: string
  /** 执行本体；onProgress 回传 0~1 的字节分数（总量未知时可不调用） */
  run: (onProgress: (fraction: number) => void) => Promise<void>
}

/** 批处理结果 */
export interface TransferBatchResult {
  /** 失败任务的展示名（按发生顺序） */
  failed: string[]
  /** 成功完成的任务数 */
  successCount: number
}

/** 批处理依赖 */
export interface TransferBatchDeps {
  /** 进度主文案（"上传中" / "下载中"） */
  label: string
  /** 软取消标志判定 */
  isCancelled: () => boolean
  /** 进度上报（转发给面板进度条与状态栏任务） */
  report: (
    label: string,
    currentFile: string,
    done: number,
    total: number,
    fractionSum: number,
    indeterminate: boolean,
  ) => void
  /** 是否切不定态（下载侧：单任务且字节总量未知时） */
  isIndeterminate?: (taskCount: number) => boolean
  /** 单任务失败回调（打印可诊断上下文；失败清单由本函数统一收集） */
  onTaskError?: (task: TransferTask, err: unknown) => void
}

/**
 * 批量执行传输任务：软取消 + 字节分数聚合 + 失败收集。
 *
 * 软取消语义：取消标志置真后，worker 在**下一个任务开始前**退出，在途任务不中断
 * （共享层无 abort 通道）。未开始的任务不计入失败，已开始的照常计数与上报。
 *
 * 进度百分比按「已完成数 + 全部进行中任务的字节分数之和」计算，避免并发任务
 * 交替上报导致进度条回退。
 *
 * 单个任务抛错不会中断整批：错误经 onTaskError 上报，展示名计入 failed。
 */
export async function runTransferBatch(
  tasks: TransferTask[],
  deps: TransferBatchDeps,
): Promise<TransferBatchResult> {
  /** 进行中任务的字节分数（key → 0~1） */
  const fractions = new Map<string, number>()
  const failed: string[] = []
  let done = 0
  let successCount = 0

  /** 上报当前聚合进度（done + 全部进行中任务分数之和） */
  const reportCurrent = (currentFile: string): void => {
    let fractionSum = 0
    for (const f of fractions.values()) { fractionSum += f }
    deps.report(deps.label, currentFile, done, tasks.length, fractionSum, deps.isIndeterminate?.(tasks.length) ?? false)
  }

  await runWithConcurrency(tasks, TRANSFER_CONCURRENCY, async (task) => {
    // 软取消：取消后不再开始新任务（在途文件不做硬中断）
    if (deps.isCancelled()) { return }
    try {
      fractions.set(task.key, 0)
      reportCurrent(task.label)
      await task.run((fraction) => {
        fractions.set(task.key, fraction)
        reportCurrent(task.label)
      })
      successCount++
    } catch (err) {
      deps.onTaskError?.(task, err)
      failed.push(task.label)
    } finally {
      fractions.delete(task.key)
    }
    done++
    reportCurrent(task.label)
  })

  return { failed, successCount }
}
