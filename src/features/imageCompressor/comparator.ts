/**
 * 图片对比器 - 对比原图和压缩后图片的差异
 */
import type { ImageInfo, ImageComparison } from './types'

/**
 * 创建图片对比数据
 */
export function createComparison(
  original: ImageInfo,
  compressedBlob: Blob
): ImageComparison {
  const originalSize = original.size
  const compressedSize = compressedBlob.size
  const sizeSaved = originalSize - compressedSize
  const compressionRatio = ((1 - compressedSize / originalSize) * 100)

  return {
    original,
    compressed: {
      size: compressedSize,
      blob: compressedBlob
    },
    compressionRatio: Number(compressionRatio.toFixed(2)),
    sizeSaved,
    sizeSavedMB: (sizeSaved / 1024 / 1024).toFixed(2)
  }
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`
}

/**
 * 计算 PSNR (峰值信噪比) - 用于评估图片质量损失
 */
export async function calculatePSNR(
  originalUrl: string,
  compressedUrl: string
): Promise<number> {
  return new Promise((resolve) => {
    const img1 = new Image()
    const img2 = new Image()

    let loaded = 0

    const checkLoaded = () => {
      loaded++
      if (loaded === 2) {
        const psnr = compareTwoImages(img1, img2)
        resolve(psnr)
      }
    }

    img1.crossOrigin = 'anonymous'
    img2.crossOrigin = 'anonymous'

    img1.onload = checkLoaded
    img2.onload = checkLoaded

    img1.onerror = () => resolve(0)
    img2.onerror = () => resolve(0)

    img1.src = originalUrl
    img2.src = compressedUrl
  })
}

/**
 * 比较两张图片并计算 PSNR
 */
function compareTwoImages(img1: HTMLImageElement, img2: HTMLImageElement): number {
  try {
    const canvas1 = document.createElement('canvas')
    const canvas2 = document.createElement('canvas')
    const ctx1 = canvas1.getContext('2d')
    const ctx2 = canvas2.getContext('2d')

    if (!ctx1 || !ctx2) return 0

    // 使用较小的尺寸以提高性能
    const width = Math.min(img1.width, img2.width, 500)
    const height = Math.min(img1.height, img2.height, 500)

    canvas1.width = width
    canvas1.height = height
    canvas2.width = width
    canvas2.height = height

    ctx1.drawImage(img1, 0, 0, width, height)
    ctx2.drawImage(img2, 0, 0, width, height)

    const data1 = ctx1.getImageData(0, 0, width, height).data
    const data2 = ctx2.getImageData(0, 0, width, height).data

    let mse = 0
    for (let i = 0; i < data1.length; i += 4) {
      const r1 = data1[i]
      const g1 = data1[i + 1]
      const b1 = data1[i + 2]

      const r2 = data2[i]
      const g2 = data2[i + 1]
      const b2 = data2[i + 2]

      mse += Math.pow(r1 - r2, 2) + Math.pow(g1 - g2, 2) + Math.pow(b1 - b2, 2)
    }

    mse /= (width * height * 3)

    if (mse === 0) return Infinity // 完全相同

    const maxPixelValue = 255
    const psnr = 10 * Math.log10((maxPixelValue * maxPixelValue) / mse)

    return Number(psnr.toFixed(2))
  } catch (error) {
    console.error('计算 PSNR 失败:', error)
    return 0
  }
}

/**
 * 生成差异图(热力图)
 */
export async function generateDiffImage(
  originalUrl: string,
  compressedUrl: string
): Promise<string | null> {
  return new Promise((resolve) => {
    const img1 = new Image()
    const img2 = new Image()

    let loaded = 0

    const checkLoaded = () => {
      loaded++
      if (loaded === 2) {
        const diffUrl = createDiffCanvas(img1, img2)
        resolve(diffUrl)
      }
    }

    img1.crossOrigin = 'anonymous'
    img2.crossOrigin = 'anonymous'

    img1.onload = checkLoaded
    img2.onload = checkLoaded

    img1.onerror = () => resolve(null)
    img2.onerror = () => resolve(null)

    img1.src = originalUrl
    img2.src = compressedUrl
  })
}

/**
 * 创建差异画布
 */
function createDiffCanvas(img1: HTMLImageElement, img2: HTMLImageElement): string | null {
  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) return null

    const width = Math.min(img1.width, img2.width)
    const height = Math.min(img1.height, img2.height)

    canvas.width = width
    canvas.height = height

    const tempCanvas1 = document.createElement('canvas')
    const tempCanvas2 = document.createElement('canvas')
    const tempCtx1 = tempCanvas1.getContext('2d')
    const tempCtx2 = tempCanvas2.getContext('2d')

    if (!tempCtx1 || !tempCtx2) return null

    tempCanvas1.width = width
    tempCanvas1.height = height
    tempCanvas2.width = width
    tempCanvas2.height = height

    tempCtx1.drawImage(img1, 0, 0, width, height)
    tempCtx2.drawImage(img2, 0, 0, width, height)

    const data1 = tempCtx1.getImageData(0, 0, width, height).data
    const data2 = tempCtx2.getImageData(0, 0, width, height).data
    const diffData = ctx.createImageData(width, height)

    for (let i = 0; i < data1.length; i += 4) {
      const r1 = data1[i]
      const g1 = data1[i + 1]
      const b1 = data1[i + 2]

      const r2 = data2[i]
      const g2 = data2[i + 1]
      const b2 = data2[i + 2]

      // 计算差异
      const diff = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2)

      // 使用热力图表示差异
      if (diff < 10) {
        // 几乎无差异 - 绿色
        diffData.data[i] = 0
        diffData.data[i + 1] = 255
        diffData.data[i + 2] = 0
      } else if (diff < 50) {
        // 轻微差异 - 黄色
        diffData.data[i] = 255
        diffData.data[i + 1] = 255
        diffData.data[i + 2] = 0
      } else {
        // 明显差异 - 红色
        diffData.data[i] = 255
        diffData.data[i + 1] = 0
        diffData.data[i + 2] = 0
      }

      diffData.data[i + 3] = 255 // Alpha
    }

    ctx.putImageData(diffData, 0, 0)

    return canvas.toDataURL('image/png')
  } catch (error) {
    console.error('生成差异图失败:', error)
    return null
  }
}

/**
 * 获取质量评级
 */
export function getQualityRating(psnr: number): string {
  if (psnr === Infinity || psnr === 0) return '未知'
  if (psnr >= 40) return '优秀'
  if (psnr >= 35) return '良好'
  if (psnr >= 30) return '一般'
  return '较差'
}
