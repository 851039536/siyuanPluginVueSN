// 资源压缩服务：图片压缩（浏览器端 canvas 压缩）、批量压缩与写回磁盘
//
// 自 imageCompressor 功能块迁入：压缩能力不再是独立功能，而是资源管理「图片资源」页签的批量操作。
import type {
  CompressOptions,
  CompressResult,
  CompressTarget,
} from "../types"
import imageCompression from "browser-image-compression"
import {
  getFile,
  putFile,
} from "@/api"
import { getImageMimeType, toDiskAssetPath } from "../utils"

export const DEFAULT_COMPRESS_OPTIONS: CompressOptions = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  quality: 0.8,
  useWebWorker: true,
  fileType: undefined,
}

/**
 * 压缩单张图片。
 *
 * 路径形态说明：列表中的路径为 assets 表形态（URL 编码、无前导斜杠），
 * 而 `/api/file/getFile` 与 `/api/file/putFile` 均要求 `/data/` 前缀的**解码**路径，
 * 故读写统一经 `toDiskAssetPath` 归一（该函数同时处理编码还原与前缀补全）。
 */
export async function compressImage(
  target: CompressTarget,
  options: CompressOptions = DEFAULT_COMPRESS_OPTIONS,
): Promise<CompressResult> {
  const startTime = Date.now()

  try {
    const diskPath = toDiskAssetPath(target.path)
    const fileData = await getFile(diskPath)

    if (!fileData || !(fileData instanceof Blob)) {
      return {
        success: false,
        originalPath: target.path,
        originalSize: 0,
        error: "无法获取文件数据",
      }
    }

    const fileName = target.path.split("/").pop() ?? target.path
    const file = new File([fileData], fileName, {
      type: getImageMimeType(fileName),
      lastModified: Date.now(),
    })

    const compressedBlob = await imageCompression(file, {
      ...DEFAULT_COMPRESS_OPTIONS,
      ...options,
    })

    const originalSize = file.size
    const compressedSize = compressedBlob.size
    const compressionRatio = (1 - compressedSize / originalSize) * 100

    return {
      success: true,
      originalPath: target.path,
      originalSize,
      compressedBlob,
      compressedSize,
      // 压缩率统一保留两位，避免统计面板出现 33.33333333333333%
      compressionRatio: Number(compressionRatio.toFixed(2)),
      timeTaken: Date.now() - startTime,
    }
  }
  catch (error) {
    console.error(`压缩图片失败 ${target.path}:`, error)
    return {
      success: false,
      originalPath: target.path,
      originalSize: 0,
      error: error instanceof Error ? error.message : "未知错误",
    }
  }
}

/** 逐张串行压缩（串行可避免多张图同时解码造成的内存峰值） */
export async function batchCompressImages(
  targets: CompressTarget[],
  options: CompressOptions = DEFAULT_COMPRESS_OPTIONS,
  onProgress?: (current: number, total: number, currentPath: string) => void,
): Promise<CompressResult[]> {
  const results: CompressResult[] = []
  const total = targets.length

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i]
    onProgress?.(i + 1, total, target.path)
    results.push(await compressImage(target, options))
  }

  return results
}

/**
 * 将压缩结果写回原路径（覆盖原图）。
 *
 * ⚠️ `putFile(path, isDir, file)` 的第二个参数是 **isDir（是否为创建文件夹）**，不是「是否覆盖」；
 * 写回已存在的资源路径即覆盖（内核按同名落盘覆盖），故此处传 `false`。
 * 路径统一经 `toDiskAssetPath` 归一为 `/data/` 前缀的解码形态。
 */
export async function replaceImage(
  assetPath: string,
  compressedBlob: Blob,
): Promise<boolean> {
  try {
    await putFile(toDiskAssetPath(assetPath), false, compressedBlob)
    return true
  }
  catch (error) {
    console.error(`替换图片失败 ${assetPath}:`, error)
    return false
  }
}

/** 批量写回压缩结果，返回成功/失败计数 */
export async function batchReplaceImages(
  results: CompressResult[],
  onProgress?: (current: number, total: number) => void,
): Promise<{ success: number, failed: number }> {
  let success = 0
  let failed = 0
  const total = results.length

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    onProgress?.(i + 1, total)

    if (result.success && result.compressedBlob) {
      const replaced = await replaceImage(result.originalPath, result.compressedBlob)
      if (replaced) success++
      else failed++
    }
    else {
      failed++
    }
  }

  return { success, failed }
}

/** 汇总压缩结果：成功/失败计数、节省总量与平均压缩率 */
export function getCompressStats(results: CompressResult[]) {
  const stats = {
    total: results.length,
    success: 0,
    failed: 0,
    totalOriginalSize: 0,
    totalCompressedSize: 0,
    totalSaved: 0,
    averageRatio: 0,
  }

  results.forEach((result) => {
    if (result.success && result.compressedSize) {
      stats.success++
      stats.totalOriginalSize += result.originalSize
      stats.totalCompressedSize += result.compressedSize
    }
    else {
      stats.failed++
    }
  })

  stats.totalSaved = stats.totalOriginalSize - stats.totalCompressedSize
  stats.averageRatio =
    stats.totalOriginalSize > 0
      ? (1 - stats.totalCompressedSize / stats.totalOriginalSize) * 100
      : 0

  return {
    ...stats,
    averageRatio: Number(stats.averageRatio.toFixed(2)),
    totalOriginalSizeMB: (stats.totalOriginalSize / 1024 / 1024).toFixed(2),
    totalCompressedSizeMB: (stats.totalCompressedSize / 1024 / 1024).toFixed(2),
    totalSavedMB: (stats.totalSaved / 1024 / 1024).toFixed(2),
  }
}
