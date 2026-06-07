/**
 * 视频管理器 API 函数
 */
import { Plugin } from "siyuan"
import {
  getFile,
  putFile,
  readDir,
  removeFile,
} from "@/api"
import {
  decryptVideo,
  encryptVideo,
  getEncryptedFileName,
  getOriginalFileName,
  isEncryptedVideo,
} from "./crypto"

/**
 * 获取视频存储目录路径（默认为 data/video）
 */
export async function getVideoStoragePath(): Promise<string> {
  return "data/video"
}

/**
 * 视频文件扩展名
 */
const VIDEO_EXTENSIONS = [
  ".mp4",
  ".webm",
  ".ogg",
  ".avi",
  ".mov",
  ".wmv",
  ".flv",
  ".mkv",
  ".m4v",
  ".sn",
  ".sn2",
]

/**
 * 判断是否为视频文件
 */
function isVideoFile(fileName: string): boolean {
  const lowerName = fileName.toLowerCase()
  return VIDEO_EXTENSIONS.some((ext) => lowerName.endsWith(ext))
}

/**
 * 获取文件大小
 */
async function getFileSize(filePath: string): Promise<number> {
  try {
    const blob = await getFile(filePath)
    if (blob) {
      return blob.size
    }
  } catch (error) {
    console.error("获取文件大小异常:", filePath, error)
  }
  return 0
}

/**
 * 递归扫描目录获取所有视频文件
 */
async function scanVideoDirectory(
  basePath: string,
  currentPath: string = "",
): Promise<any[]> {
  const videos: any[] = []
  const fullPath = currentPath ? `${basePath}/${currentPath}` : basePath

  try {
    const items = await readDir(fullPath)

    if (!items) {
      return videos
    }

    for (const item of items) {
      const itemPath = currentPath ? `${currentPath}/${item.name}` : item.name
      const itemFullPath = `${basePath}/${itemPath}`

      if (item.isDir) {
        // 递归扫描子目录
        const subVideos = await scanVideoDirectory(basePath, itemPath)
        videos.push(...subVideos)
      } else if (isVideoFile(item.name)) {
        // 获取文件大小
        const size = await getFileSize(itemFullPath)

        // 添加视频文件
        const category = currentPath || "根目录"
        videos.push({
          name: item.name,
          path: itemFullPath,
          category,
          size,
          modTime: item.updated * 1000 || Date.now(), // updated 是秒级时间戳，转换为毫秒
        })
      }
    }
  } catch (error) {
    console.error("扫描目录失败:", fullPath, error)
  }

  return videos
}

/**
 * 获取视频列表（自动扫描 data/video 目录）
 */
export async function getVideoList(_plugin: Plugin): Promise<any[]> {
  try {
    const storagePath = await getVideoStoragePath()

    const videos = await scanVideoDirectory(storagePath)

    return videos
  } catch (error) {
    console.error("获取视频列表失败:", error)
    return []
  }
}

/**
 * 获取所有分类（从扫描结果中提取）
 */
export async function getVideoCategories(plugin: Plugin): Promise<string[]> {
  const videos = await getVideoList(plugin)
  const categories = new Set<string>()

  videos.forEach((video) => {
    if (video.category) {
      categories.add(video.category)
    }
  })

  return Array.from(categories).sort()
}

/**
 * 获取视频文件的 Blob URL（用于播放）
 * 加密视频自动解密
 */
export async function getVideoUrl(videoPath: string): Promise<string> {
  try {
    const blob = await getFile(videoPath)

    if (blob) {
      if (isEncryptedVideo(videoPath)) {
        const encryptedData = new Uint8Array(await blob.arrayBuffer())
        const decryptedData = await decryptVideo(encryptedData)
        const decryptedBlob = new Blob([decryptedData.buffer as ArrayBuffer], {
          type: "video/mp4",
        })
        return URL.createObjectURL(decryptedBlob)
      }

      return URL.createObjectURL(blob)
    } else {
      console.error("获取视频文件失败:", videoPath)
      return ""
    }
  } catch (error) {
    console.error("获取视频URL失败:", videoPath, error)
    throw error
  }
}

/**
 * 加密单个视频文件
 * @param videoPath 视频文件路径
 * @param doubleCompress 是否使用双重压缩
 * @returns 加密后的文件路径
 */
export async function encryptVideoFile(
  videoPath: string,
  doubleCompress: boolean = false,
): Promise<string> {
  try {
    const blob = await getFile(videoPath)
    if (!blob) {
      throw new Error("读取视频文件失败")
    }

    const videoData = new Uint8Array(await blob.arrayBuffer())

    const encryptedData = await encryptVideo(videoData, doubleCompress)

    const encryptedPath = getEncryptedFileName(videoPath, doubleCompress)

    await putFile(encryptedPath, false, new Blob([encryptedData.buffer as ArrayBuffer]))

    await deleteVideoFile(videoPath)

    return encryptedPath
  } catch (error) {
    console.error("加密视频文件失败:", error)
    throw error
  }
}

/**
 * 删除视频文件
 */
async function deleteVideoFile(videoPath: string): Promise<void> {
  try {
    await removeFile(videoPath)
  } catch (error) {
    console.error("删除文件异常:", error)
  }
}

/**
 * 批量加密所有未加密的视频
 * @param doubleCompress 是否使用双重压缩
 * @param onProgress 进度回调
 */
export async function encryptAllVideos(
  plugin: Plugin,
  doubleCompress: boolean = false,
  onProgress?: (current: number, total: number, fileName: string) => void,
): Promise<{ success: number, failed: number, errors: string[] }> {
  const videos = await getVideoList(plugin)
  const unencryptedVideos = videos.filter((v) => !isEncryptedVideo(v.name))

  const result = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  }

  for (let i = 0; i < unencryptedVideos.length; i++) {
    const video = unencryptedVideos[i]

    try {
      if (onProgress) {
        onProgress(i + 1, unencryptedVideos.length, video.name)
      }

      await encryptVideoFile(video.path, doubleCompress)
      result.success++
    } catch (error) {
      result.failed++
      result.errors.push(`${video.name}: ${(error as Error).message}`)
      console.error("加密失败:", video.name, error)
    }
  }

  return result
}

/**
 * 解密单个视频文件
 * @param videoPath 加密视频文件路径
 * @returns 解密后的文件路径
 */
export async function decryptVideoFile(videoPath: string): Promise<string> {
  try {
    const blob = await getFile(videoPath)
    if (!blob) {
      throw new Error("读取加密文件失败")
    }

    const encryptedData = new Uint8Array(await blob.arrayBuffer())

    const decryptedData = await decryptVideo(encryptedData)

    const decryptedPath = getOriginalFileName(videoPath)

    await putFile(decryptedPath, false, new Blob([decryptedData.buffer as ArrayBuffer]))

    await deleteVideoFile(videoPath)

    return decryptedPath
  } catch (error) {
    console.error("解密视频文件失败:", error)
    throw error
  }
}

/**
 * 批量解密所有加密的视频
 * @param onProgress 进度回调
 */
export async function decryptAllVideos(
  plugin: Plugin,
  onProgress?: (current: number, total: number, fileName: string) => void,
): Promise<{ success: number, failed: number, errors: string[] }> {
  const videos = await getVideoList(plugin)
  const encryptedVideos = videos.filter((v) => isEncryptedVideo(v.name))

  const result = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  }

  for (let i = 0; i < encryptedVideos.length; i++) {
    const video = encryptedVideos[i]

    try {
      if (onProgress) {
        onProgress(i + 1, encryptedVideos.length, video.name)
      }

      await decryptVideoFile(video.path)
      result.success++
    } catch (error) {
      result.failed++
      result.errors.push(`${video.name}: ${(error as Error).message}`)
      console.error("解密失败:", video.name, error)
    }
  }

  return result
}
