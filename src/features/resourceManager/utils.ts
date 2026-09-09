// 资源管理模块纯工具函数与共享常量：路径过滤、SQL 转义、目录扫描
import { readDir, sql } from "@/api"

/** 图片扩展名匹配 */
const IMAGE_EXT = /\.(?:png|jpg|jpeg|gif|svg|webp|bmp|ico|tiff|avif)$/i

/** 内置快速分类 key 集合 */
export const BUILT_IN_CATEGORY_KEYS = new Set(["images", "net", "tool", "other"])

/** 自定义分类持久化存储键 */
export const STORAGE_KEY = "resourceManager-customCategories"

/**
 * 转义 SQL LIKE 模式中的特殊字符（单引号、反斜杠、% 与 _ 通配符）
 * 使用方须在 LIKE 子句后附加 ESCAPE '\'
 */
export function escapeSqlLike(str: string): string {
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

/**
 * 文件名兜底替换对：`from` 为旧文件名（三种编码形态，按 from 去重），
 * `to` 为同一编码形态下的新完整路径。
 * 不可复用 buildVariantPairs——其 from/to 共享同一变换，而此处 from 为文件名、
 * to 为完整路径，语义不同源，直接复用会产出错误形态的替换目标。
 */
export function buildNameFallbackPairs(
  baseName: string,
  newPath: string,
): { from: string, to: string }[] {
  const seen = new Set<string>()
  const pairs: { from: string, to: string }[] = []
  for (const transform of PATH_ENCODING_TRANSFORMS) {
    const f = transform(baseName)
    if (seen.has(f)) continue
    seen.add(f)
    pairs.push({ from: f, to: transform(newPath) })
  }
  return pairs
}

/** 转义正则表达式元字符 */
export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** 检查资源文件是否存在于磁盘（通过列出父目录比对文件名） */
export async function assetFileExists(path: string): Promise<boolean> {
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
