// everythingSearch 功能级诊断日志：统一前缀 + 三档分级，供本功能各层复用。
//
// 缓存扫描/清理使用独立的 `[cacheClean]` 前缀（见 cacheScan/log.ts，README 已登记），
// 两者都由本文件的 `createLogger` 构造，避免各写一套 console 分支。
// 本文件**不 import 任何会触达 siyuan / DOM 的模块**（才能在纯 Node 单测中加载）。

/** 日志级别 */
type LogLevel = "info" | "warn" | "error"

/** 分级日志器（`detail` 仅在需要展开对象时传入） */
export interface Logger {
  info: (message: string, detail?: unknown) => void
  warn: (message: string, detail?: unknown) => void
  error: (message: string, detail?: unknown) => void
}

/**
 * 按前缀构造日志器。
 * 省略 `detail` 时不额外传参，避免控制台出现孤立的 `undefined`。
 */
export function createLogger(tag: string): Logger {
  const write = (level: LogLevel, message: string, detail?: unknown): void => {
    const line = `${tag} ${message}`
    if (detail === undefined) console[level](line)
    else console[level](line, detail)
  }

  return {
    info: (message, detail) => write("info", message, detail),
    warn: (message, detail) => write("warn", message, detail),
    error: (message, detail) => write("error", message, detail),
  }
}

/** 功能级日志前缀（控制台检索锚点） */
export const FEATURE_LOG_TAG = "[everythingSearch]"

/** 功能级日志器 */
export const log: Logger = createLogger(FEATURE_LOG_TAG)
