/**
 * yt-dlp 视频下载模块
 * 支持从 YouTube、Bilibili 等网站下载视频
 */

import { getWorkspacePath } from './utils'

/**
 * yt-dlp 下载结果
 */
export interface YtdlpResult {
  success: boolean
  outputPath?: string
  fileName?: string
  error?: string
  progress?: number
}

/**
 * yt-dlp 下载参数
 */
export interface YtdlpDownloadParams {
  url: string
  outputPath?: string
  quality?: 'best' | '1080p' | '720p' | '480p' | '360p'
  format?: 'mp4' | 'webm' | 'mkv' | 'best'
  subtitle?: boolean
  onProgress?: (progress: number, status: string) => void
}

/**
 * 检查 yt-dlp 是否可用
 */
export function isYtdlpAvailable(): boolean {
  // 检查是否在 Electron 环境中
  if (typeof window !== 'undefined' && (window as any).require) {
    try {
      const { execSync } = (window as any).require('child_process')
      // 尝试检查 yt-dlp 命令
      execSync('yt-dlp --version', { stdio: 'ignore' })
      return true
    } catch (e) {
      return false
    }
  }
  return false
}

/**
 * 获取 yt-dlp 可执行文件路径
 */
function getYtdlpPath(): string {
  const fs = (window as any).require('fs')

  // 1. 从 localStorage 读取用户自定义路径（最高优先级）
  const customPath = localStorage.getItem('siyuan-ytdlp-path')
  if (customPath) {
    try {
      if (fs.existsSync(customPath)) {
        return customPath
      }
    } catch (e) {
      // 继续尝试其他路径
    }
  }

  // 2. Windows 常见路径
  const platform = (window as any).require('os').platform()
  if (platform === 'win32') {
    const windowsPaths = [
      'E:\\Program\\yt-dlp.exe',  // 默认路径（最高优先级）
      'yt-dlp.exe',
      'yt-dlp',
      'C:\\yt-dlp\\yt-dlp.exe',
      'C:\\Users\\%USERNAME%\\AppData\\Roaming\\Python\\Scripts\\yt-dlp.exe',
      'D:\\yt-dlp\\yt-dlp.exe',
      'E:\\yt-dlp\\yt-dlp.exe',
    ]

    for (const path of windowsPaths) {
      try {
        // 展开环境变量
        const expandedPath = path.replace('%USERNAME%', (window as any).require('os').userInfo().username)
        if (fs.existsSync(expandedPath)) {
          return expandedPath
        }
      } catch (e) {
        // 继续尝试下一个路径
      }
    }
  }

  // 3. macOS/Linux 常见路径
  const unixPaths = [
    'yt-dlp',
    '/usr/local/bin/yt-dlp',
    '/usr/bin/yt-dlp',
    '/opt/homebrew/bin/yt-dlp',
    '~/.local/bin/yt-dlp',
  ]

  for (const path of unixPaths) {
    try {
      // 展开波浪号
      const expandedPath = path.replace('~', (window as any).require('os').homedir())
      if (fs.existsSync(expandedPath)) {
        return expandedPath
      }
    } catch (e) {
      // 继续尝试下一个路径
    }
  }

  // 4. 如果都没找到，返回默认命令（依赖 PATH）
  return 'yt-dlp'
}

/**
 * 设置自定义 yt-dlp 路径
 */
export function setYtdlpPath(path: string): boolean {
  try {
    const fs = (window as any).require('fs')
    if (fs.existsSync(path)) {
      localStorage.setItem('siyuan-ytdlp-path', path)
      return true
    }
    return false
  } catch (e) {
    return false
  }
}

/**
 * 获取当前 yt-dlp 路径（用于显示）
 */
export function getCurrentYtdlpPath(): string {
  return getYtdlpPath()
}

/**
 * 清除自定义 yt-dlp 路径
 */
export function clearYtdlpPath(): void {
  localStorage.removeItem('siyuan-ytdlp-path')
}

/**
 * 获取 yt-dlp 版本信息
 */
export async function getYtdlpVersion(): Promise<string> {
  try {
    const { execSync } = (window as any).require('child_process')
    const version = execSync(`${getYtdlpPath()} --version`, { encoding: 'utf8' })
    return version.trim()
  } catch (e) {
    return 'unknown'
  }
}

/**
 * 解析下载质量参数
 */
function getQualityFormat(quality: string, format: string): string {
  if (format === 'best') {
    return 'bestvideo+bestaudio/best'
  }

  const qualityMap: Record<string, string> = {
    'best': 'bestvideo[height<=?1080]+bestaudio/best',
    '1080p': 'bestvideo[height<=1080]+bestaudio/best',
    '720p': 'bestvideo[height<=720]+bestaudio/best',
    '480p': 'bestvideo[height<=480]+bestaudio/best',
    '360p': 'bestvideo[height<=360]+bestaudio/best',
  }

  return qualityMap[quality] || qualityMap['best']
}

/**
 * 下载视频
 */
export async function downloadVideo(params: YtdlpDownloadParams): Promise<YtdlpResult> {
  const { url, quality = 'best', format = 'mp4', subtitle = false, onProgress } = params

  if (!url) {
    return {
      success: false,
      error: '请输入视频 URL'
    }
  }

  try {
    const { spawn } = (window as any).require('child_process')
    const ytdlpPath = getYtdlpPath()
    const workspacePath = await getWorkspacePath()
    const outputDir = params.outputPath || `${workspacePath}/data/video`

    // 构建命令参数
    const args: string[] = []

    // 输入 URL
    args.push(url)

    // 输出路径和文件名模板
    args.push('-o', `${outputDir}/%(title)s.%(ext)s`)

    // 格式选择
    if (format === 'mp4') {
      args.push('-f', getQualityFormat(quality, format))
      args.push('--merge-output-format', 'mp4')
    } else if (format === 'best') {
      args.push('-f', 'bestvideo+bestaudio/best')
    } else {
      args.push('-f', getQualityFormat(quality, format))
      args.push('--merge-output-format', format)
    }

    // 下载字幕
    if (subtitle) {
      args.push('--write-subs')
      args.push('--sub-lang', 'zh-Hans,en')
      args.push('--embed-subs')
    }

    // 不下载播放列表
    args.push('--no-playlist')

    // 显示进度
    args.push('--newline')
    args.push('--progress')


    return new Promise((resolve) => {
      const process = spawn(ytdlpPath, args)
      let fileName = ''
      let outputBuffer = ''

      process.stdout.on('data', (data: Buffer) => {
        const output = data.toString('utf8')
        outputBuffer += output

        // 解析进度信息
        const downloadMatch = output.match(/\[download\]\s+(\d+\.?\d*)%/)
        if (downloadMatch) {
          const progress = parseFloat(downloadMatch[1])
          onProgress?.(progress, '下载中...')
        }

        // 提取文件名
        const destinationMatch = output.match(/\[download\] Destination: (.+)/)
        if (destinationMatch) {
          fileName = destinationMatch[1].split(/[/\\]/).pop() || ''
        }

        // 检测完成
        if (output.includes('[download] 100%')) {
          onProgress?.(100, '下载完成！')
        }
      })

      process.stderr.on('data', (data: Buffer) => {
        const error = data.toString('utf8')
        console.error('yt-dlp error:', error)

        // 检测错误
        if (error.includes('HTTP Error 404')) {
          resolve({
            success: false,
            error: '视频不存在或无法访问'
          })
        } else if (error.includes('sign in')) {
          resolve({
            success: false,
            error: '该视频需要登录才能下载'
          })
        }
      })

      process.on('close', (code: number) => {
        if (code === 0) {
          // 尝试从输出中提取文件名
          if (!fileName) {
            const destinationMatch = outputBuffer.match(/\[download\] Destination: (.+)/)
            if (destinationMatch) {
              fileName = destinationMatch[1].split(/[/\\]/).pop() || ''
            }
          }

          resolve({
            success: true,
            outputPath: outputDir,
            fileName: fileName
          })
        } else {
          resolve({
            success: false,
            error: `下载失败，退出码: ${code}`
          })
        }
      })

      process.on('error', (error: Error) => {
        resolve({
          success: false,
          error: `启动失败: ${error.message}`
        })
      })
    })
  } catch (error: any) {
    console.error('下载视频失败:', error)
    return {
      success: false,
      error: error.message || '下载失败'
    }
  }
}

/**
 * 获取视频信息（不下载）
 */
export async function getVideoInfo(url: string): Promise<{
  title?: string
  duration?: number
  uploader?: string
  thumbnail?: string
} | null> {
  if (!isYtdlpAvailable()) {
    return null
  }

  try {
    const { execSync } = (window as any).require('child_process')
    const ytdlpPath = getYtdlpPath()

    const args = [
      url,
      '--dump-json',
      '--no-playlist',
      '--skip-download'
    ]

    const output = execSync(`${ytdlpPath} ${args.join(' ')}`, { encoding: 'utf8' })
    const info = JSON.parse(output)

    return {
      title: info.title,
      duration: info.duration,
      uploader: info.uploader,
      thumbnail: info.thumbnail
    }
  } catch (error) {
    console.error('获取视频信息失败:', error)
    return null
  }
}

/**
 * 获取支持的网站列表
 */
export function getSupportedSites(): string[] {
  return [
    'YouTube',
    'Bilibili',
    'Twitter/X',
    'Vimeo',
    'Instagram',
    'Facebook',
    'TikTok',
    '优酷',
    '腾讯视频',
    '爱奇艺',
    '抖音',
    '快手',
    '网易云音乐',
    'QQ音乐'
  ]
}
