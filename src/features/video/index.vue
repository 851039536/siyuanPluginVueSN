<template>
  <div
    v-if="visible"
    class="video-manager-overlay"
    @click="onClose"
  >
    <div
      class="video-manager"
      @click.stop
    >
      <!-- 头部 -->
      <div class="video-header">
        <div class="header-left">
          <h2>{{ t("title") }}</h2>
          <span
            v-if="videos.length > 0"
            class="video-count"
          >
            {{ t("xVideos", { count: filteredVideos.length, total: videos.length }) }}
          </span>
        </div>
        <div class="header-right">
          <Button
            icon="x"
            variant="ghost"
            size="xsmall"
            :title="t('close')"
            @click="onClose"
          />
        </div>
      </div>

      <!-- 工具栏 -->
      <VideoToolbar
        :categories="categories"
        :selected-category="selectedCategory"
        :show-encrypt-btn="hasUnencryptedVideos"
        :show-decrypt-btn="hasEncryptedVideos"
        :show-ffmpeg-tools="true"
        :has-ffmpeg="hasFFmpeg"
        :ffmpeg-path="currentFFmpegPath"
        @refresh="refreshList"
        @open-folder="openVideoFolder"
        @batch-encrypt="showBatchEncryptDialog"
        @batch-decrypt="showBatchDecryptDialog"
        @download-video="showDownloadDialog"
        @merge-videos="showMergeDialog"
        @merge-audio="showMergeAudioDialog"
        @compress="showCompressDialog"
        @ffmpeg-settings="showFFmpegPathDialog"
        @category-change="handleCategoryChange"
      />

      <!-- 视频列表 -->
      <div class="video-content">
        <div
          v-if="filteredVideos.length > 0"
          class="video-list"
        >
          <div class="video-grid">
            <VideoListItem
              v-for="video in filteredVideos"
              :key="video.path"
              :video="video"
              @play="playVideo"
              @decrypt="handleSingleDecrypt"
            />
          </div>
        </div>

        <div
          v-else
          class="empty-state"
        >
          <IconWrapper
            name="video"
            :size="64"
            class="empty-icon"
          />
          <p>{{ t("noVideos") }}</p>
          <p class="empty-hint">
            {{ t("emptyHint") }}
          </p>
        </div>
      </div>
    </div>
  </div>

  <!-- 视频播放器对话框 -->
  <VideoPlayerDialog
    :visible="playerVisible"
    :video="currentVideo"
    :video-url="currentVideoUrl"
    :title="t('title')"
    @close="closePlayer"
    @error="handlePlayerError"
  />

  <!-- 视频下载对话框 -->
  <VideoDownloadDialog
    :visible="downloadDialogVisible"
    @close="closeDownloadDialog"
    @success="refreshList"
  />

  <!-- 批量加密对话框 -->
  <EncryptDialog
    :visible="encryptDialogVisible"
    :unencrypted-count="unencryptedCount"
    :double-compress="encryptDoubleCompress"
    @update:double-compress="encryptDoubleCompress = $event"
    :progress="encryptProgress"
    :progress-percent="encryptProgressPercent"
    :current-file="encryptCurrentFile"
    :current-index="encryptCurrentIndex"
    :total-count="encryptTotalCount"
    @close="closeEncryptDialog"
    @start="handleBatchEncrypt"
  />

  <!-- 批量解密对话框 -->
  <DecryptDialog
    :visible="decryptDialogVisible"
    :encrypted-count="encryptedCount"
    :progress="decryptProgress"
    :progress-percent="decryptProgressPercent"
    :current-file="decryptCurrentFile"
    :current-index="decryptCurrentIndex"
    :total-count="decryptTotalCount"
    @close="closeDecryptDialog"
    @start="handleBatchDecrypt"
  />

  <!-- 视频合并对话框 -->
  <MergeDialog
    :visible="mergeDialogVisible"
    :selected-videos="mergeSelectedVideos"
    :videos="videos"
    :output-name="mergeOutputName"
    :progress="mergeProgress"
    :progress-percent="mergeProgressPercent"
    :result="mergeResult"
    :is-selected="isVideoSelected"
    @close="closeMergeDialog"
    @remove="removeMergeVideo"
    @toggle="toggleMergeVideo"
    @start="handleMergeVideos"
    @update:output-name="mergeOutputName = $event"
  />

  <!-- 视频音频合并对话框 -->
  <MergeAudioDialog
    :visible="mergeAudioDialogVisible"
    :video-options="videoOptions"
    :audio-options="audioOptions"
    :selected-video="selectedVideoForMerge"
    :selected-audio="selectedAudioForMerge"
    :output-name="mergeAudioOutputName"
    :progress="mergeAudioProgress"
    :progress-percent="mergeAudioProgressPercent"
    :result="mergeAudioResult"
    @close="closeMergeAudioDialog"
    @start="handleMergeVideoAudio"
    @update:selected-video="selectedVideoForMerge = $event"
    @update:selected-audio="selectedAudioForMerge = $event"
    @update:output-name="mergeAudioOutputName = $event"
  />

  <!-- 视频压缩对话框 -->
  <CompressDialog
    :visible="compressDialogVisible"
    :video-options="videoOptions"
    :selected-video="selectedVideoForCompress"
    :mode="compressMode"
    :crf="compressCRF"
    :bitrate="compressBitrate"
    :output-name="compressOutputName"
    :original-size="formatFileSize(getVideoSize(selectedVideoForCompress))"
    :progress="compressProgress"
    :progress-percent="compressProgressPercent"
    :result="compressResult"
    :original-size-result="formatFileSize(compressOriginalSize)"
    :new-size="formatFileSize(compressNewSize)"
    :compression-rate="calculateCompressionRate(compressOriginalSize, compressNewSize)"
    @close="closeCompressDialog"
    @start="handleCompressVideo"
    @update:selected-video="selectedVideoForCompress = $event"
    @update:mode="compressMode = $event"
    @update:crf="compressCRF = Number($event)"
    @update:bitrate="compressBitrate = $event"
    @update:output-name="compressOutputName = $event"
  />

  <!-- FFmpeg 路径设置对话框 -->
  <FFmpegPathDialog
    :visible="ffmpegPathDialogVisible"
    :current-path="currentFFmpegPath"
    :custom-path="customFFmpegPath"
    :test-result="ffmpegTestResult"
    @close="closeFFmpegPathDialog"
    @reset="resetFFmpegPath"
    @test="testFFmpegPath"
    @save="saveFFmpegPath"
    @update:custom-path="customFFmpegPath = $event"
  />

</template>

<script setup lang="ts">
import { showMessage } from "siyuan"
import { getErrorMessage } from "@/utils/stringUtils"
import {
  computed,
  onMounted,
  ref,
  shallowRef,
  watch,
} from "vue"
import { getWorkspaceDir } from "@/api"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { usePlugin } from "@/main"
import VideoDownloadDialog from "./components/VideoDownloadDialog.vue"
import VideoListItem from "./components/VideoListItem.vue"
import VideoPlayerDialog from "./components/VideoPlayerDialog.vue"
import VideoToolbar from "./components/VideoToolbar.vue"
import EncryptDialog from "./components/EncryptDialog.vue"
import DecryptDialog from "./components/DecryptDialog.vue"
import MergeDialog from "./components/MergeDialog.vue"
import MergeAudioDialog from "./components/MergeAudioDialog.vue"
import CompressDialog from "./components/CompressDialog.vue"
import FFmpegPathDialog from "./components/FFmpegPathDialog.vue"
import { isEncryptedVideo } from "./utils/crypto"
import {
  buildVideoPath,
  calculateCompressionRate,
  clearFFmpegPath,
  compressVideo,
  formatFileSize,
  getCurrentFFmpegPath,
  isFFmpegAvailable,
  mergeVideoAudio,
  mergeVideos,
  setFFmpegPath,
} from "./utils/ffmpeg"
import {
  decryptAllVideos,
  decryptVideoFile,
  encryptAllVideos,
  getVideoCategories,
  getVideoList,
  getVideoStoragePath,
  getVideoUrl,
} from "./utils/videoApi"

// Props
const props = defineProps<{
  visible: boolean
}>()

// Emits
const emit = defineEmits<{
  close: []
}>()

const plugin = usePlugin()

// i18n 辅助函数：支持 {var} 插值
function t(key: string, vars?: Record<string, string | number>): string {
  const i18n = (plugin as any).i18n?.video
  let text = i18n?.[key] ?? key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v))
    }
  }
  return text
}

// ==================== 核心状态 ====================
// 使用 shallowRef 优化大数组性能
const videos = shallowRef<any[]>([])
const categories = ref<string[]>([])
const selectedCategory = ref("")

// ==================== 视频播放状态 ====================
const playerVisible = ref(false)
const currentVideo = ref<any>(null)
const currentVideoUrl = ref("")
const storagePath = ref("data/video")

// ==================== 加密进度状态 ====================
const encryptDialogVisible = ref(false)
const encryptDoubleCompress = ref(false)
const encryptProgress = ref(false)
const encryptCurrentIndex = ref(0)
const encryptTotalCount = ref(0)
const encryptCurrentFile = ref("")

// ==================== 解密进度状态 ====================
const decryptDialogVisible = ref(false)
const decryptProgress = ref(false)
const decryptCurrentIndex = ref(0)
const decryptTotalCount = ref(0)
const decryptCurrentFile = ref("")

// ==================== FFmpeg 状态 ====================
const hasFFmpeg = ref(false)

// 视频合并
const mergeDialogVisible = ref(false)
const mergeSelectedVideos = ref<any[]>([])
const mergeOutputName = ref("merged_video.mp4")
const mergeProgress = ref(false)
const mergeProgressPercent = ref(0)
const mergeResult = ref<{
  success: boolean
  outputPath?: string
  error?: string
} | null>(null)

// 音频合并
const mergeAudioDialogVisible = ref(false)
const selectedVideoForMerge = ref("")
const selectedAudioForMerge = ref("")
const audioFiles = ref<any[]>([])
const mergeAudioOutputName = ref("video_with_audio.mp4")
const mergeAudioProgress = ref(false)
const mergeAudioProgressPercent = ref(0)
const mergeAudioResult = ref<{
  success: boolean
  outputPath?: string
  error?: string
} | null>(null)

// 视频压缩
const compressDialogVisible = ref(false)
const selectedVideoForCompress = ref("")
const compressMode = ref<"crf" | "bitrate">("crf")
const compressCRF = ref(23)
const compressBitrate = ref("1000k")
const compressOutputName = ref("compressed_video.mp4")
const compressProgress = ref(false)
const compressProgressPercent = ref(0)
const compressResult = ref<{
  success: boolean
  outputPath?: string
  error?: string
} | null>(null)
const compressOriginalSize = ref(0)
const compressNewSize = ref(0)

// FFmpeg 路径设置
const ffmpegPathDialogVisible = ref(false)
const customFFmpegPath = ref("")
const currentFFmpegPath = ref("")
const ffmpegTestResult = ref<"success" | "failed" | null>(null)

// ==================== 下载状态 ====================
const downloadDialogVisible = ref(false)

// 计算属性
const filteredVideos = computed(() => {
  if (!selectedCategory.value) return videos.value
  return videos.value.filter(
    (video) => video.category === selectedCategory.value,
  )
})

const unencryptedCount = computed(() => {
  return videos.value.filter((v) => !isEncryptedVideo(v.name)).length
})

const hasUnencryptedVideos = computed(() => {
  return unencryptedCount.value > 0
})

const encryptedCount = computed(() => {
  return videos.value.filter((v) => isEncryptedVideo(v.name)).length
})

const hasEncryptedVideos = computed(() => {
  return encryptedCount.value > 0
})

const encryptProgressPercent = computed(() => {
  if (encryptTotalCount.value === 0) return 0
  return Math.round(
    (encryptCurrentIndex.value / encryptTotalCount.value) * 100,
  )
})

const decryptProgressPercent = computed(() => {
  if (decryptTotalCount.value === 0) return 0
  return Math.round(
    (decryptCurrentIndex.value / decryptTotalCount.value) * 100,
  )
})

// 视频选项列表
const videoOptions = computed(() => [
  {
    value: "",
    label: t("selectVideoOption"),
  },
  ...videos.value.map((video) => ({
    value: video.path,
    label: `${video.name} (${formatFileSize(video.size)})`,
  })),
])

// 音频选项列表
const audioOptions = computed(() => [
  {
    value: "",
    label: t("selectAudioOption"),
  },
  ...audioFiles.value.map((audio) => ({
    value: audio.path,
    label: `${audio.name} (${formatFileSize(audio.size)})`,
  })),
])

// 监听 visible 变化，自动刷新列表
watch(
  () => props.visible,
  async (newVal) => {
    if (newVal) {
      await loadVideos()
      await loadCategories()
    }
  },
)

// 生命周期
onMounted(async () => {
  storagePath.value = await getVideoStoragePath()
  await loadVideos()
  await loadCategories()
  // 检测 FFmpeg 是否可用
  hasFFmpeg.value = isFFmpegAvailable()
  // 获取当前 FFmpeg 路径
  currentFFmpegPath.value = getCurrentFFmpegPath()
})

// 方法
function onClose() {
  emit("close")
}

async function loadCategories() {
  categories.value = await getVideoCategories(plugin)
}

async function loadVideos() {
  videos.value = await getVideoList(plugin)
}

async function refreshList() {
  await loadVideos()
  await loadCategories()
}

async function openVideoFolder() {
  // 如果是桌面端，尝试打开文件夹
  if (window.require) {
    try {
      const { shell } = window.require("electron")

      // 获取工作空间路径
      const workspacePath = await getWorkspaceDir()

      if (workspacePath) {
        const fullPath = `${workspacePath}/${storagePath.value}`
        const result = await shell.openPath(fullPath)

        if (result) {
          console.error("打开文件夹失败:", result)
        } else {
          // showMessage('已打开视频文件夹', 2000, 'info')
        }
      } else {
        // showMessage('无法获取工作空间路径', 2000, 'error')
      }
    } catch (error) {
      console.error("打开文件夹失败:", error)
    }
  } else {
    // showMessage('当前环境不支持打开文件夹', 2000, 'error')
  }
}

async function playVideo(video: any) {
  try {
    currentVideo.value = video
    // 自动解密播放
    currentVideoUrl.value = await getVideoUrl(video.path)

    if (currentVideoUrl.value) {
      playerVisible.value = true
    } else {
      showMessage(t("videoLoadFailed"), 3000, "error")
    }
  } catch (error) {
    showMessage(t("videoPlayFailed", { msg: (error as Error).message }), 3000, "error")
  }
}

function closePlayer() {
  // 释放 Blob URL 以避免内存泄漏
  if (currentVideoUrl.value && currentVideoUrl.value.startsWith("blob:")) {
    URL.revokeObjectURL(currentVideoUrl.value)
  }

  currentVideo.value = null
  currentVideoUrl.value = ""
  playerVisible.value = false
}

// 处理播放器错误
function handlePlayerError(error: any) {
  console.error("Video player error:", error)
  showMessage(t("videoPlayError"), 3000, "error")
}

// 处理分类变化
function handleCategoryChange(category: string) {
  selectedCategory.value = category
}

function showBatchEncryptDialog() {
  if (unencryptedCount.value === 0) {
    showMessage(t("noVideosToEncrypt"), 2000, "info")
    return
  }
  encryptDoubleCompress.value = false
  encryptProgress.value = false
  encryptDialogVisible.value = true
}

function closeEncryptDialog() {
  if (encryptProgress.value) {
    // showMessage('加密进行中，请稍候...', 2000, 'info')
    return
  }
  encryptDialogVisible.value = false
}

async function handleBatchEncrypt() {
  encryptProgress.value = true
  encryptCurrentIndex.value = 0
  encryptTotalCount.value = unencryptedCount.value
  encryptCurrentFile.value = ""

  try {
    const result = await encryptAllVideos(
      plugin,
      encryptDoubleCompress.value,
      (current, total, fileName) => {
        encryptCurrentIndex.value = current
        encryptTotalCount.value = total
        encryptCurrentFile.value = fileName
      },
    )

    // showMessage(
    //   `加密完成！成功: ${result.success} 个，失败: ${result.failed} 个`,
    //   5000,
    //   result.failed > 0 ? 'error' : 'info'
    // )

    if (result.errors.length > 0) {
      console.error("加密错误:", result.errors)
    }

    // 刷新列表
    await loadVideos()
    await loadCategories()

    closeEncryptDialog()
  } catch (error) {
    console.error("批量加密失败:", error)
    // showMessage('批量加密失败: ' + (error as Error).message, 3000, 'error')
  } finally {
    encryptProgress.value = false
  }
}

function showBatchDecryptDialog() {
  if (encryptedCount.value === 0) {
    // showMessage('没有需要解密的视频', 2000, 'info')
    return
  }
  decryptProgress.value = false
  decryptDialogVisible.value = true
}

function closeDecryptDialog() {
  if (decryptProgress.value) {
    // showMessage('解密进行中，请稍候...', 2000, 'info')
    return
  }
  decryptDialogVisible.value = false
}

async function handleBatchDecrypt() {
  decryptProgress.value = true
  decryptCurrentIndex.value = 0
  decryptTotalCount.value = encryptedCount.value
  decryptCurrentFile.value = ""

  try {
    const result = await decryptAllVideos(
      plugin,
      (current, total, fileName) => {
        decryptCurrentIndex.value = current
        decryptTotalCount.value = total
        decryptCurrentFile.value = fileName
      },
    )

    // showMessage(
    //   `解密完成！成功: ${result.success} 个，失败: ${result.failed} 个`,
    //   5000,
    //   result.failed > 0 ? 'error' : 'info'
    // )

    if (result.errors.length > 0) {
      console.error("解密错误:", result.errors)
    }

    // 刷新列表
    await loadVideos()
    await loadCategories()

    closeDecryptDialog()
  } catch (error) {
    console.error("批量解密失败:", error)
    showMessage(t("batchDecryptFailed", { msg: (error as Error).message }), 3000, "error")
  } finally {
    decryptProgress.value = false
  }
}

async function handleSingleDecrypt(video: any) {
  try {
    // showMessage(`正在解密: ${video.name}`, 0, 'info')

    await decryptVideoFile(video.path)

    // showMessage(`解密成功: ${video.name}`, 3000, 'info')

    // 刷新列表
    await loadVideos()
    await loadCategories()
  } catch (error) {
    console.error("解密失败:", error)
    showMessage(t("decryptFailed", { msg: (error as Error).message }), 3000, "error")
  }
}

// ==================== FFmpeg 视频处理方法 ====================

// 视频合并相关方法
function showMergeDialog() {
  if (!hasFFmpeg.value) {
    showMessage(t("ffmpegNotAvailableMerge"), 3000, "error")
    return
  }
  mergeSelectedVideos.value = []
  mergeOutputName.value = "merged_video.mp4"
  mergeProgress.value = false
  mergeProgressPercent.value = 0
  mergeResult.value = null
  mergeDialogVisible.value = true
}

function closeMergeDialog() {
  if (mergeProgress.value) {
    showMessage(t("mergeInProgress"), 2000, "info")
    return
  }
  mergeDialogVisible.value = false
}

function isVideoSelected(video: any): boolean {
  return mergeSelectedVideos.value.some((v) => v.path === video.path)
}

function toggleMergeVideo(video: any) {
  const index = mergeSelectedVideos.value.findIndex(
    (v) => v.path === video.path,
  )
  if (index >= 0) {
    mergeSelectedVideos.value.splice(index, 1)
  } else {
    mergeSelectedVideos.value.push(video)
  }
}

function removeMergeVideo(index: number) {
  mergeSelectedVideos.value.splice(index, 1)
}

async function handleMergeVideos() {
  if (mergeSelectedVideos.value.length < 2) {
    showMessage(t("needTwoVideos"), 2000, "error")
    return
  }

  mergeProgress.value = true
  mergeProgressPercent.value = 0
  mergeResult.value = null

  try {
    const videoPaths = mergeSelectedVideos.value.map((v) => v.path)
    const outputPath = await buildVideoPath(mergeOutputName.value)

    const result = await mergeVideos({
      videoPaths,
      outputPath,
      onProgress: (progress) => {
        mergeProgressPercent.value = progress
      },
    })

    if (result.success) {
      showMessage(t("mergeSuccessMsg"), 3000, "info")
      mergeResult.value = {
        success: true,
        outputPath: mergeOutputName.value,
      }
      // 刷新列表
      await loadVideos()
      await loadCategories()
    } else {
      showMessage(t("mergeFailedMsg", { msg: result.error }), 5000, "error")
      mergeResult.value = {
        success: false,
        error: result.error,
      }
    }
  } catch (error: unknown) {
    console.error("视频合并失败:", error)
    showMessage(t("mergeFailedMsg", { msg: getErrorMessage(error) }), 5000, "error")
    mergeResult.value = {
      success: false,
      error: getErrorMessage(error),
    }
  } finally {
    mergeProgress.value = false
  }
}

// 视频音频合并相关方法
function showMergeAudioDialog() {
  if (!hasFFmpeg.value) {
    showMessage(t("ffmpegNotAvailableAudioMerge"), 3000, "error")
    return
  }

  // 加载音频文件
  loadAudioFiles()

  selectedVideoForMerge.value = ""
  selectedAudioForMerge.value = ""
  mergeAudioOutputName.value = "video_with_audio.mp4"
  mergeAudioProgress.value = false
  mergeAudioProgressPercent.value = 0
  mergeAudioResult.value = null
  mergeAudioDialogVisible.value = true
}

function closeMergeAudioDialog() {
  if (mergeAudioProgress.value) {
    showMessage(t("mergeInProgress"), 2000, "info")
    return
  }
  mergeAudioDialogVisible.value = false
}

async function loadAudioFiles() {
  try {
    const response = await fetch("/api/file/readDir", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: "data/video",
      }),
    })

    const result = await response.json()

    if (result.code === 0 && result.data) {
      const audioExtensions = [".mp3", ".wav", ".ogg", ".m4a", ".aac"]
      audioFiles.value = result.data
        .filter(
          (item: any) =>
            !item.isDir
            && audioExtensions.some((ext) =>
              item.name.toLowerCase().endsWith(ext),
            ),
        )
        .map((item: any) => ({
          name: item.name,
          path: `data/video/${item.name}`,
          size: 0, // 暂时设为0，后续可以获取实际大小
        }))
    }
  } catch (error) {
    console.error("加载音频文件失败:", error)
    audioFiles.value = []
  }
}

async function handleMergeVideoAudio() {
  if (!selectedVideoForMerge.value || !selectedAudioForMerge.value) {
    showMessage(t("needVideoAudioFiles"), 2000, "error")
    return
  }

  mergeAudioProgress.value = true
  mergeAudioProgressPercent.value = 0
  mergeAudioResult.value = null

  try {
    const outputPath = await buildVideoPath(mergeAudioOutputName.value)

    const result = await mergeVideoAudio({
      videoPath: selectedVideoForMerge.value,
      audioPath: selectedAudioForMerge.value,
      outputPath,
      onProgress: (progress) => {
        mergeAudioProgressPercent.value = progress
      },
    })

    if (result.success) {
      showMessage(t("audioMergeSuccessMsg"), 3000, "info")
      mergeAudioResult.value = {
        success: true,
        outputPath: mergeAudioOutputName.value,
      }
      // 刷新列表
      await loadVideos()
      await loadCategories()
    } else {
      showMessage(t("audioMergeFailedMsg", { msg: result.error }), 5000, "error")
      mergeAudioResult.value = {
        success: false,
        error: result.error,
      }
    }
  } catch (error: unknown) {
    console.error("视频音频合并失败:", error)
    showMessage(t("audioMergeFailedMsg", { msg: getErrorMessage(error) }), 5000, "error")
    mergeAudioResult.value = {
      success: false,
      error: getErrorMessage(error),
    }
  } finally {
    mergeAudioProgress.value = false
  }
}

// 视频压缩相关方法
function showCompressDialog() {
  if (!hasFFmpeg.value) {
    showMessage(t("ffmpegNotAvailableCompress"), 3000, "error")
    return
  }

  selectedVideoForCompress.value = ""
  compressMode.value = "crf"
  compressCRF.value = 23
  compressBitrate.value = "1000k"
  compressOutputName.value = "compressed_video.mp4"
  compressProgress.value = false
  compressProgressPercent.value = 0
  compressResult.value = null
  compressOriginalSize.value = 0
  compressNewSize.value = 0
  compressDialogVisible.value = true
}

function closeCompressDialog() {
  if (compressProgress.value) {
    showMessage(t("compressInProgress"), 2000, "info")
    return
  }
  compressDialogVisible.value = false
}

function getVideoSize(videoPath: string): number {
  const video = videos.value.find((v) => v.path === videoPath)
  return video ? video.size : 0
}

async function handleCompressVideo() {
  if (!selectedVideoForCompress.value) {
    showMessage(t("needVideoToCompressFile"), 2000, "error")
    return
  }

  compressProgress.value = true
  compressProgressPercent.value = 0
  compressResult.value = null
  compressOriginalSize.value = getVideoSize(selectedVideoForCompress.value)
  compressNewSize.value = 0

  try {
    const outputPath = await buildVideoPath(compressOutputName.value)

    const params: any = {
      inputPath: selectedVideoForCompress.value,
      outputPath,
      onProgress: (progress: number) => {
        compressProgressPercent.value = progress
      },
    }

    if (compressMode.value === "crf") {
      params.crf = compressCRF.value
    } else {
      params.bitrate = compressBitrate.value
    }

    const result = await compressVideo(params)

    if (result.success) {
      // 获取压缩后的文件大小
      try {
        const fs = (window as any).require("fs")
        const stats = fs.statSync(outputPath)
        compressNewSize.value = stats.size
      } catch (e) {
        console.error("获取压缩后文件大小失败:", e)
      }

      showMessage(t("compressSuccessMsg"), 3000, "info")
      compressResult.value = {
        success: true,
        outputPath: compressOutputName.value,
      }
      // 刷新列表
      await loadVideos()
      await loadCategories()
    } else {
      showMessage(t("compressFailedMsg", { msg: result.error }), 5000, "error")
      compressResult.value = {
        success: false,
        error: result.error,
      }
    }
  } catch (error: unknown) {
    console.error("视频压缩失败:", error)
    showMessage(t("compressFailedMsg", { msg: getErrorMessage(error) }), 5000, "error")
    compressResult.value = {
      success: false,
      error: getErrorMessage(error),
    }
  } finally {
    compressProgress.value = false
  }
}

// FFmpeg 路径设置相关方法
function showFFmpegPathDialog() {
  // 获取当前路径
  currentFFmpegPath.value = getCurrentFFmpegPath()
  customFFmpegPath.value = ""
  ffmpegTestResult.value = null
  ffmpegPathDialogVisible.value = true
}

function closeFFmpegPathDialog() {
  ffmpegPathDialogVisible.value = false
}

async function testFFmpegPath() {
  if (!customFFmpegPath.value) {
    showMessage(t("enterFFmpegPath"), 2000, "error")
    return
  }

  try {
    const fs = (window as any).require("fs")
    if (fs.existsSync(customFFmpegPath.value)) {
      ffmpegTestResult.value = "success"
      showMessage(t("ffmpegPathValid"), 2000, "info")
    } else {
      ffmpegTestResult.value = "failed"
      showMessage(t("ffmpegPathInvalid"), 2000, "error")
    }
  } catch (error) {
    ffmpegTestResult.value = "failed"
    showMessage(t("testFailed", { msg: (error as Error).message }), 2000, "error")
  }
}

function saveFFmpegPath() {
  if (!customFFmpegPath.value) {
    showMessage(t("enterFFmpegPath"), 2000, "error")
    return
  }

  const success = setFFmpegPath(customFFmpegPath.value)
  if (success) {
    showMessage(t("ffmpegPathSaved"), 2000, "info")
    currentFFmpegPath.value = getCurrentFFmpegPath()
    hasFFmpeg.value = isFFmpegAvailable()
    closeFFmpegPathDialog()
  } else {
    showMessage(t("ffmpegPathSaveFailed"), 2000, "error")
  }
}

function resetFFmpegPath() {
  clearFFmpegPath()
  currentFFmpegPath.value = getCurrentFFmpegPath()
  hasFFmpeg.value = isFFmpegAvailable()
  showMessage(t("ffmpegPathReset"), 2000, "info")
}

// ==================== yt-dlp 下载方法 ====================

function showDownloadDialog() {
  downloadDialogVisible.value = true
}

function closeDownloadDialog() {
  downloadDialogVisible.value = false
}
</script>

<style scoped lang="scss">
@use "./styles/index.scss";
</style>
