/**
 * dataSnapshot 模块 i18n 键清单与类型化取值
 */
import type { Plugin } from "siyuan"

/** 面板用到的 i18n 键（唯一清单：类型与缺失时的空值兜底均由它派生） */
const I18N_KEYS = [
  "title",
  "createSnapshot",
  "memoPlaceholder",
  "memo",
  "noSnapshots",
  "noCloudSnapshots",
  "view",
  "restore",
  "restoreTitle",
  "restoreConfirm",
  "restoring",
  "restoreSuccess",
  "restoreFailed",
  "download",
  "downloading",
  "downloadSuccess",
  "downloadFailed",
  "removeCloudTag",
  "removeCloudTagTitle",
  "removeCloudTagConfirm",
  "removeSuccess",
  "removeFailed",
  "snapshotDetail",
  "snapshotFiles",
  "createdAt",
  "refresh",
  "refreshing",
  "createSuccess",
  "createFailed",
  "confirmRestore",
  "cancel",
  "tabLocal",
  "tabCloud",
  "size",
  "tagUpdated",
  "device",
  "typesDistribution",
  "fileCount",
] as const

/** i18n 键字面量类型 */
export type DataSnapshotI18nKey = (typeof I18N_KEYS)[number]

/** 数据快照面板文案：值恒为 string（键缺失时为空串，UI 自然降级） */
export type DataSnapshotI18n = Record<DataSnapshotI18nKey, string>

/**
 * 从插件实例读取数据快照文案：仅取白名单键，缺失键补空串。
 * i18n 是文案唯一数据源，不回退硬编码中文（见 AGENTS_I18N.md 强制规则）
 */
export function getDataSnapshotI18n(plugin: Plugin): DataSnapshotI18n {
  const shard = (plugin.i18n as Record<string, unknown> | undefined)?.dataSnapshot as
    | Partial<DataSnapshotI18n>
    | undefined
  const result = {} as DataSnapshotI18n
  for (const key of I18N_KEYS) {
    result[key] = shard?.[key] ?? ""
  }
  return result
}
