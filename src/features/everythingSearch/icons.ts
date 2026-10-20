// 搜索结果条目的图标判定：文件夹固定 folder，文件按扩展名粗分到已注册 IconKey。
//
// ⚠️ 与 `src/features/diskBrowser/utils/fileKind.ts` 的 `entryIconKey()` 职责重合，
//    因 AGENTS.md § 跨功能联动规则「功能模块之间禁止直接导入」而各自维护一份；
//    两份映射如需统一，应下沉到共享层 `src/utils/fileKind.ts`（本次未跨范围改动）。
import type { IconKey } from "@/components/kit/icons"

/** 条目形态的最小输入（只取判定需要的两个字段，便于父组件直接传结果项） */
export interface EntryIconInput {
  /** 文件名（含扩展名） */
  name: string
  /** 条目类型 */
  type: "file" | "folder"
}

/** 分类 → 图标键（只保留本模块搜索结果里真实出现的类型，全部为已注册 IconKey） */
const KIND_ICON: Record<"document" | "image" | "media" | "archive" | "code" | "executable" | "other", IconKey> = {
  document: "file",
  image: "image",
  media: "play",
  archive: "folder",
  code: "code",
  executable: "settings",
  other: "file",
}

/** 分类 → 扩展名集合（小写，无点） */
const EXT_KIND: Record<Exclude<keyof typeof KIND_ICON, "other">, readonly string[]> = {
  document: ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "md"],
  image: ["jpg", "jpeg", "png", "gif", "svg", "webp", "bmp", "ico", "avif", "tiff"],
  media: ["mp4", "avi", "mkv", "mov", "wmv", "flv", "mp3", "wav", "flac", "aac", "ogg", "m4a"],
  archive: ["zip", "rar", "7z", "tar", "gz", "bz2", "xz", "iso"],
  code: ["js", "ts", "jsx", "tsx", "vue", "html", "css", "scss", "less", "json", "xml", "py", "java"],
  executable: ["exe", "msi", "dll", "bat", "cmd", "ps1", "sh"],
}

/**
 * 取小写扩展名。
 * 以**最后一个点**为准（`archive.tar.gz` → `gz`）；点位于首位（`.gitignore`）或末尾视为无扩展名。
 */
function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".")
  if (dot <= 0 || dot === fileName.length - 1) return ""
  return fileName.slice(dot + 1).toLowerCase()
}

/** 按扩展名取分类（未知扩展名归 other） */
function classify(fileName: string): keyof typeof KIND_ICON {
  const ext = getExtension(fileName)
  if (!ext) return "other"
  for (const [kind, exts] of Object.entries(EXT_KIND) as [keyof typeof EXT_KIND, readonly string[]][]) {
    if (exts.includes(ext)) return kind
  }
  return "other"
}

/** 按条目形态取图标键：文件夹恒为 folder，文件按扩展名分类，未知类型回落 file */
export function entryIconKey(item: EntryIconInput): IconKey {
  if (item.type === "folder") return "folder"
  return KIND_ICON[classify(item.name)]
}
