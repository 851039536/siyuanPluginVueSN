<template>
  <div class="video-toolbar">
    <!-- 主要操作按钮 -->
    <button class="btn btn-primary" @click="handleRefresh">
      <IconWrapper name="refresh" :size="14" />
      <span>刷新列表</span>
    </button>
    <button class="btn" @click="handleOpenFolder">
      <IconWrapper name="folder" :size="14" />
      <span>打开文件夹</span>
    </button>

    <!-- 加密相关按钮 -->
    <button
      v-if="showEncryptBtn"
      class="btn btn-encrypt"
      @click="handleBatchEncrypt"
    >
      <IconWrapper name="encryption" :size="14" />
      <span>批量加密</span>
    </button>
    <button
      v-if="showDecryptBtn"
      class="btn btn-decrypt"
      @click="handleBatchDecrypt"
    >
      <IconWrapper name="encryption" :size="14" />
      <span>批量解密</span>
    </button>

    <!-- FFmpeg 工具组 -->
    <div  class="ffmpeg-tools">
      <button
        class="btn btn-ffmpeg"
        @click="handleMergeVideos"
        title="视频合并"
      >
        <IconWrapper name="merge" :size="14" />
        <span>视频合并</span>
      </button>
      <button
        class="btn btn-ffmpeg"
        @click="handleMergeAudio"
        title="视频音频合并"
      >
        <IconWrapper name="merge" :size="14" />
        <span>视频音频合并</span>
      </button>
      <button
        class="btn btn-ffmpeg"
        @click="handleCompress"
        title="视频压缩"
      >
        <IconWrapper name="video" :size="14" />
        <span>视频压缩</span>
      </button>
    </div>

    <!-- 分类筛选 -->
    <div v-if="categories.length > 0" class="category-filter">
      <label>分类:</label>
      <select :value="selectedCategory" @change="handleCategoryChange" class="b3-select">
        <option value="">全部</option>
        <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
      </select>
    </div>

    <!-- FFmpeg 设置按钮 -->
    <button class="btn" @click="handleFFmpegSettings">
      <IconWrapper name="settings" :size="14" />
      <span>FFmpeg设置</span>
    </button>

    <div class="toolbar-spacer"></div>
  </div>
</template>

<script setup lang="ts">
import IconWrapper from '@/components/IconWrapper.vue'

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
  variant?: 'default' | 'primary' | 'encrypt' | 'decrypt' | 'ffmpeg'
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
  (e: 'refresh'): void
  /** 打开文件夹 */
  (e: 'openFolder'): void
  /** 批量加密 */
  (e: 'batchEncrypt'): void
  /** 批量解密 */
  (e: 'batchDecrypt'): void
  /** 视频合并 */
  (e: 'mergeVideos'): void
  /** 视频音频合并 */
  (e: 'mergeAudio'): void
  /** 视频压缩 */
  (e: 'compress'): void
  /** FFmpeg 设置 */
  (e: 'ffmpegSettings'): void
  /** 分类变化 */
  (e: 'categoryChange', category: string): void
}

const props = withDefaults(defineProps<VideoToolbarProps>(), {
  categories: () => [],
  selectedCategory: '',
  showEncryptBtn: false,
  showDecryptBtn: false,
  showFFmpegTools: false,
  hasFFmpeg: false,
  ffmpegPath: ''
})

const emit = defineEmits<VideoToolbarEmits>()

// 调试输出
console.log('[VideoToolbar] props:', {
  showFFmpegTools: props.showFFmpegTools,
  hasFFmpeg: props.hasFFmpeg,
  categories: props.categories
})

// 事件处理方法
function handleRefresh() {
  emit('refresh')
}

function handleOpenFolder() {
  emit('openFolder')
}

function handleBatchEncrypt() {
  emit('batchEncrypt')
}

function handleBatchDecrypt() {
  emit('batchDecrypt')
}

function handleMergeVideos() {
  emit('mergeVideos')
}

function handleMergeAudio() {
  emit('mergeAudio')
}

function handleCompress() {
  emit('compress')
}

function handleFFmpegSettings() {
  emit('ffmpegSettings')
}

function handleCategoryChange(event: Event) {
  const target = event.target as HTMLSelectElement
  emit('categoryChange', target.value)
}
</script>

<style scoped lang="scss">
.video-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--b3-border-color);
  background: var(--b3-theme-surface);

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: 1px solid var(--b3-border-color);
    border-radius: var(--b3-border-radius);
    background: var(--b3-theme-surface);
    color: var(--b3-theme-on-surface);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover:not(:disabled) {
      background: var(--b3-theme-primary-lightest);
      border-color: var(--b3-theme-primary);
      color: var(--b3-theme-primary);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    &.btn-primary {
      background: var(--b3-theme-primary);
      color: var(--b3-theme-on-primary);
      border-color: var(--b3-theme-primary);

      &:hover:not(:disabled) {
        background: var(--b3-theme-primary);
        filter: brightness(1.1);
      }
    }

    &.btn-encrypt {
      background: var(--b3-theme-primary-lightest);
      color: var(--b3-theme-primary);
      border-color: var(--b3-theme-primary);

      &:hover:not(:disabled) {
        background: var(--b3-theme-primary);
        color: var(--b3-theme-on-primary);
      }
    }

    &.btn-decrypt {
      background: var(--b3-theme-surface);
      color: var(--b3-theme-on-surface);
      border: 1px solid var(--b3-border-color);

      &:hover:not(:disabled) {
        background: var(--b3-theme-primary-lightest);
        color: var(--b3-theme-primary);
        border-color: var(--b3-theme-primary);
      }
    }
  }

  .category-filter {
    display: flex;
    align-items: center;
    gap: 8px;

    label {
      font-size: 13px;
      color: var(--b3-theme-on-surface);
    }

    .b3-select {
      min-width: 150px;
      padding: 6px 8px;
      border: 1px solid var(--b3-border-color);
      border-radius: var(--b3-border-radius);
      background: var(--b3-theme-background);
      color: var(--b3-theme-on-background);
      font-size: 13px;
      cursor: pointer;

      &:focus {
        outline: none;
        border-color: var(--b3-theme-primary);
      }
    }
  }

  .ffmpeg-tools {
    display: flex;
    gap: 8px;
    align-items: center;
    padding-left: 8px;
    border-left: 1px solid var(--b3-border-color);

    .btn-ffmpeg {
      background: var(--b3-theme-surface);
      color: var(--b3-theme-on-surface);
      border: 1px solid var(--b3-border-color);

      &:hover:not(:disabled) {
        background: var(--b3-theme-primary-lightest);
        color: var(--b3-theme-primary);
        border-color: var(--b3-theme-primary);
      }
    }
  }

  .toolbar-spacer {
    flex: 1;
  }
}

// 响应式调整
@media (max-width: 768px) {
  .video-toolbar {
    flex-wrap: wrap;
    padding: 8px 12px;
    gap: 8px;

    .btn {
      font-size: 12px;
      padding: 6px 10px;

      span {
        display: none;
      }

      :deep(.icon) {
        margin: 0;
      }
    }

    .category-filter {
      width: 100%;
      order: -1;

      .b3-select {
        flex: 1;
        min-width: auto;
      }
    }
  }
}

// 小屏幕优化
@media (max-width: 480px) {
  .video-toolbar {
    .btn {
      flex: 1;
      min-width: 0;

      span {
        display: none;
      }
    }

    .category-filter {
      order: -1;
    }
  }
}
</style>
