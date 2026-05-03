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
import { computed, watch } from "vue";
import type Player from "video.js/dist/types/player";
import IconWrapper from "@/components/IconWrapper.vue";
import VideoPlayer from "./VideoPlayer.vue";
import { formatFileSize } from "../utils/utils";

/**
 * 视频数据接口
 */
export interface VideoData {
  name: string;
  path: string;
  size: number;
  modTime: number;
  category: string;
}

/**
 * 组件 Props
 */
export interface VideoPlayerDialogProps {
  /** 是否显示对话框 */
  visible?: boolean;
  /** 视频数据 */
  video?: VideoData | null;
  /** 视频 URL */
  videoUrl?: string;
  /** 对话框标题 */
  title?: string;
  /** 播放器宽度（默认 800） */
  playerWidth?: number;
  /** 播放器高度（默认 450） */
  playerHeight?: number;
  /** 是否自适应 */
  fluid?: boolean;
}

/**
 * 组件事件
 */
export interface VideoPlayerDialogEmits {
  /** 关闭对话框 */
  (e: "close"): void;
  /** 播放器初始化完成 */
  (e: "ready", player: Player): void;
  /** 播放器错误 */
  (e: "error", error: any): void;
}

const props = withDefaults(defineProps<VideoPlayerDialogProps>(), {
  visible: false,
  title: "视频播放",
  playerWidth: 800,
  playerHeight: 450,
  fluid: false,
});

const emit = defineEmits<VideoPlayerDialogEmits>();

// 当前视频 URL（处理 Blob URL 释放）
const currentVideoUrl = computed(() => props.videoUrl || "");

// 播放器实例引用
let playerInstance: Player | null = null;

// 处理关闭
function handleClose() {
  // 销毁播放器
  if (playerInstance) {
    playerInstance.dispose();
    playerInstance = null;
  }

  // 释放 Blob URL
  if (currentVideoUrl.value && currentVideoUrl.value.startsWith("blob:")) {
    URL.revokeObjectURL(currentVideoUrl.value);
  }

  emit("close");
}

// 处理播放器就绪
function handlePlayerReady(player: Player) {
  playerInstance = player;
  emit("ready", player);
}

// 处理播放器错误
function handlePlayerError(error: any) {
  console.error("Video player error:", error);
  emit("error", error);
}

// 格式化日期
function formatDate(timestamp?: number): string {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleDateString();
}

// 监听 visible 变化，自动清理
watch(
  () => props.visible,
  (newVal) => {
    if (!newVal) {
      handleClose();
    }
  },
);
</script>

<style scoped lang="scss">
@use "../styles/index.scss";

// 视频播放器对话框特定样式
.dialog-header {
  .icon-btn {
    cursor: pointer;
    color: var(--b3-theme-on-surface-light);

    &:hover {
      color: var(--b3-theme-on-background);
    }
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
</style>
