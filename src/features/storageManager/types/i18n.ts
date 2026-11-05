/**
 * 数据管理 - i18n 读取
 */
import type { Plugin } from "siyuan"

export interface StorageManagerI18n {
  [key: string]: any
}

export function getStorageManagerI18n(plugin: Plugin): StorageManagerI18n {
  return ((plugin.i18n as any)?.storageManager ?? {}) as StorageManagerI18n
}
