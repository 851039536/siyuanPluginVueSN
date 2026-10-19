/**
 * 并发与主机名共享工具（共享层）
 *
 * 从 s3Backup/utils.ts 提升的简易并发池、主机名获取（模块级缓存）与传输重试执行器，
 * 供 s3Backup / s3FileManager 等功能模块共用。
 */
import { getNodeProcessModules } from "@/utils/nodeModules"
import { TRANSFER_MAX_RETRIES } from "./types"
import { S3HttpError } from "./s3Protocol"

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

/** 重试退避策略：首次延迟与抖动幅度 */
const RETRY_BASE_DELAY_MS = 300
const RETRY_MAX_DELAY_MS = 3000

/**
 * 默认可重试判定。
 *
 * - 无 status 的错误 = 网络层异常（断网/超时/DNS），可重试；
 * - `S3HttpError` 携带 HTTP 状态码：5xx / 429 服务端侧可重试，403/404 等 4xx 重试不可能成功；
 * - 其余（编程错误等）不重试。
 */
function isRetryableError(err: unknown): boolean {
  if (err instanceof S3HttpError) {
    return err.status >= 500 || err.status === 429
  }
  // 网络层错误没有 status；S3HttpError 之外的 Error 一律视为传输层可重试
  return true
}

/**
 * 带重试执行单个传输任务（上传/下载/删除共用）。
 * 出口语义由调用方决定：s3Backup 记警告并返回 false，s3FileManager 抛出 `error`。
 *
 * 仅对「可重试错误」重试（默认判定见 isRetryableError，可用 `isRetryable` 覆盖）：
 * 403/404/签名错误等永久性失败立即返回，不再盲试拉长反馈；
 * 重试间按指数退避 + 抖动等待，避免对过载的服务端雪上加霜。
 */
export async function runWithRetries(
  task: () => Promise<void>,
  maxRetries: number = TRANSFER_MAX_RETRIES,
  isRetryable: (err: unknown) => boolean = isRetryableError,
): Promise<RetryResult> {
  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      // 指数退避 + 抖动：防止同批失败任务同步重试打到已过载的服务端
      const backoff = Math.min(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1), RETRY_MAX_DELAY_MS)
      const delay = backoff + Math.floor(Math.random() * RETRY_BASE_DELAY_MS)
      await new Promise<void>((resolve) => setTimeout(resolve, delay))
    }
    try {
      await task()
      return { ok: true }
    } catch (err) {
      lastError = err
      if (!isRetryable(err)) { return { ok: false, error: err } }
    }
  }
  return { ok: false, error: lastError }
}
