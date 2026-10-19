/**
 * gitPush — 项目根目录 Markdown 文件扫描工具
 *
 * 读取指定目录下的 *.md 文件，按约定排序（README → AGENTS → CLAUDE → CODEBUDDY → 其他），
 * 返回标准化的文件元数据列表供 badge 展示与弹窗预览使用。
 */
import { getNodeFsPathOs } from "@/utils/nodeModules"

/** Markdown 文件变体类型 — 决定 badge 视觉样式 */
export type MdFileVariant = "readme" | "agents" | "claude" | "codebuddy" | "other"

/** 单个 Markdown 文件元数据 */
export interface MdFileEntry {
  /** 原始文件名（保留大小写，如 README.md） */
  name: string
  /** 绝对路径 */
  path: string
  /** 变体类型（决定 badge 颜色与排序） */
  variant: MdFileVariant
  /** 文件大小（bytes） */
  size: number
  /** 是否超过 1MB 阈值 */
  oversized: boolean
}

/**
 * 生成 Markdown 文件徽章显示标签（约定文件去扩展名大写，其他保留原始文件名）
 * @param name 原始文件名（如 README.md / notes.md）
 * @param variant 变体类型
 * @returns 显示标签（README / NOTES / notes.md）
 */
export function getMdLabel(name: string, variant: MdFileVariant): string {
  return variant === "other" ? name : name.replace(/\.md$/i, "").toUpperCase()
}

/** 文件大小阈值：1MB */
const OVERSIZE_THRESHOLD = 1024 * 1024

/** 变体优先级（升序排列） */
const VARIANT_ORDER: Record<MdFileVariant, number> = {
  readme: 0,
  agents: 1,
  claude: 2,
  codebuddy: 3,
  other: 4,
}

/** 小写文件名 → 变体的映射表 */
const MD_VARIANT_MAP: Record<string, MdFileVariant> = {
  "readme.md": "readme",
  "agents.md": "agents",
  "claude.md": "claude",
  "codebuddy.md": "codebuddy",
}

/** 扫描缓存条数上限（项目数通常几十，超限按插入顺序淘汰最旧，防止已删项目条目常驻） */
const SCAN_CACHE_MAX = 64

/**
 * Markdown 扫描结果缓存（dir → 目录 mtime + 结果）。
 *
 * 每张 ProjectCard 挂载都会调一次 scanMarkdownFiles；N 张卡 = N 次同步 readdir + 逐文件 stat，
 * 全部发生在挂载主线程上。缓存后同一目录只有首次扫描付这份 IO，目录 mtime 变化（新增/删除 .md）时自动失效。
 * 说明：文件内容/size 变化不改目录 mtime，但 badge 只显示「文件存在 + 大小是否超大」，
 * 对 size 的精确实时性要求很低（真正读取内容在弹窗打开时由 readMarkdownFile 重新读盘）。
 */
const scanCache = new Map<string, { dirMtimeMs: number, entries: MdFileEntry[] }>()

/** 写入缓存并按上限淘汰最旧条目 */
function setScanCache(dir: string, value: { dirMtimeMs: number, entries: MdFileEntry[] }): void {
  // 先删再插：保证 Map 的插入顺序 = 最近的写入顺序（便于按最旧淘汰）
  scanCache.delete(dir)
  scanCache.set(dir, value)
  while (scanCache.size > SCAN_CACHE_MAX) {
    const oldest = scanCache.keys().next().value
    if (oldest === undefined) break
    scanCache.delete(oldest)
  }
}

/**
 * 扫描指定目录下的所有 Markdown 文件（带目录 mtime 缓存）
 * @param dir 项目根目录绝对路径
 * @returns Markdown 文件元数据数组（按约定排序），fs 不可用时返回空数组
 */
export function scanMarkdownFiles(dir: string): MdFileEntry[] {
  const node = getNodeFsPathOs()
  if (!node) return []
  const { fs, path } = node

  try {
    if (!fs.existsSync(dir)) return []
    const dirMtimeMs = fs.statSync(dir).mtimeMs
    const cached = scanCache.get(dir)
    if (cached && cached.dirMtimeMs === dirMtimeMs) return cached.entries
    const entries = scanMarkdownFilesUncached(dir, fs, path)
    setScanCache(dir, { dirMtimeMs, entries })
    return entries
  } catch {
    return []
  }
}

/** 清空扫描缓存（项目删除/卸载时调用；缓存本身按目录 mtime 自失效） */
export function clearMarkdownScanCache(): void {
  scanCache.clear()
}

/** 删除单个目录的缓存（项目删除/路径变更后调用，避免已删项目条目常驻） */
export function clearMarkdownScanCacheFor(dir: string): void {
  scanCache.delete(dir)
}

/** 实际扫描实现（无缓存） */
function scanMarkdownFilesUncached(
  dir: string,
  fs: { readdirSync: typeof import("node:fs").readdirSync, statSync: typeof import("node:fs").statSync },
  path: { join: (...parts: string[]) => string },
): MdFileEntry[] {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter(e => e.isFile() && e.name.toLowerCase().endsWith(".md"))
      .map((e) => {
        const lowerName = e.name.toLowerCase()
        const variant = MD_VARIANT_MAP[lowerName] ?? ("other" as MdFileVariant)
        const filePath = path.join(dir, e.name)

        let size = 0
        try {
          size = fs.statSync(filePath).size
        } catch {
          size = 0
        }

        return {
          name: e.name,
          path: filePath,
          variant,
          size,
          oversized: size > OVERSIZE_THRESHOLD,
        } satisfies MdFileEntry
      })
      .sort((a, b) => {
        const va = VARIANT_ORDER[a.variant]
        const vb = VARIANT_ORDER[b.variant]
        if (va !== vb) return va - vb
        return a.name.localeCompare(b.name)
      })
  } catch {
    return []
  }
}

/**
 * 读取单个 Markdown 文件的内容（纯文本）
 * @param filePath 文件绝对路径
 * @param maxLines 最大读取行数（超限时截断），0 表示不限制
 * @returns 文件内容与是否实际发生截断，读取失败返回 null
 */
export function readMarkdownFile(
  filePath: string,
  maxLines = 0,
): { content: string, truncated: boolean } | null {
  const node = getNodeFsPathOs()
  if (!node) return null
  const { fs } = node

  try {
    if (!fs.existsSync(filePath)) return null
    const raw = fs.readFileSync(filePath, "utf-8")
    if (maxLines > 0) {
      const lines = raw.split("\n")
      if (lines.length > maxLines) {
        return { content: lines.slice(0, maxLines).join("\n"), truncated: true }
      }
    }
    return { content: raw, truncated: false }
  } catch {
    return null
  }
}
