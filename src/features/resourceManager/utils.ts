// 资源管理模块纯工具函数与共享常量：路径过滤、SQL 转义、目录扫描
import type { ImageAssetInfo } from "./types"
import { readDir } from "@/api"

/** 图片扩展名匹配 */
export const IMAGE_EXT = /\.(?:png|jpg|jpeg|gif|svg|webp|bmp|ico|tiff|avif)$/i

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

/** 校验移动目标路径：必须位于 assets/ 下、不含路径穿越、不以 / 结尾 */
export function isValidAssetMovePath(path: string): boolean {
  return path.startsWith("assets/") && !path.includes("..") && !path.endsWith("/")
}

/** 按图片/非图片扩展名过滤路径列表并构造资源条目 */
export function buildAssetList(paths: string[], isImage: boolean): ImageAssetInfo[] {
  const extFilter = isImage
    ? (p: string) => IMAGE_EXT.test(p)
    : (p: string) => !IMAGE_EXT.test(p)
  return paths.filter(extFilter).map((path) => ({ path }))
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
export const PATH_ENCODING_TRANSFORMS: ((s: string) => string)[] = [
  (s) => s,
  (s) => s.split(" ").join("%20"),
  (s) => encodeURI(s),
]

/** 生成资源路径在 markdown 中可能出现的引用形态（以解码路径为基准，去重） */
export function buildPathVariants(path: string): string[] {
  const base = safeDecodeURI(path)
  return [...new Set(PATH_ENCODING_TRANSFORMS.map((t) => t(base)))]
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

/** 转义正则表达式元字符 */
export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** 检查资源文件是否存在于磁盘（通过列出父目录比对文件名） */
export async function assetFileExists(path: string): Promise<boolean> {
  const segments = `/data/${path}`.split("/")
  const name = segments.pop()
  const entries = await readDir(segments.join("/"))
  if (!entries) return false
  const files = Array.isArray(entries) ? entries : [entries]
  return files.some((entry) => entry.name === name)
}

/** 递归扫描资源目录，子目录并行收集，返回相对 /data/ 的路径列表 */
export async function scanAssetDir(dirPath: string): Promise<string[]> {
  try {
    const entries = await readDir(dirPath)
    if (!entries) return []
    const files = Array.isArray(entries) ? entries : [entries]
    const results = await Promise.all(files.map(async (entry) => {
      const fullPath = `${dirPath}/${entry.name}`
      if (entry.isDir) return scanAssetDir(fullPath)
      return [fullPath.replace(/^\/data\//, "")]
    }))
    return results.flat()
  }
  catch {
    return []
  }
}
