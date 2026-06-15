<template>
  <div class="video-toolbar">
    <!-- 主要操作按钮 -->
    <Button
      variant="primary"
      size="small"
      @click="handleRefresh"
    >
      <template #icon>
        <IconWrapper
          name="refresh"
          :size="14"
        />
      </template>
      <span>刷新列表</span>
    </Button>
    <Button
      variant="secondary"
      size="small"
      @click="handleOpenFolder"
    >
      <template #icon>
        <IconWrapper
          name="folder"
          :size="14"
        />
      </template>
      <span>打开文件夹</span>
    </Button>

    <!-- 加密相关按钮 -->
    <Button
      v-if="showEncryptBtn"
      variant="ghost"
      size="small"
      class="btn-encrypt"
      @click="handleBatchEncrypt"
    >
      <template #icon>
        <IconWrapper
          name="encryption"
          :size="14"
        />
      </template>
      <span>批量加密</span>
    </Button>
    <Button
      v-if="showDecryptBtn"
      variant="ghost"
      size="small"
      class="btn-decrypt"
      @click="handleBatchDecrypt"
    >
      <template #icon>
        <IconWrapper
          name="encryption"
          :size="14"
        />
      </template>
      <span>批量解密</span>
    </Button>

    <!-- FFmpeg 工具组 -->
    <div class="ffmpeg-tools">
      <Button
        variant="ghost"
        size="small"
        class="btn-ffmpeg"
        title="下载视频"
        @click="handleDownloadVideo"
      >
        <template #icon>
          <IconWrapper
            name="download"
            :size="14"
          />
        </template>
        <span>下载视频</span>
      </Button>
      <Button
        variant="ghost"
        size="small"
        class="btn-ffmpeg"
        title="视频合并"
        @click="handleMergeVideos"
      >
        <template #icon>
          <IconWrapper
            name="merge"
            :size="14"
          />
        </template>
        <span>视频合并</span>
      </Button>
      <Button
        variant="ghost"
        size="small"
        class="btn-ffmpeg"
        title="视频音频合并"
        @click="handleMergeAudio"
      >
        <template #icon>
          <IconWrapper
            name="merge"
            :size="14"
          />
        </template>
        <span>视频音频合并</span>
      </Button>
      <Button
        variant="ghost"
        size="small"
        class="btn-ffmpeg"
        title="视频压缩"
        @click="handleCompress"
      >
        <template #icon>
          <IconWrapper
            name="video"
            :size="14"
          />
        </template>
        <span>视频压缩</span>
      </Button>
    </div>

    <!-- 分类筛选 -->
    <div
      v-if="categories.length > 0"
      class="category-filter"
    >
      <label>分类:</label>
      <Select
        :model-value="selectedCategory"
        :options="categoryOptions"
        size="small"
        @update:model-value="handleCategoryChange"
      />
    </div>

    <!-- FFmpeg 设置按钮 -->
    <Button
      variant="ghost"
      size="small"
      @click="handleFFmpegSettings"
    >
      <template #icon>
        <IconWrapper
          name="settings"
          :size="14"
        />
      </template>
      <span>FFmpeg设置</span>
    </Button>

    <div class="toolbar-spacer"></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Select from "@/components/Select.vue"

/**
 * 工具栏按钮配置
 */
export interface ToolbarButton {
  /** 按钮标识 */
  key: string
  /** 按钮文本 */
  label: string
  /** 图标名称 */
  icon: string
  /** 是否禁用 */
  disabled?: boolean
  /** 按钮样式类型 */
  variant?: "default" | "primary" | "encrypt" | "decrypt" | "ffmpeg"
}

/**
 * 组件 Props
 */
export interface VideoToolbarProps {
  /** 分类列表 */
  categories?: string[]
  /** 当前选中的分类 */
  selectedCategory?: string
  /** 是否显示加密按钮 */
  showEncryptBtn?: boolean
  /** 是否显示解密按钮 */
  showDecryptBtn?: boolean
  /** 是否显示 FFmpeg 工具 */
  showFFmpegTools?: boolean
  /** FFmpeg 是否可用 */
  hasFFmpeg?: boolean
  /** FFmpeg 路径 */
  ffmpegPath?: string
}

/**
 * 组件事件
 */
export interface VideoToolbarEmits {
  /** 刷新列表 */
  (e: "refresh"): void
  /** 打开文件夹 */
  (e: "openFolder"): void
  /** 批量加密 */
  (e: "batchEncrypt"): void
  /** 批量解密 */
  (e: "batchDecrypt"): void
  /** 下载视频 */
  (e: "downloadVideo"): void
  /** 视频合并 */
  (e: "mergeVideos"): void
  /** 视频音频合并 */
  (e: "mergeAudio"): void
  /** 视频压缩 */
  (e: "compress"): void
  /** FFmpeg 设置 */
  (e: "ffmpegSettings"): void
  /** 分类变化 */
  (e: "categoryChange", category: string): void
}

const props = withDefaults(defineProps<VideoToolbarProps>(), {
  categories: () => [],
  selectedCategory: "",
  showEncryptBtn: false,
  showDecryptBtn: false,
  showFFmpegTools: false,
  hasFFmpeg: false,
  ffmpegPath: "",
})

const emit = defineEmits<VideoToolbarEmits>()

// 分类选项
const categoryOptions = computed(() => [
  {
    value: "",
    label: "全部",
  },
  ...props.categories.map((cat) => ({
    value: cat,
    label: cat,
  })),
])

// 事件处理方法
function handleRefresh() {
  emit("refresh")
}

function handleOpenFolder() {
  emit("openFolder")
}

function handleBatchEncrypt() {
  emit("batchEncrypt")
}

function handleBatchDecrypt() {
  emit("batchDecrypt")
}

function handleDownloadVideo() {
  emit("downloadVideo")
}

function handleMergeVideos() {
  emit("mergeVideos")
}

function handleMergeAudio() {
  emit("mergeAudio")
}

function handleCompress() {
  emit("compress")
}

function handleFFmpegSettings() {
  emit("ffmpegSettings")
}

function handleCategoryChange(value: string) {
  emit("categoryChange", value)
}
</script>

<style lang="scss" scoped>
@use "../styles/VideoToolbar.scss";
</style>
