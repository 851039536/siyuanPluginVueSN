<!--
  文本对比功能输入面板子组件 — 单侧文本输入：标题栏 + 文本域 + 文件选择/拖拽导入
-->
<template>
  <div
    class="input-panel"
    :class="{ 'drag-over': dragState }"
    @dragover.prevent="handleDragOver"
    @dragleave="handleDragLeave"
    @drop.prevent="handleDrop"
  >
    <!-- 面板头部：标题 + 文件名 + 字符数 + 文件选择按钮 -->
    <div class="panel-header">
      <div class="header-left">
        <!-- 面板标题（"原文本" / "修改后文本"） -->
        <span class="panel-title">{{ i18n(titleKey) }}</span>
        <!-- 已导入文件名 -->
        <span v-if="fileName" class="file-name">{{ fileName }}</span>
      </div>
      <div class="header-right">
        <!-- 字符计数（"字符"） -->
        <span class="char-count">{{ modelValue.length }} {{ i18n("chars") }}</span>
        <!-- 选择文件按钮（"选择文件"） -->
        <button
          class="file-btn"
          :title="i18n('selectFile')"
          @click="triggerFileInput"
        >
          <Icon icon="mdi:file-outline" :width="14" :height="14" />
        </button>
      </div>
    </div>

    <!-- 输入主体：相对定位容器，拖拽遮罩层覆盖其内 -->
    <div class="input-body">
      <!-- 文本输入区（占位文案随面板类型变化） -->
      <textarea
        v-model="text"
        :placeholder="i18n(placeholderKey)"
        class="input-textarea"
      ></textarea>
      <!-- 拖拽提示层 -->
      <div v-if="dragState" class="drag-overlay">
        <Icon icon="mdi:cloud-upload-outline" :width="32" :height="32" />
        <!-- 拖拽释放提示（"释放文件以导入"） -->
        <span>{{ i18n("dropFile") }}</span>
      </div>
    </div>

    <!-- 隐藏的文件输入（class 化，替代内联 style） -->
    <input
      ref="fileInputRef"
      type="file"
      class="hidden-file-input"
      @change="handleFileSelect"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * 文本对比输入面板：自包含文件选择/拖拽/FileReader 读取，通过 v-model 多绑定与父组件同步
 */
import { computed, ref } from "vue"
import { Icon } from "@iconify/vue"
import { textDiffI18n } from "../utils"

const props = defineProps<{
  /** 面板标题 i18n 键（original / modified） */
  titleKey: string
  /** 占位文案 i18n 键（originalPlaceholder / modifiedPlaceholder） */
  placeholderKey: string
  /** 文本内容（v-model） */
  modelValue: string
  /** 导入的文件名（v-model:fileName） */
  fileName: string
  /** 插件国际化对象 */
  i18n?: Record<string, any>
}>()

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void
  (e: "update:fileName", value: string): void
}>()

// 文本双向绑定
const text = computed({
  get: () => props.modelValue,
  set: (val: string) => emit("update:modelValue", val),
})

// 国际化
const i18n = (key: string): string => textDiffI18n(props.i18n, key)

// 文件输入引用
const fileInputRef = ref<HTMLInputElement | null>(null)

// 拖拽状态
const dragState = ref(false)

// 触发文件选择
const triggerFileInput = () => {
  fileInputRef.value?.click()
}

// 处理文件选择
const handleFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    readFile(file)
  }
  // 重置 input 以允许再次选择同一文件
  input.value = ""
}

// 处理拖拽进入（仅响应文件类型）
const handleDragOver = (event: DragEvent) => {
  if (event.dataTransfer?.types.includes("Files")) {
    dragState.value = true
  }
}

// 处理拖拽离开
const handleDragLeave = () => {
  dragState.value = false
}

// 处理文件放置
const handleDrop = (event: DragEvent) => {
  dragState.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) {
    readFile(file)
  }
}

// 读取文件内容并回传文本与文件名
const readFile = (file: File) => {
  const reader = new FileReader()
  reader.onload = () => {
    emit("update:modelValue", reader.result as string)
    emit("update:fileName", file.name)
  }
  reader.onerror = () => {
    console.error("读取文件失败:", file.name)
  }
  reader.readAsText(file)
}
</script>

<style scoped lang="scss">
@use '../styles/InputPanel.scss';
@use '../styles/index.scss';
</style>
