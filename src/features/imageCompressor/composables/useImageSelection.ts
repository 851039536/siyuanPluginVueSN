import type { Ref } from "vue"
import type { ImageInfo } from "../types"
import { ref } from "vue"

export function useImageSelection(paginatedImages: Ref<ImageInfo[]>) {
  const selectedImages = ref<Set<string>>(new Set())

  const updateSelection = (operation: (set: Set<string>) => void) => {
    operation(selectedImages.value)
    selectedImages.value = new Set(selectedImages.value)
  }

  const toggleSelect = (path: string) => {
    updateSelection((set) => {
      if (set.has(path)) {
        set.delete(path)
      } else {
        set.add(path)
      }
    })
  }

  const onSelectAll = () => {
    updateSelection((set) => {
      paginatedImages.value.forEach((img) => set.add(img.path))
    })
  }

  const onDeselectAll = () => {
    updateSelection((set) => set.clear())
  }

  const clearSelection = () => {
    selectedImages.value.clear()
  }

  const removeFromSelection = (paths: Set<string>) => {
    updateSelection((set) => {
      paths.forEach((path) => set.delete(path))
    })
  }

  return {
    selectedImages,
    toggleSelect,
    onSelectAll,
    onDeselectAll,
    clearSelection,
    removeFromSelection,
  }
}
