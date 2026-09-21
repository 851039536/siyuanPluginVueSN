// 文件格式分类 — 按扩展名映射到已注册的 IconKey，供列表行图标区分类型
import type { IconKey } from "@/config/icons"

/** 分类枚举：粗分 8 类，覆盖桌面/磁盘常见文件类型 */
export type FileKind =
  | "folder"
  | "image"
  | "video"
  | "audio"
  | "archive"
  | "code"
  | "document"
  | "link"
  | "other"

/** 分类 → 已注册图标键（全部取自 COMMON_ICONS，零新增图标） */
const KIND_ICON: Record<FileKind, IconKey> = {
  folder: "folder",
  image: "image",
  video: "video",
  audio: "headphones",
  archive: "archiveOutline",
  code: "code",
  document: "file",
  link: "linkVariant",
  other: "fileOutline",
}

/** 图片扩展名（含矢量与相机原始格式） */
const IMAGE_EXTS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif", "heic", "tif", "tiff", "psd", "ai",
])

/**
 * 视频扩展名。
 * ⚠️ **有意不含 `ts`**：`.ts` 与 TypeScript 源码扩展名冲突，而后者在日常使用中
 * 远多于 MPEG-TS 视频流（且本项目用户群体以开发者为主），故 `.ts` 归入 `code`。
 */
const VIDEO_EXTS = new Set([
  "mp4", "mkv", "avi", "mov", "wmv", "flv", "webm", "m4v", "mpg", "mpeg", "rmvb", "3gp",
])

/** 音频扩展名 */
const AUDIO_EXTS = new Set([
  "mp3", "wav", "flac", "aac", "ogg", "m4a", "wma", "ape", "opus", "mid", "midi",
])

/** 压缩包 / 镜像扩展名 */
const ARCHIVE_EXTS = new Set([
  "zip", "rar", "7z", "tar", "gz", "bz2", "xz", "tgz", "iso", "cab", "jar", "war",
])

/** 代码 / 标记 / 配置扩展名 */
const CODE_EXTS = new Set([
  "js", "mjs", "cjs", "ts", "mts", "cts", "tsx", "jsx", "vue", "svelte", "json", "jsonc", "html", "htm",
  "css", "scss", "sass", "less", "md", "markdown", "xml", "yml", "yaml", "toml", "ini", "conf",
  "py", "go", "rs", "java", "kt", "cs", "c", "h", "cpp", "hpp", "rb", "php", "swift",
  "sh", "bash", "zsh", "ps1", "bat", "cmd", "sql", "lua", "r", "dart", "gradle", "cmake", "dockerfile",
])

/** 文档扩展名（Office / PDF / 纯文本） */
const DOCUMENT_EXTS = new Set([
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "csv", "txt", "rtf",
  "odt", "ods", "odp", "epub", "mobi", "log", "tex",
])

/**
 * 系统 / 快捷方式类扩展名。
 * 实测桌面常见 `.lnk`（快捷方式）与 `.rdp`（远程桌面），归入 `other` 会让一成
 * 桌面项都顶着同一个通用文档图标，故单列一类便于辨认。
 */
const SYSTEM_LINK_EXTS = new Set([
  "lnk", "url", "rdp", "lnk2", "website", "desktop",
])

/**
 * 取小写扩展名（无扩展名返回空串）。
 * ⚠️ 以**最后一个点**为准（`archive.tar.gz` → `gz`），并按扩展名分类而非全名匹配，
 * 故 `Makefile`、`LICENSE` 这类无扩展名文件会落入 `other`。
 */
export function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".")
  // 点在首位（`.gitignore`）或无点 ⇒ 视为无扩展名
  if (dot <= 0 || dot === fileName.length - 1) return ""
  return fileName.slice(dot + 1).toLowerCase()
}

/** 按文件名判定文件格式分类（文件夹请传 `isFile: false`，本函数只处理文件） */
export function getFileKind(fileName: string): FileKind {
  const ext = getExtension(fileName)
  if (!ext) return "other"
  if (IMAGE_EXTS.has(ext)) return "image"
  if (VIDEO_EXTS.has(ext)) return "video"
  if (AUDIO_EXTS.has(ext)) return "audio"
  if (ARCHIVE_EXTS.has(ext)) return "archive"
  if (CODE_EXTS.has(ext)) return "code"
  if (DOCUMENT_EXTS.has(ext)) return "document"
  if (SYSTEM_LINK_EXTS.has(ext)) return "link"
  return "other"
}

/** 文件格式分类 → 已注册图标键 */
export function fileKindIcon(kind: FileKind): IconKey {
  return KIND_ICON[kind]
}

/**
 * Windows **永久隐藏扩展名**的集合（对应注册表 `NeverShowExt` 标志）。
 *
 * 资源管理器对这类扩展名**无论如何都不显示**（不受「隐藏已知扩展名」开关影响）——
 * 实测 `lnkfile` / `InternetShortcut` 等 12 个 ProgID 带此标志。
 * 本面板照搬同一规则，否则桌面会出现 `chrome.exe.lnk` 这类资源管理器里看不到的尾巴。
 *
 * 其余扩展名（`.txt` / `.docx` …）跟随系统设置，本面板无法读取该开关，
 * 故一律如实显示 —— 与「用户选择显示扩展名」的常见配置一致。
 */
const NEVER_SHOW_EXTS = new Set([
  "lnk", "url", "pif", "scf", "website",
  "appref-ms", "appcontent-ms", "accountpicture-ms",
  "library-ms", "search-ms", "searchconnector-ms", "settingcontent-ms",
])

/**
 * 条目的**显示名**：剥掉 Windows 永久隐藏的扩展名（如 `chrome.exe.lnk` → `chrome.exe`）。
 *
 * ⚠️ 原始文件名（含扩展名）仍保留在 `FolderInfo.name` 中 —— 列表行的悬浮提示与
 * 复制路径用的是原始值，故剥名只影响视觉呈现，不损失信息。
 */
export function getDisplayName(fileName: string): string {
  const dot = fileName.lastIndexOf(".")
  if (dot <= 0) return fileName
  const ext = fileName.slice(dot + 1).toLowerCase()
  return NEVER_SHOW_EXTS.has(ext) ? fileName.slice(0, dot) : fileName
}

/** 按条目形态直接取图标键：文件夹用 folder，文件按扩展名分类 */
export function entryIconKey(isFile: boolean | undefined, fileName: string): IconKey {
  if (!isFile) return KIND_ICON.folder
  return fileKindIcon(getFileKind(fileName))
}

/**
 * 是否为可过滤的系统文件（Windows 下 `readdirSync` 读不到隐藏/系统属性，
 * 只能按已知文件名判断）。实测桌面存在 `desktop.ini`，不过滤会直接显示。
 */
const SYSTEM_FILE_NAMES = new Set([
  "desktop.ini",
  "thumbs.db",
  "$recycle.bin",
  "autorun.inf",
  ".ds_store",
  "icon\r",
])

/** 是否为应过滤掉的系统文件/目录 */
export function isSystemEntry(name: string): boolean {
  return SYSTEM_FILE_NAMES.has(name.toLowerCase())
}
