import type { ImageInfo } from "../types"
import { showMessage } from "siyuan"
import {
  ref,
  shallowRef,
} from "vue"
import {
  batchGetImageDetails,
  revokeImageUrls,
  scanAllAssets,
} from "../services/scanner"

export function useImageScanner() {
  const images = shallowRef<ImageInfo[]>([])
  const scanning = ref(false)
  const scanProgress = ref(0)
  const scanProgressText = ref("")
  const scanMinFileSize = ref(0)

  const onScanImages = async () => {
    scanning.value = true
    scanProgress.value = 0
    revokeImageUrls(images.value)
    images.value = []
    // selectedImages will be cleared by caller

    try {
      const scannedImages = await scanAllAssets((progress) => {
        scanProgress.value = Math.floor((progress.current / progress.total) * 50)
        scanProgressText.value = `扫描中... ${progress.current}/${progress.total}`
      })

      scanProgressText.value = "正在获取图片详情..."

      const detailedImages = await batchGetImageDetails(
        scannedImages,
        (current, total) => {
          scanProgress.value = 50 + Math.floor((current / total) * 50)
          scanProgressText.value = `获取详情... ${current}/${total}`
        },
        scanMinFileSize.value,
      )

      images.value = detailedImages

      const totalSize = detailedImages.reduce((sum, img) => sum + img.size, 0)
      const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2)

      let message = `扫描完成: 共 ${detailedImages.length} 张图片, 总大小 ${totalSizeMB} MB`
      if (scanMinFileSize.value > 0) {
        message += ` (已筛选 ≥${scanMinFileSize.value}KB)`
      }
      showMessage(message, 3000, "info")
    } catch (error) {
      console.error("扫描图片失败:", error)
      showMessage(`扫描图片失败: ${error}`, 5000, "error")
    } finally {
      scanning.value = false
      scanProgress.value = 0
    }
  }

  /** 从列表中移除已替换的图片（释放 blob URL） */
  const removeReplacedImages = (replacedPaths: Set<string>) => {
    const removedImages = images.value.filter((img) => replacedPaths.has(img.path))
    revokeImageUrls(removedImages)
    images.value = images.value.filter((img) => !replacedPaths.has(img.path))
  }

  return {
    images,
    scanning,
    scanProgress,
    scanProgressText,
    scanMinFileSize,
    onScanImages,
    removeReplacedImages,
  }
}
