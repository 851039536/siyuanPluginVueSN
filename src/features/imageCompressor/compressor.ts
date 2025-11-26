/**
 * 图片压缩引擎 - 使用 browser-image-compression 库
 */
import imageCompression from 'browser-image-compression'
import { putFile, getFile } from '@/api'
import type { ImageInfo, CompressOptions, CompressResult } from './types'

/**
 * 默认压缩配置
 */
export const DEFAULT_COMPRESS_OPTIONS: CompressOptions = {
  maxSizeMB: 1,              // 最大 1MB
  maxWidthOrHeight: 1920,    // 最大宽高 1920px
  quality: 0.8,              // 压缩质量 80%
  useWebWorker: true,        // 使用 Web Worker
  fileType: undefined        // 保持原格式
}

/**
 * 压缩单张图片
 */
export async function compressImage(
  imageInfo: ImageInfo,
  options: CompressOptions = DEFAULT_COMPRESS_OPTIONS
): Promise<CompressResult> {
  const startTime = Date.now()

  try {
    // 获取原始文件
    const fileData = await getFile(imageInfo.path)

    if (!fileData || !(fileData instanceof Blob)) {
      return {
        success: false,
        originalFile: imageInfo,
        error: '无法获取文件数据'
      }
    }

    // 将 Blob 转换为 File 对象
    const file = new File([fileData], imageInfo.name, {
      type: imageInfo.type,
      lastModified: imageInfo.lastModified
    })

    // 合并压缩配置
    const compressOptions = {
      ...DEFAULT_COMPRESS_OPTIONS,
      ...options
    }

    // 执行压缩
    const compressedBlob = await imageCompression(file, compressOptions)

    // 计算压缩率
    const originalSize = file.size
    const compressedSize = compressedBlob.size
    const compressionRatio = ((1 - compressedSize / originalSize) * 100)

    // 计算耗时
    const timeTaken = Date.now() - startTime

    return {
      success: true,
      originalFile: imageInfo,
      compressedBlob,
      compressedSize,
      compressionRatio: Number(compressionRatio.toFixed(2)),
      timeTaken
    }
  } catch (error) {
    console.error(`压缩图片失败 ${imageInfo.path}:`, error)
    return {
      success: false,
      originalFile: imageInfo,
      error: error instanceof Error ? error.message : '未知错误'
    }
  }
}

/**
 * 批量压缩图片
 */
export async function batchCompressImages(
  images: ImageInfo[],
  options: CompressOptions = DEFAULT_COMPRESS_OPTIONS,
  onProgress?: (current: number, total: number, currentImage: string) => void
): Promise<CompressResult[]> {
  const results: CompressResult[] = []
  const total = images.length

  for (let i = 0; i < images.length; i++) {
    const image = images[i]

    // 更新进度
    if (onProgress) {
      onProgress(i + 1, total, image.name)
    }

    const result = await compressImage(image, options)
    results.push(result)
  }

  return results
}

/**
 * 替换原始图片文件
 */
export async function replaceImage(
  imagePath: string,
  compressedBlob: Blob
): Promise<boolean> {
  try {
    // 使用 putFile API 替换文件,保持文件名不变
    await putFile(imagePath, false, compressedBlob)
    console.log(`成功替换图片: ${imagePath}`)
    return true
  } catch (error) {
    console.error(`替换图片失败 ${imagePath}:`, error)
    return false
  }
}

/**
 * 批量替换图片
 */
export async function batchReplaceImages(
  results: CompressResult[],
  onProgress?: (current: number, total: number) => void
): Promise<{ success: number; failed: number }> {
  let success = 0
  let failed = 0
  const total = results.length

  for (let i = 0; i < results.length; i++) {
    const result = results[i]

    // 更新进度
    if (onProgress) {
      onProgress(i + 1, total)
    }

    // 只处理压缩成功的图片
    if (result.success && result.compressedBlob) {
      const replaced = await replaceImage(
        result.originalFile.path,
        result.compressedBlob
      )

      if (replaced) {
        success++
      } else {
        failed++
      }
    } else {
      failed++
    }
  }

  return { success, failed }
}

/**
 * 备份图片(可选功能)
 */
export async function backupImage(
  imagePath: string
): Promise<boolean> {
  try {
    const fileData = await getFile(imagePath)

    if (!fileData || !(fileData instanceof Blob)) {
      return false
    }

    // 创建备份文件名
    const backupPath = imagePath.replace(/(\.[^.]+)$/, '.backup$1')

    // 保存备份
    await putFile(backupPath, false, fileData)
    console.log(`备份图片: ${imagePath} -> ${backupPath}`)
    return true
  } catch (error) {
    console.error(`备份图片失败 ${imagePath}:`, error)
    return false
  }
}

/**
 * 获取压缩统计信息
 */
export function getCompressStats(results: CompressResult[]) {
  const stats = {
    total: results.length,
    success: 0,
    failed: 0,
    totalOriginalSize: 0,
    totalCompressedSize: 0,
    totalSaved: 0,
    averageRatio: 0
  }

  results.forEach(result => {
    if (result.success && result.compressedSize) {
      stats.success++
      stats.totalOriginalSize += result.originalFile.size
      stats.totalCompressedSize += result.compressedSize
    } else {
      stats.failed++
    }
  })

  stats.totalSaved = stats.totalOriginalSize - stats.totalCompressedSize
  stats.averageRatio = stats.totalOriginalSize > 0
    ? ((1 - stats.totalCompressedSize / stats.totalOriginalSize) * 100)
    : 0

  return {
    ...stats,
    averageRatio: Number(stats.averageRatio.toFixed(2)),
    totalOriginalSizeMB: (stats.totalOriginalSize / 1024 / 1024).toFixed(2),
    totalCompressedSizeMB: (stats.totalCompressedSize / 1024 / 1024).toFixed(2),
    totalSavedMB: (stats.totalSaved / 1024 / 1024).toFixed(2)
  }
}
