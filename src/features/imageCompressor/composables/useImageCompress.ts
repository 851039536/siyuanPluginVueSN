import type { Ref } from "vue"
import type {
  CompressOptions,
  CompressResult,
  ImageInfo,
} from "../types"
import { computed, ref, shallowRef } from "vue"
import {
  batchCompressImages,
  getCompressStats,
} from "../services/compressor"

export function useImageCompress(
  filteredImages: Ref<ImageInfo[]>,
  selectedImages: Ref<Set<string>>,
  onProgressText: (text: string) => void,
) {
  const compressing = ref(false)
  const compressResults = shallowRef<CompressResult[]>([])
  const showCompressDialog = ref(false)

  const stats = computed(() => {
    if (compressResults.value.length === 0) {
      return {
        total: 0,
        success: 0,
        failed: 0,
        averageRatio: 0,
        totalSavedMB: "0.00",
      }
    }
    return getCompressStats(compressResults.value)
  })

  const onCompress = () => {
    showCompressDialog.value = true
  }

  const onCompressConfirm = async (options: CompressOptions) => {
    showCompressDialog.value = false
    compressing.value = true
    compressResults.value = []

    try {
      const selectedImageList = filteredImages.value.filter((img) =>
        selectedImages.value.has(img.path),
      )

      const results = await batchCompressImages(
        selectedImageList,
        options,
        (current, total, imageName) => {
          onProgressText(`压缩中... ${current}/${total} - ${imageName}`)
        },
      )

      compressResults.value = results
      return results
    } finally {
      compressing.value = false
    }
  }

  return {
    compressing,
    compressResults,
    showCompressDialog,
    stats,
    onCompress,
    onCompressConfirm,
  }
}
