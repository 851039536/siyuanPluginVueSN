/**
 * 全局锁定密码的共享存储入口
 *
 * 该 key 由 pageLock 写入、generalSettings 只读展示，属于跨功能共享槽位。
 * 任何一侧都不得在「恢复默认」时删除它（会使用户已锁定的文档永久无法解锁）。
 */
import type { Plugin } from "siyuan"
import { PluginStorage } from "./pluginStorage"

export const GLOBAL_PASSWORD_KEY = "global-password"

export interface GlobalPasswordRecord {
  hash: string
  salt: string
}

export function isGlobalPasswordRecord(value: unknown): value is GlobalPasswordRecord {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  return typeof record.hash === "string" && typeof record.salt === "string"
}

/** 读取全局密码哈希记录；未设置或数据形态异常时返回 null */
export async function readGlobalPasswordRecord(plugin: Plugin): Promise<GlobalPasswordRecord | null> {
  const data = await new PluginStorage(plugin).load<unknown>(GLOBAL_PASSWORD_KEY)
  return isGlobalPasswordRecord(data) ? data : null
}
