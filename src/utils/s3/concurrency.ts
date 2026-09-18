/**
 * 并发与主机名共享工具（共享层）
 *
 * 从 s3Backup/utils.ts 提升的简易并发池、主机名获取（模块级缓存）与传输重试执行器，
 * 供 s3Backup / s3FileManager 等功能模块共用。
 */
import { getNodeProcessModules } from "@/utils/nodeModules"
import { TRANSFER_MAX_RETRIES } from "./types"

/** 缓存的主机名（进程生命周期内不变，避免重复 require os 模块） */
let _hostname: string | null = null

/** 获取本机主机名（非 Node 环境返回空串） */
export function getHostname(): string {
  if (_hostname === null) {
    _hostname = getNodeProcessModules()?.os?.hostname() || ""
  }
  return _hostname
}

/** 简易并发池：以固定并发数执行任务列表（上传/下载/批量对象操作共用） */
export async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0
  const lanes = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++]
      await worker(item)
    }
  })
  await Promise.all(lanes)
}

/** 重试结果：`ok` 为是否成功；失败时 `error` 为最后一次的异常（供调用方决定抛错或记警告） */
export interface RetryResult {
  ok: boolean
  error?: unknown
}

/**
 * 带重试执行单个传输任务（上传/下载/删除共用）。
 * 出口语义由调用方决定：s3Backup 记警告并返回 false，s3FileManager 抛出 `error`。
 */
export async function runWithRetries(
  task: () => Promise<void>,
  maxRetries: number = TRANSFER_MAX_RETRIES,
): Promise<RetryResult> {
  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await task()
      return { ok: true }
    } catch (err) {
      lastError = err
    }
  }
  return { ok: false, error: lastError }
}
