/**
 * S3 备份功能纯工具函数
 *
 * 不依赖 Vue 响应式的纯函数：数字补零、备份时间戳生成、
 * S3 对象 key 构建、主机名获取（模块级缓存）、
 * 增量备份的 manifest 解析/对比与 key 生成、插件备份文件名判定。
 */
import { getNodeProcessModules } from "@/utils/nodeModules"
import { DEFAULT_S3_PREFIX, DEFAULT_BACKUP_DIR, INCREMENTAL_SUBDIR, INCREMENTAL_MANIFEST_NAME } from "./types"
import type { BackupManifest, IncrementalDiff, IncrementalFileEntry } from "./types"

/** 数字补零（如 padNum(3) → "03"） */
export function padNum(n: number): string {
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

/** 缓存的主机名（进程生命周期内不变，避免重复 require os 模块） */
let _hostname: string | null = null

/** 获取本机主机名（非 Node 环境返回空串） */
export function getHostname(): string {
  if (_hostname === null) {
    _hostname = getNodeProcessModules()?.os?.hostname() || ""
  }
  return _hostname
}

// ========== 增量备份纯函数 ==========

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
