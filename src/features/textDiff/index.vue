<!--
  文本对比功能主面板 — 并排输入 + diff 查看器，支持拖拽导入与主题/模式/字号切换
-->
<template>
  <div class="text-diff-container">
    <!-- 工具栏 -->
    <div class="diff-toolbar">
      <div class="toolbar-left">
        <div class="option-group">
          <span class="option-label">{{ $t('displayMode') }}</span>
          <button
            v-for="mode in modeOptions"
            :key="mode.value"
            class="toggle-btn"
            :class="{ active: diffMode === mode.value }"
            @click="updateMode(mode.value)"
          >
            {{ mode.label }}
          </button>
        </div>

        <div class="option-group">
          <span class="option-label">{{ $t('fontSize') }}</span>
          <select
            class="font-select"
            :value="fontSize"
            @change="updateFontSize(Number(($event.target as HTMLSelectElement).value))"
          >
            <option
              v-for="opt in FONT_SIZE_OPTIONS"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>
        </div>

        <div class="option-group">
          <span class="option-label">{{ $t('theme') }}</span>
          <button
            v-for="t in themeOptions"
            :key="t.value"
            class="toggle-btn"
            :class="{ active: diffTheme === t.value }"
            @click="updateTheme(t.value)"
          >
            {{ t.label }}
          </button>
        </div>
      </div>

      <div class="toolbar-right">
        <button
          class="action-btn"
          :title="$t('clear')"
          @click="clearAll"
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="currentColor"
          >
            <path :d="ICONS.close" />
          </svg>
          <span>{{ $t('clear') }}</span>
        </button>
        <button
          class="action-btn"
          :title="$t('swap')"
          @click="swapTexts"
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="currentColor"
          >
            <path :d="ICONS.swap" />
          </svg>
          <span>{{ $t('swap') }}</span>
        </button>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="diff-main">
      <!-- 输入区域 -->
      <div class="input-section">
        <!-- 原文本面板 -->
        <div
          class="input-panel"
          :class="{ 'drag-over': dragState.original }"
          @dragover.prevent="handleDragOver('original', $event)"
          @dragleave="handleDragLeave('original')"
          @drop.prevent="handleDrop('original', $event)"
        >
          <div class="panel-header">
            <div class="header-left">
              <span class="panel-title">{{ $t('original') }}</span>
              <span
                v-if="originalFileName"
                class="file-name"
              >{{ originalFileName }}</span>
            </div>
            <div class="header-right">
              <span class="char-count">{{ originalText.length }} {{ $t('chars') }}</span>
              <button
                class="file-btn"
                :title="$t('selectFile')"
                @click="triggerFileInput('original')"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="currentColor"
                >
                  <path :d="ICONS.file" />
                </svg>
              </button>
            </div>
          </div>
          <textarea
            v-model="originalText"
            :placeholder="$t('originalPlaceholder')"
            class="input-textarea"
          ></textarea>
          <!-- 拖拽提示层 -->
          <div
            v-if="dragState.original"
            class="drag-overlay"
          >
            <svg
              viewBox="0 0 24 24"
              width="32"
              height="32"
              fill="currentColor"
            >
              <path :d="ICONS.cloudUpload" />
            </svg>
            <span>{{ $t('dropFile') }}</span>
          </div>
        </div>

        <!-- 修改后文本面板 -->
        <div
          class="input-panel"
          :class="{ 'drag-over': dragState.modified }"
          @dragover.prevent="handleDragOver('modified', $event)"
          @dragleave="handleDragLeave('modified')"
          @drop.prevent="handleDrop('modified', $event)"
        >
          <div class="panel-header">
            <div class="header-left">
              <span class="panel-title">{{ $t('modified') }}</span>
              <span
                v-if="modifiedFileName"
                class="file-name"
              >{{ modifiedFileName }}</span>
            </div>
            <div class="header-right">
              <span class="char-count">{{ modifiedText.length }} {{ $t('chars') }}</span>
              <button
                class="file-btn"
                :title="$t('selectFile')"
                @click="triggerFileInput('modified')"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="currentColor"
                >
                  <path :d="ICONS.file" />
                </svg>
              </button>
            </div>
          </div>
          <textarea
            v-model="modifiedText"
            :placeholder="$t('modifiedPlaceholder')"
            class="input-textarea"
          ></textarea>
          <!-- 拖拽提示层 -->
          <div
            v-if="dragState.modified"
            class="drag-overlay"
          >
            <svg
              viewBox="0 0 24 24"
              width="32"
              height="32"
              fill="currentColor"
            >
              <path :d="ICONS.cloudUpload" />
            </svg>
            <span>{{ $t('dropFile') }}</span>
          </div>
        </div>
      </div>

      <!-- 隐藏的文件输入 -->
      <input
        ref="fileInputRef"
        type="file"
        style="display: none"
        @change="handleFileSelect"
      />

      <!-- 分割线 -->
      <div class="divider">
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="currentColor"
        >
          <path :d="ICONS.chevronDown" />
        </svg>
      </div>

      <!-- 差异结果 -->
      <div class="result-section">
        <div class="panel-header">
          <span class="panel-title">{{ $t('diffResult') }}</span>
        </div>
        <Diff
          class="diff-viewer"
          :mode="diffMode"
          :theme="diffTheme"
          language="plaintext"
          :prev="originalText"
          :current="modifiedText"
          :folding="false"
          :virtual-scroll="false"
          :render-added="true"
          :render-removed="true"
          :hide-line-numbers="false"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import type { TextDiffSettings } from "./types/storage"
import {
  computed,
  onMounted,
  reactive,
  ref,
} from "vue"
import { Diff } from "vue-diff"
import { TextDiffStorage } from "./types/storage"
import "vue-diff/dist/index.css"

const props = defineProps<{
  onClose?: () => void
  i18n?: any
  plugin?: Plugin
}>()

// 存储管理
const storage = props.plugin ? new TextDiffStorage(props.plugin) : null

// 文件输入引用
const fileInputRef = ref<HTMLInputElement | null>(null)
const currentInputTarget = ref<"original" | "modified">("original")

// 响应式数据
const originalText = ref("")
const modifiedText = ref("")
const originalFileName = ref("")
const modifiedFileName = ref("")
const diffMode = ref<"split" | "unified">("split")
const diffTheme = ref<"light" | "dark">("light")
const fontSize = ref<number>(14)

// 拖拽状态
const dragState = reactive({
  original: false,
  modified: false,
})

// 内联 SVG 图标路径（模板复用去重）
const ICONS = {
  close: "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
  swap: "M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z",
  file: "M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z",
  cloudUpload: "M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z",
  chevronDown: "M7 10l5 5 5-5z",
}

// 选项数据
const FONT_SIZE_OPTIONS = [
  {
    value: 12,
    label: "12px",
  },
  {
    value: 14,
    label: "14px",
  },
  {
    value: 16,
    label: "16px",
  },
  {
    value: 18,
    label: "18px",
  },
  {
    value: 20,
    label: "20px",
  },
  {
    value: 24,
    label: "24px",
  },
]

const modeOptions = computed(() => [
  {
    value: "split" as const,
    label: $t("splitMode"),
  },
  {
    value: "unified" as const,
    label: $t("unifiedMode"),
  },
])

const themeOptions = computed(() => [
  {
    value: "light" as const,
    label: $t("lightTheme"),
  },
  {
    value: "dark" as const,
    label: $t("darkTheme"),
  },
])

// 设置字体大小
const setFontSize = (size: number) => {
  document.documentElement.style.setProperty("--diff-font-size", `${size}px`)
}

// 加载设置
const loadSettings = async () => {
  if (!storage) return
  try {
    const settings = await storage.settings.loadOrDefault()
    diffMode.value = settings.diffMode
    diffTheme.value = settings.theme
    fontSize.value = settings.fontSize
    setFontSize(settings.fontSize)
  } catch (error) {
    console.error("加载设置失败:", error)
  }
}

// 保存设置
const saveSettings = async () => {
  if (!storage) return
  try {
    const settings: TextDiffSettings = {
      fontSize: fontSize.value,
      diffMode: diffMode.value,
      theme: diffTheme.value,
    }
    await storage.settings.save(settings)
  } catch (error) {
    console.error("保存设置失败:", error)
  }
}

const updateMode = (mode: "split" | "unified") => {
  diffMode.value = mode
  saveSettings()
}

const updateTheme = (theme: "light" | "dark") => {
  diffTheme.value = theme
  saveSettings()
}

const updateFontSize = (size: number) => {
  fontSize.value = size
  setFontSize(size)
  saveSettings()
}

const clearAll = () => {
  originalText.value = ""
  modifiedText.value = ""
  originalFileName.value = ""
  modifiedFileName.value = ""
}

const swapTexts = () => {
  const tempText = originalText.value
  const tempName = originalFileName.value
  originalText.value = modifiedText.value
  originalFileName.value = modifiedFileName.value
  modifiedText.value = tempText
  modifiedFileName.value = tempName
}

// 触发文件选择
const triggerFileInput = (target: "original" | "modified") => {
  currentInputTarget.value = target
  fileInputRef.value?.click()
}

// 处理文件选择
const handleFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    readFile(file, currentInputTarget.value)
  }
  // 重置 input 以允许再次选择同一文件
  input.value = ""
}

// 处理拖拽进入
const handleDragOver = (target: "original" | "modified", event: DragEvent) => {
  if (event.dataTransfer?.types.includes("Files")) {
    dragState[target] = true
  }
}

// 处理拖拽离开
const handleDragLeave = (target: "original" | "modified") => {
  dragState[target] = false
}

// 处理文件放置
const handleDrop = (target: "original" | "modified", event: DragEvent) => {
  dragState[target] = false
  const file = event.dataTransfer?.files?.[0]
  if (file) {
    readFile(file, target)
  }
}

// 读取文件内容
const readFile = (file: File, target: "original" | "modified") => {
  const reader = new FileReader()
  reader.onload = () => {
    const content = reader.result as string
    if (target === "original") {
      originalText.value = content
      originalFileName.value = file.name
    } else {
      modifiedText.value = content
      modifiedFileName.value = file.name
    }
  }
  reader.onerror = () => {
    console.error("读取文件失败:", file.name)
  }
  reader.readAsText(file)
}

// 国际化
const $t = (key: string): string => {
  return props.i18n?.textDiff?.[key] || key
}

onMounted(() => {
  loadSettings()
  setFontSize(fontSize.value)
})
</script>

<style scoped lang="scss">
@use './styles/TextDiff.scss';
</style>
