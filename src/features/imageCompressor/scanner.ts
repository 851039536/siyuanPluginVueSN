/**
 * 图片扫描器 - 扫描思源 data/assets 目录下的所有图片
 */
import { readDir, getFile } from '@/api'
import type { ImageInfo, ScanProgress } from './types'

/**
 * 支持的图片格式
 */
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']

/**
 * 判断文件是否为图片
 */
function isImageFile(filename: string): boolean {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'))
  return IMAGE_EXTENSIONS.includes(ext)
}

/**
 * 获取图片 MIME 类型
 */
function getImageMimeType(filename: string): string {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'))
  const mimeTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp'
  }
  return mimeTypes[ext] || 'image/jpeg'
}

/**
 * 扫描指定目录下的图片文件
 */
export async function scanDirectory(
  path: string,
  onProgress?: (progress: ScanProgress) => void
): Promise<ImageInfo[]> {
  const images: ImageInfo[] = []

  try {
    const result = await readDir(path)

    if (!result) {
      console.warn(`无法读取目录: ${path}`)
      return images
    }

    // readDir 返回的是文件列表数组
    const files = Array.isArray(result) ? result : [result]
    let processed = 0
    const total = files.length

    for (const file of files) {
      processed++

      // 更新进度
      if (onProgress) {
        onProgress({
          current: processed,
          total,
          currentPath: file.name
        })
      }

      const fullPath = `${path}/${file.name}`

      // 如果是目录，递归扫描
      if (file.isDir) {
        const subImages = await scanDirectory(fullPath, onProgress)
        images.push(...subImages)
      }
      // 如果是图片文件
      else if (isImageFile(file.name)) {
        images.push({
          path: fullPath,
          name: file.name,
          size: 0, // 稍后获取
          type: getImageMimeType(file.name),
          lastModified: Date.now()
        })
      }
    }
  } catch (error) {
    console.error(`扫描目录失败 ${path}:`, error)
  }

  return images
}

/**
 * 扫描所有工作空间的 assets 目录
 */
export async function scanAllAssets(
  onProgress?: (progress: ScanProgress) => void
): Promise<ImageInfo[]> {
  // 思源笔记的 assets 目录通常在 data/assets
  const assetsPath = '/data/assets'

  const images = await scanDirectory(assetsPath, onProgress)
  return images
}

/**
 * 获取图片文件的详细信息（包括尺寸）
 */
export async function getImageDetails(imageInfo: ImageInfo): Promise<ImageInfo> {
  try {
    // 方法1: 尝试通过 API 获取文件内容
    const blob = await getFile(imageInfo.path)

    if (!blob || !(blob instanceof Blob)) {
      console.warn('获取文件失败，尝试使用直接URL方式:', imageInfo.path)
      // 方法2: 使用直接URL访问 (/assets/...)
      return await getImageDetailsByUrl(imageInfo)
    }

    // 获取文件大小
    imageInfo.size = blob.size

    // 创建持久化的 URL（不要立即释放）
    const url = URL.createObjectURL(blob)
    imageInfo.url = url

    // 获取图片尺寸（不在此处释放URL）
    const dimensions = await getImageDimensions(url, false)
    imageInfo.width = dimensions.width
    imageInfo.height = dimensions.height

  } catch (error) {
    console.error(`获取图片详情失败 ${imageInfo.path}:`, error)
    // 尝试备用方案
    return await getImageDetailsByUrl(imageInfo)
  }

  return imageInfo
}

/**
 * 通过直接URL获取图片详情（备用方案）
 */
async function getImageDetailsByUrl(imageInfo: ImageInfo): Promise<ImageInfo> {
  try {
    // 将 /data/assets/xxx.jpg 转换为 /assets/xxx.jpg
    const assetUrl = imageInfo.path.replace('/data/assets/', '/assets/')
    // 使用 fetch 直接获取图片
    const response = await fetch(assetUrl)
    if (!response.ok) {
      console.warn(`URL访问失败: ${response.status} ${assetUrl}`)
      return imageInfo
    }

    const blob = await response.blob()
    imageInfo.size = blob.size
    imageInfo.url = assetUrl // 直接使用 assets URL

    // 获取图片尺寸
    const dimensions = await getImageDimensions(assetUrl, false)
    imageInfo.width = dimensions.width
    imageInfo.height = dimensions.height
  } catch (error) {
    console.error(`URL方式也失败: ${imageInfo.path}:`, error)
  }

  return imageInfo
}

/**
 * 获取图片尺寸
 */
function getImageDimensions(url: string, revokeUrl = true): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight
      })
      // 只有在需要时才释放URL
      if (revokeUrl) {
        URL.revokeObjectURL(url)
      }
    }
    img.onerror = (e) => {
      console.error('图片加载失败:', url, e)
      resolve({ width: 0, height: 0 })
      if (revokeUrl) {
        URL.revokeObjectURL(url)
      }
    }
    img.src = url
  })
}

/**
 * 批量获取图片详细信息
 */
export async function batchGetImageDetails(
  images: ImageInfo[],
  onProgress?: (current: number, total: number) => void
): Promise<ImageInfo[]> {
  const detailedImages: ImageInfo[] = []
  const total = images.length

  for (let i = 0; i < images.length; i++) {
    if (onProgress) {
      onProgress(i + 1, total)
    }

    const detailed = await getImageDetails(images[i])
    detailedImages.push(detailed)
  }

  return detailedImages
}
