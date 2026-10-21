// 缓存扫描/清理的诊断日志：统一前缀，便于在 DevTools 控制台按 "[cacheClean]" 过滤检索
//
// 分级约定（决定控制台噪音上限，务必遵守）：
//   info  → 生命周期里程碑：任务开始 / 每根完成 / 汇总 / 回收站通道
//   warn  → 单条目可恢复失败：删除守卫拒绝 / 删除失败 / 目录不可读
//   error → 整体任务抛错（只在 tasks.ts 的 catch 中记录）
//
// ⚠️ 禁止在逐条目成功路径上打 info —— 单次清理可达 3000 条，会刷爆控制台。
// 本文件**不 import 任何会触达 siyuan / DOM 的模块**（才能在纯 Node 单测中加载）。

/** 控制台检索前缀（日志过滤的唯一锚点，勿在别处另起前缀） */
export const CACHE_LOG_TAG = "[cacheClean]"

const withTag = (message: string): string => `${CACHE_LOG_TAG} ${message}`

/** 生命周期日志 */
export function logInfo(message: string, detail?: unknown): void {
  if (detail === undefined) {
    console.info(withTag(message))
    return
  }
  console.info(withTag(message), detail)
}

/** 单条目可恢复失败（不中断整体任务） */
export function logWarn(message: string, detail?: unknown): void {
  if (detail === undefined) {
    console.warn(withTag(message))
    return
  }
  console.warn(withTag(message), detail)
}

/** 整体任务失败 */
export function logError(message: string, detail?: unknown): void {
  if (detail === undefined) {
    console.error(withTag(message))
    return
  }
  console.error(withTag(message), detail)
}
