/**
 * Everything HTTP API 服务
 * Everything是一个Windows本地文件搜索工具，支持HTTP API接口
 */

export interface EverythingSearchResult {
  name: string
  path: string
  size: number
  dateModified: string
  type: "file" | "folder"
}

export interface EverythingSearchOptions {
  query: string
  maxResults?: number
  matchCase?: boolean
  matchWholeWord?: boolean
  matchPath?: boolean
  regex?: boolean
  sort?: "name" | "path" | "size" | "date_modified"
  ascending?: boolean
}

export interface EverythingConfig {
  host: string
  port: number
}

/**
 * 检查Everything HTTP服务是否可用
 */
export async function checkEverythingService(
  config: EverythingConfig,
): Promise<boolean> {
  try {
    const response = await fetch(
      `http://${config.host}:${config.port}/?search=test&json=1&count=1`,
      {
        method: "GET",
        signal: AbortSignal.timeout(3000),
      },
    )
    return response.ok
  } catch (error) {
    console.error("Everything服务不可用:", error)
    return false
  }
}

/**
 * 搜索文件
 */
export async function searchFiles(
  options: EverythingSearchOptions,
  config: EverythingConfig,
): Promise<EverythingSearchResult[]> {
  const {
    query,
    maxResults = 100,
    matchCase = false,
    matchWholeWord = false,
    matchPath = false,
    regex = false,
    sort = "date_modified",
    ascending = false,
  } = options

  // 构建URL参数
  const params = new URLSearchParams({
    search: query,
    json: "1",
    count: maxResults.toString(),
    path_column: "1",
    size_column: "1",
    date_modified_column: "1",
  })

  // 排序参数（TypeScript 确保 sort 仅可能为有效值）
  params.append("sort", sort)
  params.append("ascending", ascending ? "1" : "0")

  // 搜索选项
  if (matchCase) params.append("case", "1")
  if (matchWholeWord) params.append("wholeword", "1")
  if (matchPath) params.append("path", "1")
  if (regex) params.append("regex", "1")

  try {
    const response = await fetch(
      `http://${config.host}:${config.port}/?${params.toString()}`,
      {
        method: "GET",
        signal: AbortSignal.timeout(10000),
      },
    )

    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`)
    }

    const data = await response.json()

    // 解析结果
    const results: EverythingSearchResult[] = (data.results || []).map(
      (item: any) => ({
        name: item.name || "",
        path: item.path || "",
        size: item.size || 0,
        dateModified: formatDate(item.date_modified),
        type: item.type === "folder" ? "folder" : "file",
      }),
    )

    return results
  } catch (error) {
    console.error("Everything搜索失败:", error)
    throw error
  }
}

/**
 * 格式化日期
 */
function formatDate(timestamp: number | string): string {
  if (!timestamp) return ""

  // Everything返回的是Windows FILETIME格式或Unix时间戳
  let date: Date
  if (typeof timestamp === "number") {
    // 如果是大数字，可能是Windows FILETIME (100-nanosecond intervals since January 1, 1601)
    if (timestamp > 1e15) {
      // Windows FILETIME转换
      date = new Date(timestamp / 10000 - 11644473600000)
    } else if (timestamp > 1e12) {
      // 毫秒时间戳
      date = new Date(timestamp)
    } else {
      // 秒时间戳
      date = new Date(timestamp * 1000)
    }
  } else {
    date = new Date(timestamp)
  }

  if (isNaN(date.getTime())) return ""

  const locale = (typeof navigator !== "undefined" && navigator.language) || "zh-CN"
  return date.toLocaleString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"

  const units = ["B", "KB", "MB", "GB", "TB"]
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${units[i]}`
}

/**
 * 拼接搜索结果项的完整路径（path\\name）
 */
export function getFullPath(item: EverythingSearchResult): string {
  return item.path ? `${item.path}\\${item.name}` : item.name
}

/**
 * 获取文件扩展名
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".")
  if (lastDot === -1 || lastDot === 0) return ""
  return filename.substring(lastDot + 1).toLowerCase()
}

/**
 * 根据扩展名获取文件图标类型
 */
export function getFileIconType(filename: string, isFolder: boolean): string {
  if (isFolder) return "folder"

  const ext = getFileExtension(filename)

  const iconMap: Record<string, string> = {
    // 文档
    "pdf": "pdf",
    "doc": "word",
    "docx": "word",
    "xls": "excel",
    "xlsx": "excel",
    "ppt": "ppt",
    "pptx": "ppt",
    "txt": "text",
    "md": "markdown",
    // 图片
    "jpg": "image",
    "jpeg": "image",
    "png": "image",
    "gif": "image",
    "svg": "image",
    "webp": "image",
    "bmp": "image",
    "ico": "image",
    // 视频
    "mp4": "video",
    "avi": "video",
    "mkv": "video",
    "mov": "video",
    "wmv": "video",
    "flv": "video",
    // 音频
    "mp3": "audio",
    "wav": "audio",
    "flac": "audio",
    "aac": "audio",
    "ogg": "audio",
    // 压缩包
    "zip": "archive",
    "rar": "archive",
    "7z": "archive",
    "tar": "archive",
    "gz": "archive",
    // 代码
    "js": "code",
    "ts": "code",
    "jsx": "code",
    "tsx": "code",
    "vue": "code",
    "html": "code",
    "css": "code",
    "scss": "code",
    "less": "code",
    "json": "code",
    "xml": "code",
    "py": "code",
    "java": "code",
    "c": "code",
    "cpp": "code",
    "h": "code",
    "go": "code",
    "rs": "code",
    "rb": "code",
    "php": "code",
    "sql": "code",
    "sh": "code",
    "bat": "code",
    // 可执行文件
    "exe": "executable",
    "msi": "executable",
    "dll": "executable",
    // 思源笔记
    "sy": "siyuan",
  }

  return iconMap[ext] || "file"
}

/** 获取 Electron shell 模块（懒加载单例） */
let _shell: any = undefined
function getElectronShell() {
  if (!_shell) {
    _shell = window.require("@electron/remote").shell
  }
  return _shell
}

/**
 * 用系统默认程序打开文件
 */
export async function openFile(filePath: string): Promise<void> {
  try {
    await getElectronShell().openPath(filePath)
  } catch (error) {
    console.error("打开文件失败:", error)
    throw error
  }
}

/**
 * 在资源管理器中显示文件
 */
export function showInExplorer(filePath: string): void {
  try {
    getElectronShell().showItemInFolder(filePath)
  } catch (error) {
    console.error("显示文件失败:", error)
    throw error
  }
}

/**
 * 删除文件（移入回收站）
 * 优先使用 Electron shell.trashItem，不可用时通过 PowerShell 移入回收站
 */
export async function deleteFile(filePath: string): Promise<void> {
  try {
    const shell = getElectronShell()
    // Electron 22+ 标准 API
    if (typeof shell.trashItem === "function") {
      await shell.trashItem(filePath)
      return
    }
    // 旧版 Electron 备选 API
    if (typeof shell.moveItemToTrash === "function") {
      shell.moveItemToTrash(filePath)
      return
    }
    // 兜底：PowerShell 移入回收站
    const { execSync } = window.require("child_process") as typeof import("child_process")
    execSync(
      `powershell -NoProfile -Command "Add-Type -AssemblyName Microsoft.VisualBasic;[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile('${filePath.replace(/'/g, "''")}','OnlyErrorDialogs','SendToRecycleBin')"`,
      { timeout: 5000 },
    )
  } catch (error) {
    console.error("删除文件失败:", error)
    throw error
  }
}
