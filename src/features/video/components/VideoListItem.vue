<template>
  <div
    class="video-item"
    :class="{ 'is-encrypted': isEncrypted }"
    @click="handleClick"
  >
    <div class="video-thumbnail">
      <div class="video-icon">
        <IconWrapper
          name="video"
          :size="18"
        />
      </div>
      <div class="video-info">
        <span
          class="video-name"
          :title="video.name"
        >{{ video.name }}</span>
        <span class="video-size">{{ formatFileSize(video.size) }}</span>
      </div>
    </div>
    <div class="video-actions">
      <span class="video-category">{{ video.category }}</span>
      <div class="action-buttons">
        <Button
          variant="ghost"
          size="small"
          icon="play"
          :icon-size="14"
          :title="playTitle"
          @click.stop="handlePlay"
        />
        <template v-if="isEncrypted">
          <Button
            variant="ghost"
            size="small"
            icon="encryption"
            :icon-size="14"
            title="解密"
            @click.stop="handleDecrypt"
          />
          <span
            class="encrypted-badge"
            :title="encryptionType"
          >
            {{ encryptionIcon }}
          </span>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { VideoData } from "./VideoPlayerDialog.vue"
import { computed } from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { formatFileSize } from "../utils/utils"

/**
 * 组件 Props
 */
export interface VideoListItemProps {
  /** 视频数据 */
  video: VideoData
  /** 是否显示解密按钮 */
  showDecrypt?: boolean
}

/**
 * 组件事件
 */
export interface VideoListItemEmits {
  /** 点击视频项（播放） */
  (e: "play", video: VideoData): void
  /** 点击解密按钮 */
  (e: "decrypt", video: VideoData): void
}

const props = withDefaults(defineProps<VideoListItemProps>(), {
  showDecrypt: true,
})

const emit = defineEmits<VideoListItemEmits>()

// 判断是否是加密视频
const isEncrypted = computed(() => {
  const name = props.video.name.toLowerCase()
  return name.endsWith(".sn") || name.endsWith(".sn2")
})

// 加密类型
const encryptionType = computed(() => {
  const name = props.video.name.toLowerCase()
  if (name.endsWith(".sn2")) {
    return "双重压缩加密"
  }
  if (name.endsWith(".sn")) {
    return "单重压缩加密"
  }
  return ""
})

// 加密图标
const encryptionIcon = computed(() => {
  const name = props.video.name.toLowerCase()
  if (name.endsWith(".sn2")) {
    return "🔒🔒"
  }
  return "🔒"
})

// 播放按钮提示
const playTitle = computed(() => {
  return isEncrypted.value ? "解密并播放" : "播放"
})

// 处理点击
function handleClick() {
  emit("play", props.video)
}

// 处理播放按钮
function handlePlay() {
  emit("play", props.video)
}

// 处理解密
function handleDecrypt() {
  emit("decrypt", props.video)
}
</script>

<style scoped lang="scss">
.video-item {
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: var(--b3-border-radius);
  padding: 12px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 10px;

  &:hover {
    border-color: var(--b3-theme-primary);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }

  &.is-encrypted {
    border-left: 3px solid var(--b3-theme-primary);
  }

  .video-thumbnail {
    display: flex;
    align-items: center;
    gap: 12px;

    .video-icon {
      width: 40px;
      height: 40px;
      background: var(--b3-theme-primary-lightest);
      border-radius: var(--b3-border-radius);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--b3-theme-primary);
      flex-shrink: 0;
      font-size: 18px;
    }

    .video-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;

      .video-name {
        font-weight: 500;
        color: var(--b3-theme-on-surface);
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        font-size: 14px;
        line-height: 1.4;
      }

      .video-size {
        font-size: 12px;
        color: var(--b3-theme-on-surface-light);
      }
    }
  }

  .video-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 8px;
    border-top: 1px solid var(--b3-border-color);

    .video-category {
      font-size: 12px;
      padding: 2px 8px;
      background: var(--b3-theme-primary-lightest);
      color: var(--b3-theme-primary);
      border-radius: 4px;
    }

    .action-buttons {
      display: flex;
      gap: 4px;
      align-items: center;

      .encrypted-badge {
        font-size: 14px;
        padding: 2px 6px;
        background: var(--b3-theme-primary-lightest);
        border-radius: 4px;
        cursor: help;
      }
    }
  }
}

// 响应式调整
@media (max-width: 768px) {
  .video-item {
    .video-thumbnail {
      .video-icon {
        width: 36px;
        height: 36px;

        :deep(.icon) {
          width: 16px !important;
          height: 16px !important;
        }
      }

      .video-info {
        .video-name {
          font-size: 13px;
        }

        .video-size {
          font-size: 11px;
        }
      }
    }

    .video-actions {
      .video-category {
        font-size: 11px;
      }

      .action-buttons {
        .encrypted-badge {
          font-size: 12px;
        }
      }
    }
  }
}
</style>
