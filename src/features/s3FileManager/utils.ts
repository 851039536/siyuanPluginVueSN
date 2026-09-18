/**
 * S3 文件管理器纯工具函数
 *
 * 不依赖 Vue 响应式的纯函数：前缀/名称路径运算、名称合法性校验、
 * 全量列举结果的目录聚合、日志失败清单构造、扩展名图标映射与排序比较器。
 */
import type { IconKey } from "@/config/icons"
import type { S3DirListing } from "@/utils/s3/s3ObjectOps"
import type { S3FileInfo } from "@/utils/s3/types"
import { MAX_LOG_DETAIL_FILES } from "@/utils/s3/types"
import type { FileOpLogDetail, S3Entry, SortField } from "./types"

// ========== 前缀/名称路径运算 ==========

/** 拼接目录前缀与子名称（文件夹结果以 / 结尾） */
export function joinPrefix(parent: string, name: string, isFolder: boolean): string {
  const base = `${parent}${name}`
  return isFolder ? `${base}/` : base
}

/** 取目录前缀的父级前缀（根返回空串），如 "a/b/" → "a/" */
export function parentPrefix(prefix: string): string {
  const trimmed = prefix.replace(/\/+$/, "")
  const idx = trimmed.lastIndexOf("/")
  return idx >= 0 ? trimmed.slice(0, idx + 1) : ""
}

/** 取前缀/对象 key 的末段名称，如 "a/b/" → "b"、"a/c.txt" → "c.txt" */
export function nameFromKey(key: string): string {
  const trimmed = key.replace(/\/+$/, "")
  const idx = trimmed.lastIndexOf("/")
  return idx >= 0 ? trimmed.slice(idx + 1) : trimmed
}

/** 拆分目录前缀为面包屑段，如 "a/b/" → ["a", "b"] */
export function splitPrefixSegments(prefix: string): string[] {
  return prefix.split("/").filter(Boolean)
}

/** 由面包屑段索引重组目录前缀，如 (["a","b"], 0) → "a/" */
export function prefixFromSegments(segments: string[], index: number): string {
  return `${segments.slice(0, index + 1).join("/")}/`
}

/**
 * 取前缀相对浏览根的段列表（面包屑渲染用）。
 * 主列表与「移动/复制目标选择」弹窗共用同一口径 —— 二者此前各写一份逐字相同的实现。
 */
export function relativeSegments(prefix: string, root: string): string[] {
  const relative = prefix.startsWith(root) ? prefix.slice(root.length) : prefix
  return splitPrefixSegments(relative)
}

// ========== 名称校验 ==========

/** 校验文件/文件夹名称合法性（禁止路径分隔符、空名、纯点名） */
export function isValidEntryName(name: string): boolean {
  const trimmed = name.trim()
  if (!trimmed || trimmed === "." || trimmed === "..") { return false }
  return !/[/\\]/.test(trimmed)
}

// ========== 目录聚合（delimiter 降级用） ==========

/**
 * 将递归全量列举结果按 / 聚合为当前层条目
 * 服务端不支持 delimiter 时的客户端降级方案
 */
export function aggregateEntries(
  files: S3FileInfo[],
  prefix: string,
): { files: S3FileInfo[]; folders: string[]; conflicts: string[] } {
  const directFiles: S3FileInfo[] = []
  const folderSet = new Set<string>()
  const fileNames = new Set<string>()
  for (const f of files) {
    if (!f.key.startsWith(prefix) || f.key === prefix) { continue }
    const rest = f.key.slice(prefix.length)
    const slashIdx = rest.indexOf("/")
    if (slashIdx === -1) {
      directFiles.push(f)
      fileNames.add(rest)
    } else {
      const seg = rest.slice(0, slashIdx)
      // 跳过双斜杠异常键（首段为空），避免聚合出与当前目录同名的假文件夹
      if (seg) { folderSet.add(`${prefix}${seg}/`) }
    }
  }
  // 同名前缀文件夹与文件并存的异常后端会导致展示冲突，交由调用方记日志诊断
  const conflicts = [...folderSet].filter((folder) => fileNames.has(nameFromKey(folder)))
  return { files: directFiles, folders: [...folderSet], conflicts }
}

/** 将 listDir 结果组装为统一的 S3Entry 列表（文件夹在前由排序器保证） */
export function buildEntries(files: S3FileInfo[], folders: string[]): S3Entry[] {
  const folderEntries: S3Entry[] = folders.map((p) => ({
    name: nameFromKey(p),
    key: p,
    isFolder: true,
    size: 0,
    lastModified: "",
  }))
  const fileEntries: S3Entry[] = files.map((f) => ({
    name: f.name,
    key: f.key,
    isFolder: false,
    size: f.size,
    lastModified: f.lastModified,
    timestamp: f.timestamp,
  }))
  return [...folderEntries, ...fileEntries]
}

/**
 * 归一化 listDir 结果为当前层文件 + 子目录前缀。
 *
 * 防御性客户端聚合：服务端静默忽略 delimiter（返回扁平递归列举且无 CommonPrefixes）时，
 * 把嵌套对象按 / 折叠回当前层文件夹，避免子目录文件冒到上层、当前文件夹自嵌套。
 * delimiter 正常时 listing.files 本就是直接子项，聚合为幂等无副作用。
 *
 * 主列表 loadDir 与「移动/复制目标选择」弹窗共用同一口径 —— 二者此前各写一份等价实现。
 */
export function normalizeListing(
  listing: S3DirListing,
  prefix: string,
): { files: S3FileInfo[]; folders: string[]; conflicts: string[] } {
  const agg = aggregateEntries(listing.files, prefix)
  return {
    files: agg.files,
    folders: [...new Set([...listing.folders, ...agg.folders])],
    conflicts: agg.conflicts,
  }
}

// ========== 日志失败清单 ==========

/** 构造日志失败清单（超上限截断并记录省略数） */
export function buildFailDetail(failed: string[]): FileOpLogDetail | undefined {
  if (failed.length === 0) { return undefined }
  return {
    failed: failed.slice(0, MAX_LOG_DETAIL_FILES),
    omitted: Math.max(0, failed.length - MAX_LOG_DETAIL_FILES),
  }
}

// ========== 排序 ==========

/** 条目排序比较器：文件夹恒置顶，其余按字段与方向比较 */
export function compareEntries(a: S3Entry, b: S3Entry, field: SortField, asc: boolean): number {
  if (a.isFolder !== b.isFolder) { return a.isFolder ? -1 : 1 }
  let cmp = 0
  if (field === "size") {
    cmp = a.size - b.size
  } else if (field === "time") {
    cmp = (a.timestamp || 0) - (b.timestamp || 0)
  }
  if (cmp === 0) {
    cmp = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
  }
  return asc ? cmp : -cmp
}

// ========== 扩展名图标映射 ==========

/** 图片扩展名集合 */
const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif"])

/** 代码/标记文本扩展名集合 */
const CODE_EXTS = new Set(["js", "ts", "vue", "json", "html", "css", "scss", "md", "xml", "yml", "yaml", "py", "go", "rs", "java", "cs", "sh", "sql"])

/** 视频/音频扩展名集合 */
const MEDIA_EXTS = new Set(["mp4", "webm", "mkv", "avi", "mov", "mp3", "wav", "flac", "ogg", "m4a"])

/** 按文件名扩展名映射已注册的 Iconify 图标键（COMMON_ICONS/FEATURE_ICONS 内） */
export function entryIconKey(entry: S3Entry): IconKey {
  if (entry.isFolder) { return "folder" }
  const ext = entry.name.includes(".") ? entry.name.split(".").pop()!.toLowerCase() : ""
  if (IMAGE_EXTS.has(ext)) { return "image" }
  if (CODE_EXTS.has(ext)) { return "code" }
  if (MEDIA_EXTS.has(ext)) { return "play" }
  return "file"
}
