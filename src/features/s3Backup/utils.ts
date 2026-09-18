/**
 * S3 备份功能纯工具函数
 *
 * 不依赖 Vue 响应式的纯函数：数字补零、备份时间戳生成、
 * S3 对象 key 构建（含备份上传 key 归一化）、主机名获取（模块级缓存）、
 * 增量备份的 manifest 解析/对比与 key 生成、插件备份文件名判定、
 * 归档文件识别与惰性读取流创建、错误本地化与重试执行器。
 */
import { getNodeModules, getNodeStream } from "@/utils/nodeModules"
import { getErrorMessage } from "@/utils/stringUtils"
import { runWithRetries } from "@/utils/s3/concurrency"
import { DEFAULT_S3_PREFIX, DEFAULT_BACKUP_DIR, INCREMENTAL_SUBDIR, INCREMENTAL_MANIFEST_NAME, MAX_LOG_DETAIL_FILES, MSG_DESKTOP_ONLY, TRANSFER_MAX_RETRIES, BACKUP_ERROR_KEYS, BackupError } from "./types"
import type { BackupManifest, IncrementalDiff, IncrementalFileEntry } from "./types"

// 并发池与主机名已提升至共享层，再导出保持模块内既有 import 零改动
export { getHostname, runWithConcurrency } from "@/utils/s3/concurrency"

// ========== 错误本地化与重试 ==========

/**
 * 把模块层异常转为可展示文案。
 * BackupError 按错误码取 i18n 文案并追加技术细节；其余异常沿用 getErrorMessage。
 * 所有「错误信息会进入 showMessage / 日志」的出口都应经过本函数。
 */
export function localizeBackupError(err: unknown, i18n: Record<string, string>): string {
  if (err instanceof BackupError) {
    const text = i18n[BACKUP_ERROR_KEYS[err.code]] || err.code
    return err.detail ? `${text}: ${err.detail}` : text
  }
  return getErrorMessage(err)
}

/** 通用重试执行器：任务成功返回 true，重试耗尽后记警告并返回 false（上传/删除/下载共用）
 *  重试循环本身由共享层 runWithRetries 承担，此处只保留 s3Backup 的「警告 + 布尔出口」语义 */
export async function withRetry(task: () => Promise<void>, failLabel: string): Promise<boolean> {
  const { ok, error } = await runWithRetries(task)
  if (!ok) {
    console.warn(`[S3备份] ${failLabel}（已重试 ${TRANSFER_MAX_RETRIES} 次）`, getErrorMessage(error))
  }
  return ok
}

/** 解析本地备份目录绝对路径（云端下载与增量还原共用；非桌面环境回退字符串拼接） */
export function resolveBackupDir(workspaceRoot: string, localBackupDir: string): string {
  const localDir = localBackupDir || DEFAULT_BACKUP_DIR
  const pathMod = getNodeModules()?.path
  return pathMod ? pathMod.join(workspaceRoot, localDir) : `${workspaceRoot}/${localDir}`
}

/** 本地备份列表识别的归档扩展名白名单 */
const ARCHIVE_EXTS = [".zip", ".7z", ".tar", ".tar.gz", ".tgz", ".tar.bz2", ".rar"]

/** 判断文件名是否为受支持的归档文件 */
export function isArchiveFile(name: string): boolean {
  return ARCHIVE_EXTS.some((ext) => name.toLowerCase().endsWith(ext))
}

/**
 * 创建惰性读取流：注册进 JSZip 时不打开文件描述符，
 * 待压缩阶段实际消费时才 open 底层文件，避免大量文件同时占用 fd 触发 EMFILE；
 * 返回类型显式携带 destroy 签名，供压缩中断时统一销毁兜底
 */
export function createLazyReadStream(fsRaw: any, filePath: string): NodeJS.ReadableStream & { destroy: (err?: Error) => void } {
  const streamMod = getNodeStream()
  if (!streamMod) {
    throw new TypeError(MSG_DESKTOP_ONLY)
  }
  let source: any = null
  const lazy: any = new streamMod.stream.Readable({
    read() {
      if (source) {
        source.resume()
        return
      }
      source = fsRaw.createReadStream(filePath)
      source.on("data", (chunk: Buffer) => {
        if (!lazy.push(chunk)) { source.pause() }
      })
      source.on("end", () => lazy.push(null))
      source.on("error", (err: Error) => lazy.destroy(err))
    },
    destroy(err: Error | null, callback: (e?: Error | null) => void) {
      source?.destroy()
      callback(err)
    },
  })
  return lazy
}

/** 数字补零（如 padNum(3) → "03"；仅模块内时间戳格式化使用，不对外导出） */
function padNum(n: number): string {
  return n.toString().padStart(2, "0")
}

/** 取路径末段文件名（本地列表条目 name 可能含日期子目录，如 "data-20260707/xxx.zip"） */
export function getBaseName(name: string): string {
  return name.split("/").pop() || name
}

/** 判断是否为插件自动生成的备份文件（data- 前缀 + .zip），保留数清理只删除此类文件 */
export function isPluginBackupFile(name: string): boolean {
  const base = getBaseName(name)
  return base.startsWith("data-") && base.toLowerCase().endsWith(".zip")
}

/** 生成备份时间戳（格式 YYYYMMDD-HHmmss） */
export function makeBackupTimestamp(d: Date = new Date()): string {
  return `${d.getFullYear()}${padNum(d.getMonth() + 1)}${padNum(d.getDate())}-${padNum(d.getHours())}${padNum(d.getMinutes())}${padNum(d.getSeconds())}`
}

/**
 * 构建 S3 对象 key
 * 将 prefix/sub/datePath/relativePath 多段拼接为规范 S3 key，
 * 自动 strip 首尾斜杠、过滤空段，避免产生 // 等无效前缀。
 * prefix/sub 为空时回退默认值（与历史行为一致）。
 */
export function buildS3Key(prefix: string, sub: string, relativePath: string, datePath = ""): string {
  const parts: string[] = [
    (prefix || DEFAULT_S3_PREFIX).replace(/\/+$/, ""),
    (sub || DEFAULT_BACKUP_DIR).replace(/\/+$/, ""),
  ].filter(Boolean)
  if (datePath) { parts.push(datePath.replace(/\/+$/, "")) }
  parts.push(relativePath.replace(/^\/+/, ""))
  return parts.join("/")
}

// ========== 备份上传 key 归一化 ==========

/** 日期子目录名匹配（data-YYYYMMDD，捕获日期段） */
const DATA_DATE_DIR_RE = /^data-(\d{8})$/

/** 备份文件名内嵌日期段匹配（data-YYYYMMDD-HHmmss.zip） */
const DATA_DATE_IN_NAME_RE = /^data-(\d{8})-/

/** 备份归档相对路径拆解结果：datePath 为日期段（YYYYMMDD），baseName 为末段文件名 */
export interface SplitRelativePath {
  datePath: string
  baseName: string
}

/**
 * 拆解备份归档相对路径为「日期段 + 文件名」
 * - 首段为 data-YYYYMMDD 日期子目录时以其为日期段（与本地目录语义一致）
 * - 否则从文件名 data-YYYYMMDD- 前缀提取（data-backup 顶层归档）
 * - 均无时回退 fallbackDate（今日，latestZip 场景文件名即当日）
 */
export function splitBackupRelativePath(relativePath: string, fallbackDate: string): SplitRelativePath {
  const segments = relativePath.split("/")
  const baseName = segments[segments.length - 1] || relativePath
  if (segments.length >= 2) {
    const dirMatch = DATA_DATE_DIR_RE.exec(segments[0])
    if (dirMatch) {
      return { datePath: dirMatch[1], baseName }
    }
  }
  const nameMatch = DATA_DATE_IN_NAME_RE.exec(baseName)
  return { datePath: nameMatch ? nameMatch[1] : fallbackDate, baseName }
}

/**
 * 构建备份上传 S3 key（全量上传 / 手动上传共用，消除两套 key 规则）
 * 日期段取备份文件自身日期（日期子目录名或文件名内嵌日期），无则回退 fallbackDate；
 * useDateFolder 关闭时省略日期段，与本地目录语义一致（跨备份去重可命中）
 */
export function buildBackupUploadKey(
  prefix: string,
  sub: string,
  relativePath: string,
  useDateFolder: boolean,
  fallbackDate: string,
): string {
  const { datePath, baseName } = splitBackupRelativePath(relativePath, fallbackDate)
  return buildS3Key(prefix, sub, baseName, useDateFolder ? datePath : "")
}

// ========== 增量备份纯函数 ==========

/** 按存储上限截断文件清单，返回 [截断后清单, 被省略条数]（空清单返回 undefined 不占存储） */
export function capFileList(files: string[]): [string[] | undefined, number] {
  if (files.length === 0) { return [undefined, 0] }
  return [files.slice(0, MAX_LOG_DETAIL_FILES), Math.max(0, files.length - MAX_LOG_DETAIL_FILES)]
}

/**
 * 判断清单相对路径是否不安全（绝对路径/盘符/父目录穿越/空段），
 * 还原时必须跳过，防止恶意或损坏的清单覆盖工作区外文件
 */
export function isUnsafeRelativePath(relativePath: string): boolean {
  if (relativePath.startsWith("/") || relativePath.startsWith("\\")) { return true }
  if (/^[A-Za-z]:[\/]/.test(relativePath)) { return true }
  const parts = relativePath.split(/[\/]+/)
  return parts.some((part) => part === ".." || part === "")
}

/**
 * 构建增量备份对象 key
 * 数据文件：{prefix}/{sub}/incremental/data/{relativePath}
 * 复用 buildS3Key 的空段过滤与斜杠规范化
 */
export function buildIncrementalKey(prefix: string, sub: string, relativePath: string): string {
  return buildS3Key(prefix, sub, `${INCREMENTAL_SUBDIR}/data/${relativePath.replace(/^\/+/, "")}`)
}

/** 构建增量清单对象 key：{prefix}/{sub}/incremental/manifest.json */
export function buildManifestKey(prefix: string, sub: string): string {
  return buildS3Key(prefix, sub, `${INCREMENTAL_SUBDIR}/${INCREMENTAL_MANIFEST_NAME}`)
}

/**
 * 解析 manifest 文本并校验结构（备份/还原两处共用）
 * @throws 解析失败或缺少 files 字段时抛错，错误策略由调用方决定
 */
export function parseManifest(text: string): BackupManifest {
  const parsed = JSON.parse(text) as BackupManifest
  if (!parsed || typeof parsed.files !== "object" || parsed.files === null) {
    throw new TypeError("manifest 缺少 files 字段")
  }
  return parsed
}

/**
 * 对比本次扫描结果与旧清单，产出增量差异
 * - mtime 或 size 任一变化即视为修改（宽松触发，宁多传不漏传）
 * - oldManifest 为 null 时视为首次备份，全部文件进入 toUpload
 */
export function diffManifest(
  scanned: IncrementalFileEntry[],
  oldManifest: BackupManifest | null,
): IncrementalDiff {
  if (!oldManifest) {
    return { toUpload: [...scanned], toDelete: [], unchangedCount: 0, unchanged: {} }
  }

  const toUpload: IncrementalFileEntry[] = []
  const unchanged: BackupManifest["files"] = {}
  let unchangedCount = 0
  const scannedPaths = new Set<string>()

  for (const file of scanned) {
    scannedPaths.add(file.relativePath)
    const old = oldManifest.files[file.relativePath]
    if (old && old.mtime === file.mtime && old.size === file.size) {
      unchanged[file.relativePath] = old
      unchangedCount++
    } else {
      toUpload.push(file)
    }
  }

  // 旧清单有、本次扫描无 → 本地已删除，需清理 S3 对象
  const toDelete = Object.keys(oldManifest.files).filter((p) => !scannedPaths.has(p))

  return { toUpload, toDelete, unchangedCount, unchanged }
}
