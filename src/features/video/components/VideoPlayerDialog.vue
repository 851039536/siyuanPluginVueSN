<template>
  <div class="dialog-overlay" v-if="visible" @click="handleClose">
    <div class="dialog dialog-large" @click.stop>
      <div class="dialog-header">
        <h3>{{ title }}</h3>
        <IconWrapper name="close" :size="14" class="icon-btn" @click="handleClose" />
      </div>
      <div class="dialog-body">
        <div class="video-player-container">
          <VideoPlayer
            v-if="currentVideoUrl"
            :src="currentVideoUrl"
            :width="playerWidth"
            :height="playerHeight"
            :fluid="fluid"
            @ready="handlePlayerReady"
            @error="handlePlayerError"
          />
          <div class="video-details" v-if="video">
            <h4>{{ video.name }}</h4>
            <div class="video-meta">
              <span class="video-category">{{ video.category }}</span>
              <span>{{ formatFileSize(video.size) }}</span>
              <span>{{ formatDate(video.modTime) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type Player from 'video.js/dist/types/player'
import IconWrapper from '@/components/IconWrapper.vue'
import VideoPlayer, { type VideoPlayerEmits } from './VideoPlayer.vue'

/**
 * 视频数据接口
 */
export interface VideoData {
  name: string
  path: string
  size: number
  modTime: number
  category: string
}

/**
 * 组件 Props
 */
export interface VideoPlayerDialogProps {
  /** 是否显示对话框 */
  visible?: boolean
  /** 视频数据 */
  video?: VideoData | null
  /** 视频 URL */
  videoUrl?: string
  /** 对话框标题 */
  title?: string
  /** 播放器宽度（默认 800） */
  playerWidth?: number
  /** 播放器高度（默认 450） */
  playerHeight?: number
  /** 是否自适应 */
  fluid?: boolean
}

/**
 * 组件事件
 */
export interface VideoPlayerDialogEmits {
  /** 关闭对话框 */
  (e: 'close'): void
  /** 播放器初始化完成 */
  (e: 'ready', player: Player): void
  /** 播放器错误 */
  (e: 'error', error: any): void
}

const props = withDefaults(defineProps<VideoPlayerDialogProps>(), {
  visible: false,
  title: '视频播放',
  playerWidth: 800,
  playerHeight: 450,
  fluid: false
})

const emit = defineEmits<VideoPlayerDialogEmits>()

// 当前视频 URL（处理 Blob URL 释放）
const currentVideoUrl = computed(() => props.videoUrl || '')

// 播放器实例引用
let playerInstance: Player | null = null

// 处理关闭
function handleClose() {
  // 销毁播放器
  if (playerInstance) {
    playerInstance.dispose()
    playerInstance = null
  }

  // 释放 Blob URL
  if (currentVideoUrl.value && currentVideoUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(currentVideoUrl.value)
  }

  emit('close')
}

// 处理播放器就绪
function handlePlayerReady(player: Player) {
  playerInstance = player
  emit('ready', player)
}

// 处理播放器错误
function handlePlayerError(error: any) {
  console.error('Video player error:', error)
  emit('error', error)
}

// 格式化文件大小
function formatFileSize(bytes?: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`
}

// 格式化日期
function formatDate(timestamp?: number): string {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleDateString()
}

// 监听 visible 变化，自动清理
watch(() => props.visible, (newVal) => {
  if (!newVal) {
    handleClose()
  }
})
</script>

<style scoped lang="scss">
// 对话框样式
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
  pointer-events: auto;
}

.dialog {
  background: var(--b3-theme-background);
  border-radius: var(--b3-border-radius);
  box-shadow: var(--b3-dialog-shadow);
  width: 90vw;
  max-width: 500px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;

  &.dialog-large {
    max-width: 800px;
  }

  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--b3-border-color);

    h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--b3-theme-on-background);
    }

    .icon-btn {
      cursor: pointer;
      color: var(--b3-theme-on-surface-light);
      transition: color 0.2s ease;

      &:hover {
        color: var(--b3-theme-on-background);
      }
    }
  }

  .dialog-body {
    padding: 20px;
    overflow-y: auto;
    flex: 1;
  }
}

// 视频播放器容器
.video-player-container {
  display: flex;
  flex-direction: column;
  align-items: center;

  .video-details {
    margin-top: 16px;
    width: 100%;

    h4 {
      margin: 0 0 8px 0;
      color: var(--b3-theme-on-background);
      font-size: 15px;
      font-weight: 500;
    }

    .video-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 13px;
      color: var(--b3-theme-on-surface-light);

      .video-category {
        padding: 2px 8px;
        background: var(--b3-theme-primary-lightest);
        color: var(--b3-theme-primary);
        border-radius: 4px;
        font-size: 12px;
      }
    }
  }
}

// 响应式调整
@media (max-width: 768px) {
  .dialog {
    width: 100vw;
    height: 100vh;
    max-width: none;
    max-height: none;
    border-radius: 0;

    .dialog-header {
      padding: 12px 16px;

      h3 {
        font-size: 14px;
      }
    }

    .dialog-body {
      padding: 16px;
    }
  }
}
</style>
