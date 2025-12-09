/**
 * Everything HTTP API 服务
 * Everything是一个Windows本地文件搜索工具，支持HTTP API接口
 */

export interface EverythingSearchResult {
  name: string
  path: string
  size: number
  dateModified: string
  type: 'file' | 'folder'
}

export interface EverythingSearchOptions {
  query: string
  maxResults?: number
  matchCase?: boolean
  matchWholeWord?: boolean
  matchPath?: boolean
  regex?: boolean
  sort?: 'name' | 'path' | 'size' | 'date_modified'
  ascending?: boolean
}

export interface EverythingConfig {
  host: string
  port: number
}

const DEFAULT_CONFIG: EverythingConfig = {
  host: 'localhost',
  port: 80
}

/**
 * 检查Everything HTTP服务是否可用
 */
export async function checkEverythingService(config: EverythingConfig = DEFAULT_CONFIG): Promise<boolean> {
  try {
    const response = await fetch(`http://${config.host}:${config.port}/?search=test&json=1&count=1`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    })
    return response.ok
  } catch (error) {
    console.error('Everything服务不可用:', error)
    return false
  }
}

/**
 * 搜索文件
 */
export async function searchFiles(
  options: EverythingSearchOptions,
  config: EverythingConfig = DEFAULT_CONFIG
): Promise<EverythingSearchResult[]> {
  const {
    query,
    maxResults = 100,
    matchCase = false,
    matchWholeWord = false,
    matchPath = false,
    regex = false,
    sort = 'date_modified',
    ascending = false
  } = options

  // 构建URL参数
  const params = new URLSearchParams({
    search: query,
    json: '1',
    count: maxResults.toString(),
    path_column: '1',
    size_column: '1',
    date_modified_column: '1'
  })

  // 排序参数
  const sortMap: Record<string, string> = {
    name: 'name',
    path: 'path',
    size: 'size',
    date_modified: 'date_modified'
  }
  if (sortMap[sort]) {
    params.append('sort', sortMap[sort])
    params.append('ascending', ascending ? '1' : '0')
  }

  // 搜索选项
  if (matchCase) params.append('case', '1')
  if (matchWholeWord) params.append('wholeword', '1')
  if (matchPath) params.append('path', '1')
  if (regex) params.append('regex', '1')

  try {
    const response = await fetch(`http://${config.host}:${config.port}/?${params.toString()}`, {
      method: 'GET',
      signal: AbortSignal.timeout(10000)
    })

    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`)
    }

    const data = await response.json()

    // 解析结果
    const results: EverythingSearchResult[] = (data.results || []).map((item: any) => ({
      name: item.name || '',
      path: item.path || '',
      size: item.size || 0,
      dateModified: formatDate(item.date_modified),
      type: item.type === 'folder' ? 'folder' : 'file'
    }))

    return results
  } catch (error) {
    console.error('Everything搜索失败:', error)
    throw error
  }
}

/**
 * 格式化日期
 */
function formatDate(timestamp: number | string): string {
  if (!timestamp) return ''

  // Everything返回的是Windows FILETIME格式或Unix时间戳
  let date: Date
  if (typeof timestamp === 'number') {
    // 如果是大数字，可能是Windows FILETIME (100-nanosecond intervals since January 1, 1601)
    if (timestamp > 1e15) {
      // Windows FILETIME转换
      date = new Date((timestamp / 10000) - 11644473600000)
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

  if (isNaN(date.getTime())) return ''

  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i]
}

/**
 * 获取文件扩展名
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  if (lastDot === -1 || lastDot === 0) return ''
  return filename.substring(lastDot + 1).toLowerCase()
}

/**
 * 根据扩展名获取文件图标类型
 */
export function getFileIconType(filename: string, isFolder: boolean): string {
  if (isFolder) return 'folder'

  const ext = getFileExtension(filename)

  const iconMap: Record<string, string> = {
    // 文档
    pdf: 'pdf',
    doc: 'word',
    docx: 'word',
    xls: 'excel',
    xlsx: 'excel',
    ppt: 'ppt',
    pptx: 'ppt',
    txt: 'text',
    md: 'markdown',
    // 图片
    jpg: 'image',
    jpeg: 'image',
    png: 'image',
    gif: 'image',
    svg: 'image',
    webp: 'image',
    bmp: 'image',
    ico: 'image',
    // 视频
    mp4: 'video',
    avi: 'video',
    mkv: 'video',
    mov: 'video',
    wmv: 'video',
    flv: 'video',
    // 音频
    mp3: 'audio',
    wav: 'audio',
    flac: 'audio',
    aac: 'audio',
    ogg: 'audio',
    // 压缩包
    zip: 'archive',
    rar: 'archive',
    '7z': 'archive',
    tar: 'archive',
    gz: 'archive',
    // 代码
    js: 'code',
    ts: 'code',
    jsx: 'code',
    tsx: 'code',
    vue: 'code',
    html: 'code',
    css: 'code',
    scss: 'code',
    less: 'code',
    json: 'code',
    xml: 'code',
    py: 'code',
    java: 'code',
    c: 'code',
    cpp: 'code',
    h: 'code',
    go: 'code',
    rs: 'code',
    rb: 'code',
    php: 'code',
    sql: 'code',
    sh: 'code',
    bat: 'code',
    // 可执行文件
    exe: 'executable',
    msi: 'executable',
    dll: 'executable',
    // 思源笔记
    sy: 'siyuan'
  }

  return iconMap[ext] || 'file'
}

/**
 * 用系统默认程序打开文件
 */
export async function openFile(filePath: string): Promise<void> {
  try {
    // 使用Electron的shell模块
    const { shell } = window.require('@electron/remote')
    await shell.openPath(filePath)
  } catch (error) {
    console.error('打开文件失败:', error)
    throw error
  }
}

/**
 * 在资源管理器中显示文件
 */
export async function showInExplorer(filePath: string): Promise<void> {
  try {
    const { shell } = window.require('@electron/remote')
    shell.showItemInFolder(filePath)
  } catch (error) {
    console.error('显示文件失败:', error)
    throw error
  }
}
