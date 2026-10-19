/**
 * S3 文件管理器外部拖入区 composable
 *
 * 仅处理"从系统拖入文件/文件夹"（dataTransfer 含 Files 类型）：
 * 维护拖拽悬停态用于显示提示浮层，放下时把 File 列表交给上传回调。
 * 内部条目拖动不含 Files 类型，故不会误触发本区逻辑。
 */
import { ref } from "vue"

export function useExternalDrop(onFiles: (files: File[]) => void) {
  /** 是否有外部文件正悬停在拖入区（控制提示浮层显隐） */
  const isDragOver = ref(false)
  // 进入/离开计数：子元素冒泡会连续触发 dragenter/dragleave，用计数防抖避免闪烁
  let enterCount = 0

  /** 判断本次拖拽是否携带系统文件（零分配判定，dragover 每秒触发数十次） */
  function hasFiles(e: DragEvent): boolean {
    const types = e.dataTransfer?.types
    if (!types) { return false }
    return Array.from(types).includes("Files")
  }

  function onDragEnter(e: DragEvent): void {
    if (!hasFiles(e)) { return }
    e.preventDefault()
    enterCount++
    isDragOver.value = true
  }

  function onDragOver(e: DragEvent): void {
    if (!hasFiles(e)) { return }
    // 必须 preventDefault 才能触发后续 drop
    e.preventDefault()
    e.dataTransfer!.dropEffect = "copy"
    isDragOver.value = true
  }

  /** 结束当前拖拽悬停（清零计数并隐藏浮层） */
  function resetDragOver(): void {
    enterCount = 0
    isDragOver.value = false
  }

  function onDragLeave(e: DragEvent): void {
    // 移出窗口（坐标归零）时直接结束悬停，不依赖 hasFiles 判定：
    // 此时 dataTransfer.types 为空，走计数递减会导致只增不减、浮层永久驻留
    if (e.clientX <= 0 && e.clientY <= 0) {
      resetDragOver()
      return
    }
    if (!hasFiles(e)) { return }
    enterCount--
    if (enterCount === 0) { isDragOver.value = false }
  }

  function onDrop(e: DragEvent): void {
    if (!hasFiles(e)) { return }
    e.preventDefault()
    resetDragOver()
    const files = Array.from(e.dataTransfer!.files)
    if (files.length > 0) { onFiles(files) }
  }

  return {
    isDragOver,
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDrop,
  }
}
