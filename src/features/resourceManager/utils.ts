// 资源管理模块纯工具函数与共享常量：文案占位符、路径过滤、SQL 转义、目录扫描
import type { ResourceManagerI18n } from "./types"
import { readDir, sql } from "@/api"

/**
 * i18n 文案占位符替换（`{key}` 形态）：缺失文案时返回空串，调用方无需二次判空。
 * 用 split/join 而非 replaceAll —— 构建 target 低于 ES2021，replaceAll 不可用。
 */
export function fillTemplate(
  template: string | undefined,
  values: Record<string, string | number> = {},
): string {
  let out = template ?? ""
  for (const [key, value] of Object.entries(values)) {
    out = out.split(`{${key}}`).join(String(value))
  }
  return out
}

/** 图片扩展名匹配 */
const IMAGE_EXT = /\.(?:png|jpg|jpeg|gif|svg|webp|bmp|ico|tiff|avif)$/i

/** 内置快速分类元数据：key 对应磁盘目录名（统一小写），i18nKey 对应 ResourceManagerI18n 文案键 */
export const BUILT_IN_CATEGORY_DEFS = [
  { key: "images", i18nKey: "categoryImages" },
  { key: "net", i18nKey: "categoryNet" },
  { key: "tool", i18nKey: "categoryTool" },
  { key: "other", i18nKey: "categoryOther" },
] as const

/** 内置快速分类 key 集合 */
export const BUILT_IN_CATEGORY_KEYS = new Set<string>(
  BUILT_IN_CATEGORY_DEFS.map((def) => def.key),
)

/** 解析分类展示文案：内置分类读取 i18n 文案键（缺失时回退 key），自定义分类返回其 key */
export function resolveCategoryLabel(i18n: ResourceManagerI18n, key: string): string {
  const def = BUILT_IN_CATEGORY_DEFS.find((d) => d.key === key)
  return def ? (i18n[def.i18nKey] || def.key) : key
}

/** 自定义分类持久化存储键 */
export const STORAGE_KEY = "resourceManager-customCategories"

/** 被隐藏（删除）的内置分类持久化存储键 */
export const STORAGE_HIDDEN_KEY = "resourceManager-hiddenBuiltIn"

/**
 * 转义 SQL LIKE 模式中的特殊字符（单引号、反斜杠、% 与 _ 通配符）
 * 使用方须在 LIKE 子句后附加 ESCAPE '\'
 */
function escapeSqlLike(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/[%_]/g, (ch) => `\\${ch}`)
    .replace(/'/g, "''")
}

/** 转义 SQL 字符串字面量（仅单引号与反斜杠），用于 = 等值比较 */
export function escapeSqlString(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/'/g, "''")
}

/** 按 markdown LIKE 片段查询 blocks（含 id/root_id/markdown），sql 静默失败时返回 null */
export async function queryBlocksByMarkdown(
  needle: string,
  limit: number,
): Promise<{ id: string, root_id: string, markdown: string }[] | null> {
  return await sql(
    `SELECT id, root_id, markdown FROM blocks WHERE markdown LIKE '%${escapeSqlLike(needle)}%' ESCAPE '\\' ORDER BY updated DESC LIMIT ${limit}`,
  ) as { id: string, root_id: string, markdown: string }[] | null
}

/**
 * 校验移动目标路径：先解码再校验，必须位于 assets/ 下、不含路径穿越
 * （含 %2e%2e 等编码形态）、不含反斜杠/NUL/空目录段、不以 / 结尾
 */
export function isValidAssetMovePath(path: string): boolean {
  const decoded = safeDecodeURI(path)
  if (!decoded.startsWith("assets/")) return false
  if (decoded.includes("..")) return false
  if (decoded.includes("\\") || decoded.includes("\0")) return false
  if (decoded.includes("//")) return false
  if (decoded.endsWith("/")) return false
  return true
}

/** 归一化分类 key：统一小写并去除首尾空白，保证磁盘目录名与筛选前缀一致 */
export function normalizeCategoryKey(raw: string): string {
  return raw.trim().toLowerCase()
}

/** 构造分类目录筛选前缀（如 assets/images/），key 内部归一化保证小写 */
export function categoryDirPrefix(key: string): string {
  return `assets/${normalizeCategoryKey(key)}/`
}

/** 判断路径是否为图片资源 */
export function isImagePath(path: string): boolean {
  return IMAGE_EXT.test(path)
}

/** 按图片/非图片扩展名过滤路径列表 */
export function buildAssetList(paths: string[], isImage: boolean): string[] {
  return paths.filter((p) => isImagePath(p) === isImage)
}

/** 安全解码 URL 编码路径（非法编码时原样返回） */
export function safeDecodeURI(path: string): string {
  try { return decodeURI(path) }
  catch { return path }
}

/** 图片扩展名 → MIME 类型映射（未知扩展名回落 image/jpeg） */
const IMAGE_MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  ico: "image/x-icon",
  tiff: "image/tiff",
  avif: "image/avif",
  svg: "image/svg+xml",
}

/** 按文件名解析图片 MIME 类型（无扩展名或未知扩展名回落 image/jpeg） */
export function getImageMimeType(fileName: string): string {
  const dot = fileName.lastIndexOf(".")
  const ext = dot > -1 ? fileName.slice(dot + 1).toLowerCase() : ""
  return IMAGE_MIME_BY_EXT[ext] ?? "image/jpeg"
}

/**
 * 将列表中的资源路径归一为文件 API 可用的磁盘路径。
 *
 * 两处形态差异需要同时处理：
 * 1. **前缀**：列表路径为 `assets/xxx.png`（无前导斜杠），而 `/api/file/*` 要求
 *    `/data/` 前缀的工作空间相对路径；
 * 2. **编码**：列表是 `sql(assets)` 路径与 `scanAssetDir` 磁盘名的**并集**——
 *    前者为 URL 编码形态（`a%20b.png`），后者是磁盘原始文件名（`a b.png`）。
 *
 * ⚠️ 不能无条件解码：磁盘名本身可能**字面含 `%xx`**（如文件名 `report%20final.png`），
 * 解码会把它错改成 `report final.png`（通常是另一个不存在的路径）。
 * 故与 `resolveDiskPath` 同策略：先按原样探测磁盘，不存在再试解码形态；
 * 两者都不存在时回落原样路径（交由文件 API 报真实错误，而非静默指向错误文件）。
 */
export async function toDiskAssetPath(path: string): Promise<string> {
  const relative = path.replace(/^\/data\//, "")
  const diskPath = await resolveDiskPath(relative)
  return `/data/${diskPath ?? relative}`
}

/**
 * markdown 中资源路径的可能存储形态变换：
 * 原文 / 仅空格编码（思源链接中空格存为 %20、中文保留原文）/ 完整 URL 编码
 */
const PATH_ENCODING_TRANSFORMS: ((s: string) => string)[] = [
  (s) => s,
  (s) => s.split(" ").join("%20"),
  (s) => encodeURI(s),
]

/** 生成资源路径在 markdown 中可能出现的引用形态（以解码路径为基准，去重） */
export function buildPathVariants(path: string): string[] {
  const base = safeDecodeURI(path)
  return [...new Set(PATH_ENCODING_TRANSFORMS.map((t) => t(base)))]
}

/** 转换为思源 markdown 链接标准形态：解码后仅空格编码为 %20 */
export function toMarkdownPath(path: string): string {
  return PATH_ENCODING_TRANSFORMS[1](safeDecodeURI(path))
}

/** 构造 img src 可用的根相对 URL（思源内核直接服务 /assets/ 路径） */
export function buildAssetSrc(path: string): string {
  return `/${encodeURI(safeDecodeURI(path))}`
}

/** 对新旧字符串施加相同的编码形态变换，按 from 去重生成替换对 */
export function buildVariantPairs(from: string, to: string): { from: string, to: string }[] {
  const seen = new Set<string>()
  const pairs: { from: string, to: string }[] = []
  for (const transform of PATH_ENCODING_TRANSFORMS) {
    const f = transform(from)
    if (seen.has(f)) continue
    seen.add(f)
    pairs.push({ from: f, to: transform(to) })
  }
  return pairs
}

/** 转义正则表达式元字符（统一由 @/utils/stringUtils 提供） */
export { escapeRegExp } from "@/utils/stringUtils"

/** 检查资源文件是否存在于磁盘（通过列出父目录比对文件名） */
async function assetFileExists(path: string): Promise<boolean> {
  // 无目录段的路径会导致 readDir("") 扫描整个 /data，直接判定不存在
  if (!path.includes("/")) return false
  const segments = `/data/${path}`.split("/")
  const name = segments.pop()
  const entries = await readDir(segments.join("/"))
  if (!entries) return false
  const files = Array.isArray(entries) ? entries : [entries]
  return files.some((entry) => entry.name === name)
}

/**
 * 解析资源在磁盘上的真实路径：assets 表中的路径可能是 URL 编码形态
 * （如 a%20b.png），而磁盘文件名是解码后的（a b.png），原样不存在时尝试解码形态
 */
export async function resolveDiskPath(path: string): Promise<string | null> {
  if (await assetFileExists(path)) return path
  const decoded = safeDecodeURI(path)
  if (decoded !== path && await assetFileExists(decoded)) return decoded
  return null
}

/** 目录递归扫描的并发上限（避免大树下瞬时打出大量内核请求） */
const SCAN_CONCURRENCY = 8

/** 递归扫描资源目录，有界并发收集，返回相对 /data/ 的路径列表 */
export async function scanAssetDir(dirPath: string): Promise<string[]> {
  try {
    const entries = await readDir(dirPath)
    if (!entries) return []
    const files = Array.isArray(entries) ? entries : [entries]
    const results: string[] = []
    // 分批并发：每批最多 SCAN_CONCURRENCY 个条目，批内并行、批间串行
    for (let i = 0; i < files.length; i += SCAN_CONCURRENCY) {
      const batch = files.slice(i, i + SCAN_CONCURRENCY)
      const batchResults = await Promise.all(batch.map(async (entry) => {
        const fullPath = `${dirPath}/${entry.name}`
        if (entry.isDir) return scanAssetDir(fullPath)
        return [fullPath.replace(/^\/data\//, "")]
      }))
      results.push(...batchResults.flat())
    }
    return results
  }
  catch (e: unknown) {
    // 单目录读取异常不应中断整体扫描，但须留痕以便排查权限/编码问题
    console.error("扫描资源目录失败:", dirPath, e)
    return []
  }
}
