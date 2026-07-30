/**
 * 并发与主机名共享工具（共享层）
 *
 * 从 s3Backup/utils.ts 提升的简易并发池与主机名获取（模块级缓存），
 * 供 s3Backup / s3FileManager 等功能模块共用。
 */
import { getNodeProcessModules } from "@/utils/nodeModules"

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
