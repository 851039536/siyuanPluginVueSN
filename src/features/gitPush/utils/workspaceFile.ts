// gitPush 工作区文件浏览 — 文件类型分类、图标映射与只读预览读取（纯本地 fs，无写盘）
//
// 预览读取的边界（防止大文件/二进制文件拖垮弹窗）：
// - 文本只读前 256 KB，超出标记 truncated；
// - 图片只预览 2 MB 以内，超出只显示元信息；
// - 前 8 KB 出现 NUL 字节即判定为二进制，不渲染内容。
// 路径来自 git 输出，仍做一次越界校验（解析后必须落在项目根内），属外部数据边界。
import { getNodeFsPathOs } from "@/utils/nodeModules"

/** 可预览的文件大类（决定走文本渲染还是图片渲染） */
export type WorkspaceFileKind = "text" | "markdown" | "image"

/** 预览结果判别联合（kind 决定模板分支） */
export interface WorkspaceFilePreview {
  kind: "text" | "markdown" | "image" | "binary" | "oversized" | "missing" | "error"
  /** 文件字节数（missing/error 为 0） */
  size: number
  /** 文本内容（仅 text/markdown） */
  content?: string
  /** 图片 data URL（仅 image） */
  dataUrl?: string
  /** 文本是否因超出上限被截断 */
  truncated?: boolean
  /** 读取失败原因（仅 error） */
  error?: string
}

/** 文本预览读取上限（256 KB） */
export const TEXT_PREVIEW_LIMIT = 256 * 1024
/** 图片预览读取上限（2 MB） */
export const IMAGE_PREVIEW_LIMIT = 2 * 1024 * 1024
/** 二进制嗅探长度（前 8 KB 出现 NUL 即判二进制） */
const BINARY_SNIFF_BYTES = 8000

/** 图片扩展名 → MIME（svg 视为文本，走代码预览） */
const IMAGE_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  ico: "image/x-icon",
  avif: "image/avif",
}

/** 扩展名 → 图标（Iconify MDI，全集已离线预加载） */
const EXT_ICONS: Record<string, string> = {
  ts: "mdi:language-typescript",
  mts: "mdi:language-typescript",
  cts: "mdi:language-typescript",
  tsx: "mdi:language-typescript",
  js: "mdi:language-javascript",
  mjs: "mdi:language-javascript",
  cjs: "mdi:language-javascript",
  jsx: "mdi:language-javascript",
  vue: "mdi:vuejs",
  svelte: "mdi:language-javascript",
  json: "mdi:code-json",
  jsonc: "mdi:code-json",
  md: "mdi:language-markdown",
  markdown: "mdi:language-markdown",
  mdx: "mdi:language-markdown",
  css: "mdi:language-css3",
  scss: "mdi:language-css3",
  sass: "mdi:language-css3",
  less: "mdi:language-css3",
  html: "mdi:language-html5",
  htm: "mdi:language-html5",
  xml: "mdi:xml",
  svg: "mdi:svg",
  py: "mdi:language-python",
  java: "mdi:language-java",
  kt: "mdi:language-kotlin",
  kts: "mdi:language-kotlin",
  go: "mdi:language-go",
  rs: "mdi:language-rust",
  c: "mdi:language-c",
  h: "mdi:language-c",
  cpp: "mdi:language-cpp",
  cc: "mdi:language-cpp",
  hpp: "mdi:language-cpp",
  cs: "mdi:language-csharp",
  php: "mdi:language-php",
  rb: "mdi:language-ruby",
  swift: "mdi:language-swift",
  sh: "mdi:bash",
  bash: "mdi:bash",
  zsh: "mdi:bash",
  ps1: "mdi:powershell",
  yml: "mdi:file-cog-outline",
  yaml: "mdi:file-cog-outline",
  toml: "mdi:file-cog-outline",
  ini: "mdi:file-cog-outline",
  env: "mdi:file-cog-outline",
  lock: "mdi:file-lock-outline",
  png: "mdi:file-image-outline",
  jpg: "mdi:file-image-outline",
  jpeg: "mdi:file-image-outline",
  gif: "mdi:file-image-outline",
  webp: "mdi:file-image-outline",
  bmp: "mdi:file-image-outline",
  ico: "mdi:file-image-outline",
  avif: "mdi:file-image-outline",
  pdf: "mdi:file-pdf-box",
  zip: "mdi:folder-zip-outline",
  gz: "mdi:folder-zip-outline",
  tar: "mdi:folder-zip-outline",
  jar: "mdi:folder-zip-outline",
}

/** 特殊文件名 → 图标（优先于扩展名判定） */
const NAME_ICONS: Record<string, string> = {
  dockerfile: "mdi:docker",
  "docker-compose.yml": "mdi:docker",
  "docker-compose.yaml": "mdi:docker",
  makefile: "mdi:file-cog-outline",
  license: "mdi:license",
  "license.md": "mdi:license",
  ".gitignore": "mdi:git",
  ".gitattributes": "mdi:git",
  "package.json": "mdi:npm",
  "pnpm-lock.yaml": "mdi:lock-outline",
  "package-lock.json": "mdi:lock-outline",
  "yarn.lock": "mdi:lock-outline",
}

/** 取路径的 basename（git 路径统一 / 分隔） */
function basename(path: string): string {
  const idx = path.lastIndexOf("/")
  return idx === -1 ? path : path.slice(idx + 1)
}

/** 取小写扩展名（无扩展名返回空串） */
function extname(path: string): string {
  const name = basename(path)
  const idx = name.lastIndexOf(".")
  return idx <= 0 ? "" : name.slice(idx + 1).toLowerCase()
}

/** 文件图标（未知类型回落通用文件图标；目录图标由树组件按展开态提供） */
export function workspaceFileIcon(path: string): string {
  const name = basename(path).toLowerCase()
  const byName = NAME_ICONS[name]
  if (byName) return byName
  return EXT_ICONS[extname(name)] ?? "mdi:file-outline"
}

/** 文件大类：图片 / Markdown / 其余按文本处理（二进制在执行期嗅探） */
export function classifyWorkspaceFile(path: string): WorkspaceFileKind {
  const ext = extname(path)
  if (IMAGE_MIME[ext]) return "image"
  if (ext === "md" || ext === "markdown" || ext === "mdx") return "markdown"
  return "text"
}

/** 前 8 KB 是否含 NUL 字节（文本文件不会出现，二进制几乎必然出现） */
function isBinaryBuffer(buf: Uint8Array): boolean {
  const len = Math.min(buf.length, BINARY_SNIFF_BYTES)
  for (let i = 0; i < len; i++) {
    if (buf[i] === 0) return true
  }
  return false
}

/**
 * 把仓库相对路径解析为绝对路径（/ → 平台分隔符），并做越界校验。
 * @returns 绝对路径；Node 不可用或解析后落在项目根之外时返回 null
 */
export function resolveWorkspacePath(projectRoot: string, relPath: string): string | null {
  const node = getNodeFsPathOs()
  if (!node) return null
  const { path } = node
  const root = path.resolve(projectRoot)
  const absPath = path.resolve(root, relPath.split("/").join(path.sep))
  if (absPath !== root && !absPath.startsWith(root + path.sep)) return null
  return absPath
}

/**
 * 只读预览工作区文件。
 * @param projectRoot 项目根绝对路径
 * @param relPath 相对仓库根的文件路径（/ 分隔，来自 git 输出）
 */
export function readWorkspaceFilePreview(projectRoot: string, relPath: string): WorkspaceFilePreview {
  const node = getNodeFsPathOs()
  const absPath = resolveWorkspacePath(projectRoot, relPath)
  if (!node || !absPath) {
    return { kind: "error", size: 0, error: "路径不可用或超出项目根目录" }
  }
  const { fs } = node

  try {
    if (!fs.existsSync(absPath)) return { kind: "missing", size: 0 }
    const size = fs.statSync(absPath).size
    const kind = classifyWorkspaceFile(relPath)

    if (kind === "image") {
      if (size > IMAGE_PREVIEW_LIMIT) return { kind: "oversized", size }
      const buf = fs.readFileSync(absPath)
      const mime = IMAGE_MIME[extname(relPath)] ?? "application/octet-stream"
      return {
        kind: "image",
        size,
        dataUrl: `data:${mime};base64,${Buffer.from(buf).toString("base64")}`,
      }
    }

    // 文本只读前缀：不能先整份 readFileSync 再截断（几 GB 的日志会把渲染进程读爆）
    const truncated = size > TEXT_PREVIEW_LIMIT
    const limit = Math.min(size, TEXT_PREVIEW_LIMIT)
    const buf = Buffer.alloc(limit)
    const readBytes = (() => {
      const fd = fs.openSync(absPath, "r")
      try {
        return fs.readSync(fd, buf, 0, limit, 0)
      } finally {
        fs.closeSync(fd)
      }
    })()
    const slice = buf.subarray(0, readBytes)
    if (isBinaryBuffer(slice)) return { kind: "binary", size }
    return {
      kind,
      size,
      content: slice.toString("utf8"),
      truncated,
    }
  } catch (e) {
    return { kind: "error", size: 0, error: e instanceof Error ? e.message : String(e) }
  }
}
