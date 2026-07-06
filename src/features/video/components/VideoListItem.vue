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
          size="xsmall"
          icon="play"
          :icon-size="14"
          :title="playTitle"
          @click.stop="handlePlay"
        />
        <template v-if="isEncrypted">
          <Button
            variant="ghost"
            size="xsmall"
            icon="encryption"
            :icon-size="14"
            title="解密"
            @click.stop="handleDecrypt"
          />
          <IconWrapper
            class="encrypted-badge"
            :name="encryptionIcon"
            :size="14"
            :title="encryptionType"
          />
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
  return "pageLock"
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

<style lang="scss" scoped>
@use "../styles/VideoListItem.scss";
</style>
