/**
 * S3 文件管理器 i18n 键清单与类型化取值
 *
 * 照 `dataSnapshot/types/i18n.ts` 的既有范式：常量键数组是唯一清单，
 * 键字面量类型与"缺失补空串"的兜底都由它派生。
 *
 * 为什么不再用 `Record<string, string>`：那种写法下拼错键（`i18n.uploadSucess`）
 * 不报错、运行时得到 undefined，且 `"undefined"` 会被直接拼进提示文案
 * （如 `i18n.overwriteConfirm + "\n" + ...`）。此处改为白名单后，拼错即编译失败。
 *
 * 清单覆盖该命名空间全部键：其中 `s3FileManager` / `description` 供 FEATURE_CONFIG
 * 的标题与描述、`enableS3FileManager` 供设置面板使用，与面板共用同一个 shard。
 */
import type { Plugin } from "siyuan"

/** 命名空间内全部 i18n 键（与 src/i18n/{zh_CN,en_US}/s3FileManager.json 一一对应） */
const I18N_KEYS = [
  "s3FileManager",
  "description",
  "notConfiguredGuide",
  "clientNotInitialized",
  "desktopOnly",
  "upload",
  "download",
  "newFolder",
  "copy",
  "move",
  "rename",
  "delete",
  "refresh",
  "up",
  "backToRoot",
  "viewDetails",
  "viewIcons",
  "toolbarLabel",
  "contextMenuLabel",
  "close",
  "loadMore",
  "itemsUnit",
  "selectedPrefix",
  "colName",
  "colSize",
  "colDate",
  "emptyFolder",
  "menuOpen",
  "configTitle",
  "logTitle",
  "endpoint",
  "endpointHint",
  "accessKey",
  "secretKey",
  "bucket",
  "bucketHint",
  "region",
  "regionHint",
  "prefix",
  "prefixHint",
  "pathStyle",
  "useSSL",
  "allowSelfSigned",
  "uploadTimeoutSec",
  "testConnection",
  "testException",
  "testConnected",
  "testConnectedViaList",
  "testAuthFailed",
  "testBucketMissing",
  "testHttpFailed",
  "save",
  "saveFailed",
  "configSaved",
  "configLoadFailed",
  "cancel",
  "confirm",
  "importFromBackup",
  "importFromBackupHint",
  "importSuccess",
  "importNoBackupConfig",
  "namePlaceholder",
  "invalidName",
  "createFolderSuccess",
  "moveTo",
  "copyTo",
  "targetLabel",
  "noSubFolders",
  "targetListFailed",
  "destInsideSelf",
  "destSameAsSource",
  "actionUpload",
  "actionDownload",
  "actionCreateFolder",
  "actionRename",
  "actionCopy",
  "actionMove",
  "actionDelete",
  "statusUploading",
  "statusDownloading",
  "statusCopying",
  "statusDeleting",
  "uploadSuccess",
  "uploadFailed",
  "downloadSuccess",
  "downloadFailed",
  "copySuccess",
  "copyFailed",
  "moveSuccess",
  "moveFailed",
  "moveDeleteFailed",
  "renameSuccess",
  "renameFailed",
  "deleteSuccess",
  "deleteFailed",
  "confirmDelete",
  "overwriteConfirm",
  "cancelTransfer",
  "uploadCancelled",
  "downloadCancelled",
  "nameExists",
  "searchPlaceholder",
  "openFolder",
  "openFolderFailed",
  "pickUploadFiles",
  "pickDownloadDir",
  "dropToUpload",
  "logSucceed",
  "logFailed",
  "noLogs",
  "clearLogs",
  "confirmClearLogs",
  "logsCleared",
  "failedList",
  "omittedPrefix",
  "enableS3FileManager",
] as const

/** i18n 键字面量类型 */
export type S3FileManagerI18nKey = (typeof I18N_KEYS)[number]

/** S3 文件管理器文案：值恒为 string（键缺失时为空串，UI 自然降级而非渲染 "undefined"） */
export type S3FileManagerI18n = Record<S3FileManagerI18nKey, string>

/**
 * 从插件实例读取本模块文案：仅取白名单键，缺失键补空串。
 * i18n 是文案唯一数据源，不回退硬编码中文（见 AGENTS_I18N.md 强制规则）。
 */
export function getS3FileManagerI18n(plugin: Plugin): S3FileManagerI18n {
  const shard = (plugin.i18n as Record<string, unknown> | undefined)?.s3FileManager as
    | Partial<S3FileManagerI18n>
    | undefined
  const result = {} as S3FileManagerI18n
  for (const key of I18N_KEYS) {
    result[key] = shard?.[key] ?? ""
  }
  return result
}
