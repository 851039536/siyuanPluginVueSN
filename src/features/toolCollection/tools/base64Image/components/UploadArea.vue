<template>
  <div class="upload-section">
    <div
      class="upload-area"
      :class="{ 'drag-over': isDragOver }"
      @drop="handleDrop"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
    >
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        class="hidden-file-input"
        @change="handleFileSelect"
      />
      <div class="upload-content">
        <IconWrapper
          name="image"
          :size="48"
          class="upload-icon"
        />
        <p class="upload-text">
          {{ dragText }}
        </p>
        <Button
          class="upload-btn"
          variant="primary"
          @click="triggerFileSelect"
        >
          {{ selectText }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 上传区域组件：支持点击选择与拖拽图片，选择后重置 input 以便重复选择同一文件
import { ref } from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"

interface Props {
  dragText: string
  selectText: string
}

defineProps<Props>()
const emit = defineEmits<{
  fileSelect: [file: File]
}>()

const isDragOver = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const triggerFileSelect = () => {
  fileInput.value?.click()
}

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    emit("fileSelect", file)
  }
  // 重置 value，允许再次选择同一文件时触发 change
  target.value = ""
}

const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
  isDragOver.value = true
}

const handleDragLeave = (e: DragEvent) => {
  e.preventDefault()
  const rect = (e.currentTarget as Element).getBoundingClientRect()
  if (
    e.clientX < rect.left
    || e.clientX > rect.right
    || e.clientY < rect.top
    || e.clientY > rect.bottom
  ) {
    isDragOver.value = false
  }
}

const handleDrop = (e: DragEvent) => {
  e.preventDefault()
  isDragOver.value = false
  const files = e.dataTransfer?.files
  if (files?.length) {
    emit("fileSelect", files[0])
  }
}
</script>

<style scoped lang="scss">
@use "../styles/index.scss";
</style>
