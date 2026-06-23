import type { Ref } from "vue"
import type { ImageInfo } from "../types"
import {
  computed,
  nextTick,
  ref,
  watch,
} from "vue"

export function useImagePagination(images: Ref<ImageInfo[]>) {
  const currentPage = ref(1)
  const pageSize = ref(30)
  const minFileSize = ref(0)
  const imageListRef = ref<HTMLElement | null>(null)

  const filteredImages = computed(() => {
    if (minFileSize.value === 0) {
      return images.value
    }
    const minBytes = minFileSize.value * 1024
    return images.value.filter((img) => img.size >= minBytes)
  })

  const totalPages = computed(() =>
    Math.ceil(filteredImages.value.length / pageSize.value),
  )

  const paginatedImages = computed(() => {
    const start = (currentPage.value - 1) * pageSize.value
    const end = start + pageSize.value
    return filteredImages.value.slice(start, end)
  })

  watch(currentPage, () => {
    nextTick(() => {
      imageListRef.value?.scrollTo({
        top: 0,
        behavior: "smooth",
      })
    })
  })

  watch(minFileSize, () => {
    currentPage.value = 1
  })

  const resetPagination = () => {
    currentPage.value = 1
  }

  return {
    currentPage,
    pageSize,
    minFileSize,
    imageListRef,
    filteredImages,
    totalPages,
    paginatedImages,
    resetPagination,
  }
}
