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
