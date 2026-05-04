import type {
  ImageInfo,
  ScanProgress,
} from "../types"
import {
  getFile,
  readDir,
} from "@/api"

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"]

function isImageFile(filename: string): boolean {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf("."))
  return IMAGE_EXTENSIONS.includes(ext)
}

function getImageMimeType(filename: string): string {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf("."))
  const mimeTypes: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
  }
  return mimeTypes[ext] || "image/jpeg"
}

export async function scanDirectory(
  path: string,
  onProgress?: (progress: ScanProgress) => void,
): Promise<ImageInfo[]> {
  const images: ImageInfo[] = []

  try {
    const result = await readDir(path)

    if (!result) {
      console.warn(`无法读取目录: ${path}`)
      return images
    }

    const files = Array.isArray(result) ? result : [result]
    let processed = 0
    const total = files.length

    for (const file of files) {
      processed++

      if (onProgress) {
        onProgress({
          current: processed,
          total,
          currentPath: file.name,
        })
      }

      const fullPath = `${path}/${file.name}`

      if (file.isDir) {
        const subImages = await scanDirectory(fullPath, onProgress)
        images.push(...subImages)
      } else if (isImageFile(file.name)) {
        images.push({
          path: fullPath,
          name: file.name,
          size: 0,
          type: getImageMimeType(file.name),
          lastModified: Date.now(),
        })
      }
    }
  } catch (error) {
    console.error(`扫描目录失败 ${path}:`, error)
  }

  return images
}

export async function scanAllAssets(
  onProgress?: (progress: ScanProgress) => void,
): Promise<ImageInfo[]> {
  const assetsPath = "/data/assets"

  const images = await scanDirectory(assetsPath, onProgress)
  return images
}

export async function getImageDetails(
  imageInfo: ImageInfo,
): Promise<ImageInfo> {
  try {
    const blob = await getFile(imageInfo.path)

    if (!blob || !(blob instanceof Blob)) {
      console.warn("获取文件失败，尝试使用直接URL方式:", imageInfo.path)
      return await getImageDetailsByUrl(imageInfo)
    }

    imageInfo.size = blob.size

    const url = URL.createObjectURL(blob)
    imageInfo.url = url

    const dimensions = await getImageDimensions(url, false)
    imageInfo.width = dimensions.width
    imageInfo.height = dimensions.height
  } catch (error) {
    console.error(`获取图片详情失败 ${imageInfo.path}:`, error)
    return await getImageDetailsByUrl(imageInfo)
  }

  return imageInfo
}

async function getImageDetailsByUrl(imageInfo: ImageInfo): Promise<ImageInfo> {
  try {
    const assetUrl = imageInfo.path.replace("/data/assets/", "/assets/")
    const response = await fetch(assetUrl)
    if (!response.ok) {
      console.warn(`URL访问失败: ${response.status} ${assetUrl}`)
      return imageInfo
    }

    const blob = await response.blob()
    imageInfo.size = blob.size
    imageInfo.url = assetUrl

    const dimensions = await getImageDimensions(assetUrl, false)
    imageInfo.width = dimensions.width
    imageInfo.height = dimensions.height
  } catch (error) {
    console.error(`URL方式也失败: ${imageInfo.path}:`, error)
  }

  return imageInfo
}

function getImageDimensions(
  url: string,
  revokeUrl = true,
): Promise<{ width: number, height: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
      })
      if (revokeUrl) {
        URL.revokeObjectURL(url)
      }
    }
    img.onerror = (e) => {
      console.error("图片加载失败:", url, e)
      resolve({
        width: 0,
        height: 0,
      })
      if (revokeUrl) {
        URL.revokeObjectURL(url)
      }
    }
    img.src = url
  })
}

export async function batchGetImageDetails(
  images: ImageInfo[],
  onProgress?: (current: number, total: number) => void,
  minSizeKB: number = 0,
): Promise<ImageInfo[]> {
  const detailedImages: ImageInfo[] = []
  const total = images.length
  const minBytes = minSizeKB * 1024

  for (let i = 0; i < images.length; i++) {
    if (onProgress) {
      onProgress(i + 1, total)
    }

    const detailed = await getImageDetails(images[i])

    // 如果设置了最小大小筛选，且图片大小小于阈值，则跳过
    if (minBytes > 0 && detailed.size > 0 && detailed.size < minBytes) {
      // 清理 URL
      if (detailed.url && detailed.url.startsWith("blob:")) {
        URL.revokeObjectURL(detailed.url)
      }
      continue
    }

    detailedImages.push(detailed)
  }

  return detailedImages
}
