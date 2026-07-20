<template>
  <div
    v-if="visible"
    class="dialog-overlay"
    @click="onClose"
  >
    <div
      class="dialog"
      @click.stop
    >
      <div class="dialog-header">
        <h3><IconWrapper
          name="download"
          :size="16"
        /> {{ t("downloadTitle") }}</h3>
        <Button
          icon="x"
          variant="ghost"
          size="xsmall"
          :disabled="downloadProgress"
          @click="onClose"
        />
      </div>
      <div class="dialog-body">
        <!-- yt-dlp 路径设置 -->
        <div class="form-group">
          <label>{{ t("ytdlpPath") }}</label>
          <div class="path-input-group">
            <Input
              v-model="currentYtdlpPath"
              placeholder="E:\Program\yt-dlp.exe"
              :disabled="downloadProgress"
            />
            <Button
              variant="secondary"
              size="xsmall"
              :disabled="downloadProgress"
              :title="t('testPath')"
              @click="testYtdlpPath"
            >
              {{ t("test") }}
            </Button>
            <Button
              variant="secondary"
              size="xsmall"
              :disabled="downloadProgress"
              :title="t('savePath')"
              @click="saveYtdlpPath"
            >
              {{ t("save") }}
            </Button>
          </div>
          <div
            v-if="ytdlpTestResult"
            class="form-hint"
          >
            <span :style="{ color: ytdlpTestResult === 'success' ? '#788c5d' : '#d97757' }">
              <IconWrapper
                v-if="ytdlpTestResult === 'success'"
                name="success"
                :size="14"
              />
              <IconWrapper
                v-else
                name="error"
                :size="14"
              />
              {{ ytdlpTestResult === 'success' ? t("pathValid") : t("pathInvalid") }}
            </span>
          </div>
        </div>

        <div class="form-group">
          <label>{{ t("videoUrlLabel") }}</label>
          <Input
            v-model="downloadUrl"
            :placeholder="t('videoUrlPlaceholder')"
            :disabled="downloadProgress"
          />
          <div class="form-hint">
            {{ t("supportedSites") }}
          </div>
        </div>

        <div class="form-group">
          <label>{{ t("downloadQuality") }}</label>
          <Select
            v-model="downloadQuality"
            :options="qualityOptions"
            :disabled="downloadProgress"
          />
        </div>

        <div class="form-group">
          <label>{{ t("outputFormat") }}</label>
          <Select
            v-model="downloadFormat"
            :options="formatOptions"
            :disabled="downloadProgress"
          />
        </div>

        <div class="form-group">
          <label class="checkbox-label">
            <input
              v-model="downloadSubtitle"
              type="checkbox"
              :disabled="downloadProgress"
            />
            <span>{{ t("downloadSubtitle") }}</span>
          </label>
          <div class="form-hint">
            {{ t("subtitleHint") }}
          </div>
        </div>

        <div class="form-group">
          <label class="checkbox-label">
            <input
              v-model="autoMergeVideoAudio"
              type="checkbox"
              :disabled="downloadProgress"
            />
            <span>{{ t("autoMergeVideoAudio") }}</span>
          </label>
          <div class="form-hint">
            {{ t("autoMergeHint") }}
          </div>
        </div>

        <div
          v-if="downloadProgress"
          class="form-group"
        >
          <label>{{ t("downloadProgress") }}</label>
          <div class="progress-info">
            <div class="progress-bar">
              <div
                class="progress-fill"
                :style="{ width: `${downloadProgressPercent}%` }"
              ></div>
            </div>
            <div class="progress-text">
              {{ downloadProgressPercent }}% - {{ downloadStatus }}
            </div>
          </div>
        </div>

        <div
          v-if="downloadResult"
          class="form-group"
        >
          <div class="encrypt-info">
            <div class="info-item">
              <span class="info-label">{{ t("status") }}：</span>
              <span
                class="info-value"
                :style="{ color: downloadResult.success ? '#788c5d' : '#d97757' }"
              >
                <IconWrapper
                  v-if="downloadResult.success"
                  name="success"
                  :size="14"
                />
                <IconWrapper
                  v-else
                  name="error"
                  :size="14"
                />
                {{ downloadResult.success ? t("downloadSuccessStatus") : t("downloadFailedStatus") }}
              </span>
            </div>
            <div
              v-if="downloadResult.fileName"
              class="info-item"
            >
              <span class="info-label">{{ t("fileName") }}</span>
              <span class="info-value">{{ downloadResult.fileName }}</span>
            </div>
            <div
              v-if="downloadResult.error"
              class="info-item"
            >
              <span class="info-label">{{ t("errorMessage") }}</span>
              <span class="info-value">{{ downloadResult.error }}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="dialog-footer">
        <Button
          variant="secondary"
          :disabled="downloadProgress"
          @click="onClose"
        >
          {{ downloadResult ? t("close") : t("cancel") }}
        </Button>
        <Button
          variant="primary"
          :disabled="downloadProgress || !downloadUrl"
          @click="handleDownloadVideo"
        >
          {{ downloadProgress ? t("downloading") : t("startDownload") }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { YtdlpResult } from "../utils/ytdlp"
import { showMessage } from "siyuan"
import {
  computed,
  ref,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Input from "@/components/Input.vue"
import Select from "@/components/Select.vue"
import { usePlugin } from "@/main"
import {
  buildVideoPath,
  isFFmpegAvailable,
  mergeVideoAudio,
} from "../utils/ffmpeg"
import { getWorkspacePath } from "../utils/utils"
import {
  downloadVideo,
  getCurrentYtdlpPath,
  setYtdlpPath,

} from "../utils/ytdlp"

// Props
const props = defineProps<{
  visible: boolean
}>()

// Emits
const emit = defineEmits<{
  close: []
  success: []
}>()

// i18n
const plugin = usePlugin()
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

// 响应式数据
const downloadUrl = ref("")
const downloadQuality = ref<"best" | "1080p" | "720p" | "480p" | "360p">(
  "best",
)
const downloadFormat = ref<"mp4" | "webm" | "mkv" | "best">("mp4")

// 选项数据
const qualityOptions = computed(() => [
  {
    value: "best",
    label: t("bestQuality"),
  },
  {
    value: "1080p",
    label: "1080p",
  },
  {
    value: "720p",
    label: "720p",
  },
  {
    value: "480p",
    label: "480p",
  },
  {
    value: "360p",
    label: "360p",
  },
])

const formatOptions = computed(() => [
  {
    value: "mp4",
    label: t("mp4Recommended"),
  },
  {
    value: "webm",
    label: "WebM",
  },
  {
    value: "mkv",
    label: "MKV",
  },
  {
    value: "best",
    label: t("bestFormat"),
  },
])
const downloadSubtitle = ref(false)
const autoMergeVideoAudio = ref(false)
const downloadProgress = ref(false)
const downloadProgressPercent = ref(0)
const downloadStatus = ref("")
const downloadResult = ref<YtdlpResult | null>(null)
const currentYtdlpPath = ref("")
const ytdlpTestResult = ref<"success" | "failed" | null>(null)
const mergeProgress = ref(false)
const mergeStatus = ref("")

// 监听 visible 变化，初始化路径
watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      currentYtdlpPath.value = getCurrentYtdlpPath()
      ytdlpTestResult.value = null
      downloadUrl.value = ""
      downloadQuality.value = "best"
      downloadFormat.value = "mp4"
      downloadSubtitle.value = false
      autoMergeVideoAudio.value = false
      downloadProgress.value = false
      downloadProgressPercent.value = 0
      downloadStatus.value = ""
      downloadResult.value = null
      mergeProgress.value = false
      mergeStatus.value = ""
    }
  },
)

// 方法
function onClose() {
  if (downloadProgress.value) {
    showMessage(t("downloadInProgress"), 2000, "info")
    return
  }
  emit("close")
}

function testYtdlpPath() {
  if (!currentYtdlpPath.value) {
    showMessage(t("enterYtdlpPath"), 2000, "error")
    return
  }

  try {
    const fs = (window as any).require("fs")
    if (fs.existsSync(currentYtdlpPath.value)) {
      ytdlpTestResult.value = "success"
      showMessage(t("ytdlpPathValid"), 2000, "info")
    } else {
      ytdlpTestResult.value = "failed"
      showMessage(t("ytdlpPathInvalid"), 2000, "error")
    }
  } catch (error) {
    ytdlpTestResult.value = "failed"
    showMessage(t("testFailed", { msg: (error as Error).message }), 2000, "error")
  }
}

function saveYtdlpPath() {
  if (!currentYtdlpPath.value) {
    showMessage(t("enterYtdlpPath"), 2000, "error")
    return
  }

  const success = setYtdlpPath(currentYtdlpPath.value)
  if (success) {
    showMessage(t("ytdlpPathSaved"), 2000, "info")
    ytdlpTestResult.value = null
  } else {
    showMessage(t("ytdlpPathSaveFailed"), 2000, "error")
  }
}

async function handleDownloadVideo() {
  if (!downloadUrl.value) {
    showMessage(t("enterVideoUrl"), 2000, "error")
    return
  }

  // 检查 FFmpeg 是否可用（如果启用了自动合并）
  if (autoMergeVideoAudio.value && !isFFmpegAvailable()) {
    showMessage(t("needFFmpegForAutoMerge"), 3000, "error")
    return
  }

  downloadProgress.value = true
  downloadProgressPercent.value = 0
  downloadStatus.value = t("preparingDownload")
  downloadResult.value = null
  mergeProgress.value = false
  mergeStatus.value = ""

  try {
    const result = await downloadVideo({
      url: downloadUrl.value,
      quality: downloadQuality.value,
      format: downloadFormat.value,
      subtitle: downloadSubtitle.value,
      onProgress: (progress, status) => {
        downloadProgressPercent.value = progress
        downloadStatus.value = status
      },
    })

    downloadResult.value = result

    if (result.success) {
      showMessage(t("videoDownloadSuccess", { msg: result.fileName || "" }), 3000, "info")

      // 自动合并音视频
      if (autoMergeVideoAudio.value && result.fileName) {
        await handleAutoMerge(result.fileName)
      }

      emit("success")
    } else {
      showMessage(t("videoDownloadFailed", { msg: result.error || t("unknownError") }), 5000, "error")
    }
  } catch (error: any) {
    console.error("下载视频失败:", error)
    downloadResult.value = {
      success: false,
      error: error.message || t("downloadFailedGeneric"),
    }
    showMessage(t("videoDownloadFailed", { msg: error.message }), 5000, "error")
  } finally {
    downloadProgress.value = false
    mergeProgress.value = false
  }
}

/**
 * 自动合并音视频
 * 检查下载目录中是否存在分离的视频和音频文件，如果有则合并
 */
async function handleAutoMerge(fileName: string) {
  if (!fileName) return

  try {
    mergeProgress.value = true
    mergeStatus.value = t("checkingMerge")
    downloadStatus.value = t("checkingAudioVideoFiles")

    // 获取视频目录
    const workspacePath = await getWorkspacePath()
    if (!workspacePath) {
      showMessage(t("cannotGetWorkspacePath"), 2000, "error")
      return
    }

    const videoDir = `${workspacePath}/data/video`
    const fs = (window as any).require("fs")
    const path = (window as any).require("path")

    // 规范化路径函数（统一使用正斜杠）
    function normalizePath(p: string): string {
      return p.replace(/\\/g, "/")
    }

    // 读取目录中的所有文件及其修改时间
    const files = fs.readdirSync(videoDir)
    const fileStats = new Map<string, { mtime: number, size: number }>()

    for (const f of files) {
      try {
        const fullPath = path.join(videoDir, f)
        const stats = fs.statSync(fullPath)
        fileStats.set(f, {
          mtime: stats.mtimeMs,
          size: stats.size,
        })
      } catch (e) {
        // 忽略无法访问的文件
      }
    }

    // 查找可能的相关文件
    const videoExtensions = [".mp4", ".mkv", ".webm", ".m4v"]
    const audioExtensions = [".m4a", ".aac", ".mp3", ".opus", ".ogg", ".wav"]

    // 找出所有可能的视频和音频文件
    const videoFiles: Array<{
      name: string
      path: string
      mtime: number
      normalized: string
    }> = []
    const audioFiles: Array<{
      name: string
      path: string
      mtime: number
      normalized: string
    }> = []

    const now = Date.now()

    // 规范化文件名用于比较：移除所有格式代码和特殊字符
    function normalizeFileName(name: string): string {
      return name
        .toLowerCase()
        .replace(/\.\w{5,6}$/, "") // 移除格式代码
        .replace(/[^a-z0-9\u4E00-\u9FA5]/g, "") // 移除特殊字符，保留字母、数字、中文
    }

    // 收集所有视频和音频文件（包括较旧的），稍后按时间排序选择
    for (const [fname, stats] of fileStats.entries()) {
      const ext = path.extname(fname).toLowerCase()
      const nameWithoutExt = path.basename(fname, ext)
      const normalized = normalizeFileName(nameWithoutExt)

      // 跳过太旧的文件（超过1小时）
      if (now - stats.mtime > 60 * 60 * 1000) {
        continue
      }

      if (videoExtensions.includes(ext)) {
        videoFiles.push({
          name: fname,
          path: path.join(videoDir, fname),
          mtime: stats.mtime,
          normalized,
        })
      } else if (audioExtensions.includes(ext)) {
        audioFiles.push({
          name: fname,
          path: path.join(videoDir, fname),
          mtime: stats.mtime,
          normalized,
        })
      }
    }

    // 按修改时间排序（最新的在前）
    videoFiles.sort((a, b) => b.mtime - a.mtime)
    audioFiles.sort((a, b) => b.mtime - a.mtime)

    // 只保留最近的文件（最多3个视频和3个音频）
    const recentVideoFiles = videoFiles.slice(0, 3)
    const recentAudioFiles = audioFiles.slice(0, 3)

    let videoFile: string | null = null
    let audioFile: string | null = null

    // 匹配策略：找文件名最相似的视频和音频对
    if (recentVideoFiles.length > 0 && recentAudioFiles.length > 0) {
      let bestMatch = {
        video: -1,
        audio: -1,
        score: 0,
      }

      for (let i = 0; i < recentVideoFiles.length; i++) {
        for (let j = 0; j < recentAudioFiles.length; j++) {
          const videoNorm = recentVideoFiles[i].normalized
          const audioNorm = recentAudioFiles[j].normalized

          // 计算相似度（使用最长公共子序列）
          let score = 0
          const longer =
            videoNorm.length > audioNorm.length ? videoNorm : audioNorm
          const shorter =
            videoNorm.length > audioNorm.length ? audioNorm : videoNorm

          if (longer === shorter) {
            score = longer.length
          } else {
            // 简单的相似度计算：包含关系
            if (longer.includes(shorter) || shorter.includes(longer)) {
              score = shorter.length
            } else {
              // 计算公共字符数
              let common = 0
              for (const char of shorter) {
                if (longer.includes(char)) common++
              }
              score = common
            }
          }

          if (score > bestMatch.score) {
            bestMatch = {
              video: i,
              audio: j,
              score,
            }
          }
        }
      }

      // 只有当相似度足够高时才合并
      if (
        bestMatch.score > 10
        && bestMatch.video >= 0
        && bestMatch.audio >= 0
      ) {
        videoFile = recentVideoFiles[bestMatch.video].path
        audioFile = recentAudioFiles[bestMatch.audio].path
      }
    }

    if (!videoFile || !audioFile) {
      showMessage(t("noSeparateFiles"), 2000, "info")
      return
    }

    // 执行合并
    downloadStatus.value = t("mergingAudioVideo")
    mergeStatus.value = t("mergingStatus")

    // 构建输出文件名（使用视频文件的基础部分，移除所有格式代码）
    const videoFileName = path.basename(videoFile)
    let outputBaseName = path.basename(
      videoFileName,
      path.extname(videoFileName),
    )
    // 移除所有可能的格式代码（如 .f100024, .f30280 等）
    outputBaseName = outputBaseName.replace(/\.\w{5,6}$/, "")
    const outputFileName = `${outputBaseName}.${downloadFormat.value}`
    const outputPath = await buildVideoPath(outputFileName)

    // 检查输出文件是否与输入文件相同（使用规范化路径比较）
    if (
      normalizePath(outputPath) === normalizePath(videoFile)
      || normalizePath(outputPath) === normalizePath(audioFile)
    ) {
      // 如果相同，添加临时后缀
      const tempOutputFileName = `${outputBaseName}_temp.${downloadFormat.value}`
      const tempOutputPath = await buildVideoPath(tempOutputFileName)

      // 先合并到临时文件
      const mergeResult = await mergeVideoAudio({
        videoPath: videoFile.replace(`${workspacePath}/`, ""),
        audioPath: audioFile.replace(`${workspacePath}/`, ""),
        outputPath: tempOutputPath,
        onProgress: (progress) => {
          downloadProgressPercent.value = progress
        },
      })

      if (mergeResult.success) {
        // 删除原始文件
        try {
          fs.unlinkSync(videoFile)
          fs.unlinkSync(audioFile)
        } catch (e) {
          showMessage(
            t("audioVideoMergeSuccessKeepOriginal", { msg: tempOutputFileName }),
            3000,
            "info",
          )
        }

        // 重命名临时文件为目标文件名
        try {
          fs.renameSync(tempOutputPath, outputPath)
          showMessage(
            t("audioVideoMergeSuccess", { msg: outputFileName }),
            3000,
            "info",
          )
        } catch (e) {
          showMessage(
            t("audioVideoMergeSuccess", { msg: tempOutputFileName }),
            3000,
            "info",
          )
        }
        return
      } else {
        showMessage(t("audioVideoMergeFailed", { msg: mergeResult.error }), 5000, "error")
        return
      }
    }

    const mergeResult = await mergeVideoAudio({
      videoPath: videoFile.replace(`${workspacePath}/`, ""),
      audioPath: audioFile.replace(`${workspacePath}/`, ""),
      outputPath,
      onProgress: (progress) => {
        downloadProgressPercent.value = progress
      },
    })

    if (mergeResult.success) {
      downloadStatus.value = t("mergeComplete")
      mergeStatus.value = t("mergeSuccessStatusAudio")

      // 删除原始分离文件
      try {
        fs.unlinkSync(videoFile)
        fs.unlinkSync(audioFile)
        showMessage(t("audioVideoMergeSuccess", { msg: outputFileName }), 3000, "info")
      } catch (e) {
        showMessage(
          t("audioVideoMergeSuccessKeepOriginal", { msg: outputFileName }),
          3000,
          "info",
        )
      }
    } else {
      showMessage(t("audioVideoMergeFailed", { msg: mergeResult.error }), 5000, "error")
    }
  } catch (error: any) {
    showMessage(t("autoMergeFailed", { msg: error.message }), 5000, "error")
  } finally {
    mergeProgress.value = false
  }
}
</script>

<style scoped lang="scss">
@use "../styles/index.scss";

.path-input-group {
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>
