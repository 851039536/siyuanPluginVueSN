<template>
  <div class="video-player-wrapper">
    <video
      ref="videoElement"
      class="video-js vjs-default-skin vjs-big-play-centered"
    >
      <slot name="fallback">
        您的浏览器不支持视频播放
      </slot>
    </video>
  </div>
</template>

<script setup lang="ts">
import type Player from "video.js/dist/types/player"
import videojs from "video.js"
import {
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue"
import "video.js/dist/video-js.css"

/**
 * 视频播放器配置选项
 */
export interface VideoPlayerOptions {
  /** 视频源 URL */
  src: string
  /** 视频类型（默认 video/mp4） */
  type?: string
  /** 是否自动播放（默认 false） */
  autoplay?: boolean
  /** 预加载策略（默认 auto） */
  preload?: "none" | "metadata" | "auto"
  /** 播放器宽度（默认 800） */
  width?: number
  /** 播放器高度（默认 450） */
  height?: number
  /** 是否自适应（默认 false） */
  fluid?: boolean
  /** 播放速度选项 */
  playbackRates?: number[]
}

/**
 * 视频播放器事件
 */
export interface VideoPlayerEmits {
  /** 播放器初始化完成 */
  (e: "ready", player: Player): void
  /** 视频开始播放 */
  (e: "play"): void
  /** 视频暂停 */
  (e: "pause"): void
  /** 视频播放结束 */
  (e: "ended"): void
  /** 发生错误 */
  (e: "error", error: any): void
}

const props = withDefaults(defineProps<VideoPlayerOptions>(), {
  type: "video/mp4",
  autoplay: false,
  preload: "auto",
  width: 800,
  height: 450,
  fluid: false,
  playbackRates: () => [0.5, 1, 1.5, 2],
})

const emit = defineEmits<VideoPlayerEmits>()

// Refs
const videoElement = ref<HTMLVideoElement>()
let player: Player | null = null

// 初始化播放器
function initPlayer() {
  if (!videoElement.value) return

  // 销毁旧实例
  if (player) {
    player.dispose()
    player = null
  }

  // 创建新播放器实例
  player = videojs(videoElement.value, {
    controls: true,
    autoplay: props.autoplay,
    preload: props.preload,
    fluid: props.fluid,
    width: props.width,
    height: props.height,
    playbackRates: props.playbackRates,
    controlBar: {
      children: [
        "playToggle",
        "volumePanel",
        "currentTimeDisplay",
        "timeDivider",
        "durationDisplay",
        "progressControl",
        "playbackRateMenuButton",
        "pictureInPictureToggle",
        "fullscreenToggle",
      ],
    },
  })

  // 设置视频源
  player.src({
    src: props.src,
    type: props.type,
  })

  // 绑定事件
  player.ready(() => {
    emit("ready", player!)
  })

  player.on("play", () => emit("play"))
  player.on("pause", () => emit("pause"))
  player.on("ended", () => emit("ended"))
  player.on("error", (error) => emit("error", error))
}

// 监听视频源变化
watch(
  () => props.src,
  () => {
    if (player) {
      player.src({
        src: props.src,
        type: props.type,
      })
    }
  },
)

// 暴露方法供父组件调用
defineExpose({
  /** 播放视频 */
  play: () => player?.play(),
  /** 暂停视频 */
  pause: () => player?.pause(),
  /** 销毁播放器 */
  dispose: () => {
    if (player) {
      player.dispose()
      player = null
    }
  },
  /** 获取播放器实例 */
  getPlayer: () => player,
})

onMounted(() => {
  initPlayer()
})

onBeforeUnmount(() => {
  if (player) {
    player.dispose()
    player = null
  }
})
</script>

<style lang="scss" scoped>
@use "../styles/VideoPlayer.scss";
</style>
