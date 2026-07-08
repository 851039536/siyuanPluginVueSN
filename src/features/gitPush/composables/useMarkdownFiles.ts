/**
 * gitPush — 项目根目录 Markdown 文件扫描工具
 *
 * 读取指定目录下的 *.md 文件，按约定排序（README → CLAUDE → CODEBUDDY → 其他），
 * 返回标准化的文件元数据列表供 badge 展示与弹窗预览使用。
 */
import { getNodeFsPathOs } from "@/utils/nodeModules"

/** Markdown 文件变体类型 — 决定 badge 视觉样式 */
export type MdFileVariant = "readme" | "claude" | "codebuddy" | "other"

/** 单个 Markdown 文件元数据 */
export interface MdFileEntry {
  /** 原始文件名（保留大小写，如 README.md） */
  name: string
  /** 绝对路径 */
  path: string
  /** 变体类型（决定 badge 颜色与排序） */
  variant: MdFileVariant
  /** 显示标签（README / CLAUDE / CODEBUDDY / 原始文件名） */
  label: string
  /** 文件大小（bytes） */
  size: number
  /** 是否超过 1MB 阈值 */
  oversized: boolean
}

/** 文件大小阈值：1MB */
const OVERSIZE_THRESHOLD = 1024 * 1024

/** 变体优先级（升序排列） */
const VARIANT_ORDER: Record<MdFileVariant, number> = {
  readme: 0,
  claude: 1,
  codebuddy: 2,
  other: 3,
}

/** 小写文件名 → 变体的映射表 */
const MD_VARIANT_MAP: Record<string, MdFileVariant> = {
  "readme.md": "readme",
  "claude.md": "claude",
  "codebuddy.md": "codebuddy",
}

/**
 * 扫描指定目录下的所有 Markdown 文件
 * @param dir 项目根目录绝对路径
 * @returns Markdown 文件元数据数组（按约定排序），fs 不可用时返回空数组
 */
export function scanMarkdownFiles(dir: string): MdFileEntry[] {
  const node = getNodeFsPathOs()
  if (!node) return []
  const { fs, path } = node

  try {
    if (!fs.existsSync(dir)) return []
  } catch {
    return []
  }

  let entries: ReturnType<typeof fs.readdirSync>
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }

  return entries
    .filter(e => e.isFile() && e.name.toLowerCase().endsWith(".md"))
    .map((e) => {
      const lowerName = e.name.toLowerCase()
      const variant = MD_VARIANT_MAP[lowerName] ?? ("other" as MdFileVariant)
      const filePath = path.join(dir, e.name)
      const baseName = e.name.replace(/\.md$/i, "")
      const label = variant === "other" ? e.name : baseName.toUpperCase()

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
        label,
        size,
        oversized: size > OVERSIZE_THRESHOLD,
      } satisfies MdFileEntry
    })
    .sort((a, b) => {
      const va = VARIANT_ORDER[a.variant] ?? 3
      const vb = VARIANT_ORDER[b.variant] ?? 3
      if (va !== vb) return va - vb
      return a.name.localeCompare(b.name)
    })
}

/**
 * 读取单个 Markdown 文件的内容（纯文本）
 * @param filePath 文件绝对路径
 * @param maxLines 最大读取行数（超限时截断），0 表示不限制
 * @returns 文件内容字符串，读取失败返回 null
 */
export function readMarkdownFile(
  filePath: string,
  maxLines = 0,
): string | null {
  const node = getNodeFsPathOs()
  if (!node) return null
  const { fs } = node

  try {
    if (!fs.existsSync(filePath)) return null
    const raw = fs.readFileSync(filePath, "utf-8")
    if (maxLines > 0) {
      const lines = raw.split("\n")
      if (lines.length > maxLines) {
        return lines.slice(0, maxLines).join("\n")
      }
    }
    return raw
  } catch {
    return null
  }
}
