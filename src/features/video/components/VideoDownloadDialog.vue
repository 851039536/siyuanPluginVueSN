<template>
  <div class="dialog-overlay" v-if="visible" @click="onClose">
    <div class="dialog" @click.stop>
      <div class="dialog-header">
        <h3>📥 视频下载</h3>
        <button class="icon-btn" @click="onClose" :disabled="downloadProgress">
          <svg class="icon"><use xlink:href="#iconClose"></use></svg>
        </button>
      </div>
      <div class="dialog-body">
        <!-- yt-dlp 路径设置 -->
        <div class="form-group">
          <label>yt-dlp 路径</label>
          <div class="path-input-group">
            <input
              v-model="currentYtdlpPath"
              type="text"
              class="b3-text-field"
              placeholder="E:\Program\yt-dlp.exe"
              :disabled="downloadProgress"
            />
            <button class="btn" @click="testYtdlpPath" :disabled="downloadProgress" title="测试路径">
              测试
            </button>
            <button class="btn" @click="saveYtdlpPath" :disabled="downloadProgress" title="保存路径">
              保存
            </button>
          </div>
          <div class="form-hint" v-if="ytdlpTestResult">
            <span :style="{ color: ytdlpTestResult === 'success' ? '#788c5d' : '#d97757' }">
              {{ ytdlpTestResult === 'success' ? '✅ 路径有效' : '❌ 路径无效' }}
            </span>
          </div>
        </div>

        <div class="form-group">
          <label>视频链接</label>
          <input
            v-model="downloadUrl"
            type="text"
            class="b3-text-field"
            placeholder="请输入视频 URL（支持 YouTube、Bilibili 等）"
            :disabled="downloadProgress"
          />
          <div class="form-hint">
            支持的网站：YouTube、Bilibili、Twitter/X、Vimeo、Instagram、Facebook、TikTok 等
          </div>
        </div>

        <div class="form-group">
          <label>下载质量</label>
          <select v-model="downloadQuality" class="b3-select" :disabled="downloadProgress">
            <option value="best">最佳质量</option>
            <option value="1080p">1080p</option>
            <option value="720p">720p</option>
            <option value="480p">480p</option>
            <option value="360p">360p</option>
          </select>
        </div>

        <div class="form-group">
          <label>输出格式</label>
          <select v-model="downloadFormat" class="b3-select" :disabled="downloadProgress">
            <option value="mp4">MP4（推荐）</option>
            <option value="webm">WebM</option>
            <option value="mkv">MKV</option>
            <option value="best">最佳格式</option>
          </select>
        </div>

        <div class="form-group">
          <label class="checkbox-label">
            <input
              v-model="downloadSubtitle"
              type="checkbox"
              :disabled="downloadProgress"
            />
            <span>下载字幕（如果可用）</span>
          </label>
          <div class="form-hint">
            自动下载中文和英文字幕，并嵌入视频中
          </div>
        </div>

        <div class="form-group">
          <label class="checkbox-label">
            <input
              v-model="autoMergeVideoAudio"
              type="checkbox"
              :disabled="downloadProgress"
            />
            <span>下载完成自动合并音视频</span>
          </label>
          <div class="form-hint">
            如果下载产生分离的视频和音频文件，自动使用 FFmpeg 合并
          </div>
        </div>

        <div class="form-group" v-if="downloadProgress">
          <label>下载进度</label>
          <div class="progress-info">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: downloadProgressPercent + '%' }"></div>
            </div>
            <div class="progress-text">
              {{ downloadProgressPercent }}% - {{ downloadStatus }}
            </div>
          </div>
        </div>

        <div class="form-group" v-if="downloadResult">
          <div class="encrypt-info">
            <div class="info-item">
              <span class="info-label">状态：</span>
              <span class="info-value" :style="{ color: downloadResult.success ? '#788c5d' : '#d97757' }">
                {{ downloadResult.success ? '✅ 下载成功' : '❌ 下载失败' }}
              </span>
            </div>
            <div class="info-item" v-if="downloadResult.fileName">
              <span class="info-label">文件名：</span>
              <span class="info-value">{{ downloadResult.fileName }}</span>
            </div>
            <div class="info-item" v-if="downloadResult.error">
              <span class="info-label">错误信息：</span>
              <span class="info-value">{{ downloadResult.error }}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="dialog-footer">
        <button
          class="btn"
          @click="onClose"
          :disabled="downloadProgress"
        >
          {{ downloadResult ? '关闭' : '取消' }}
        </button>
        <button
          class="btn btn-primary"
          @click="handleDownloadVideo"
          :disabled="downloadProgress || !downloadUrl"
        >
          {{ downloadProgress ? '下载中...' : '开始下载' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { showMessage } from 'siyuan'
import {
  downloadVideo,
  setYtdlpPath,
  getCurrentYtdlpPath,
  type YtdlpResult
} from '../ytdlp'
import {
  mergeVideoAudio,
  isFFmpegAvailable,
  buildVideoPath,
  getWorkspacePath
} from '../ffmpeg'

// Props
const props = defineProps<{
  visible: boolean
}>()

// Emits
const emit = defineEmits<{
  close: []
  success: []
}>()

// 响应式数据
const downloadUrl = ref('')
const downloadQuality = ref<'best' | '1080p' | '720p' | '480p' | '360p'>('best')
const downloadFormat = ref<'mp4' | 'webm' | 'mkv' | 'best'>('mp4')
const downloadSubtitle = ref(false)
const autoMergeVideoAudio = ref(false)
const downloadProgress = ref(false)
const downloadProgressPercent = ref(0)
const downloadStatus = ref('')
const downloadResult = ref<YtdlpResult | null>(null)
const currentYtdlpPath = ref('')
const ytdlpTestResult = ref<'success' | 'failed' | null>(null)
const mergeProgress = ref(false)
const mergeStatus = ref('')

// 监听 visible 变化，初始化路径
watch(() => props.visible, (newVal) => {
  if (newVal) {
    currentYtdlpPath.value = getCurrentYtdlpPath()
    ytdlpTestResult.value = null
    downloadUrl.value = ''
    downloadQuality.value = 'best'
    downloadFormat.value = 'mp4'
    downloadSubtitle.value = false
    autoMergeVideoAudio.value = false
    downloadProgress.value = false
    downloadProgressPercent.value = 0
    downloadStatus.value = ''
    downloadResult.value = null
    mergeProgress.value = false
    mergeStatus.value = ''
  }
})

// 方法
function onClose() {
  if (downloadProgress.value) {
    showMessage('下载进行中，请稍候...', 2000, 'info')
    return
  }
  emit('close')
}

function testYtdlpPath() {
  if (!currentYtdlpPath.value) {
    showMessage('请输入 yt-dlp 路径', 2000, 'error')
    return
  }

  try {
    const fs = (window as any).require('fs')
    if (fs.existsSync(currentYtdlpPath.value)) {
      ytdlpTestResult.value = 'success'
      showMessage('yt-dlp 路径有效！', 2000, 'info')
    } else {
      ytdlpTestResult.value = 'failed'
      showMessage('yt-dlp 路径不存在', 2000, 'error')
    }
  } catch (error) {
    ytdlpTestResult.value = 'failed'
    showMessage('测试失败: ' + (error as Error).message, 2000, 'error')
  }
}

function saveYtdlpPath() {
  if (!currentYtdlpPath.value) {
    showMessage('请输入 yt-dlp 路径', 2000, 'error')
    return
  }

  const success = setYtdlpPath(currentYtdlpPath.value)
  if (success) {
    showMessage('yt-dlp 路径已保存！', 2000, 'info')
    ytdlpTestResult.value = null
  } else {
    showMessage('保存失败：路径不存在', 2000, 'error')
  }
}

async function handleDownloadVideo() {
  if (!downloadUrl.value) {
    showMessage('请输入视频 URL', 2000, 'error')
    return
  }

  // 检查 FFmpeg 是否可用（如果启用了自动合并）
  if (autoMergeVideoAudio.value && !isFFmpegAvailable()) {
    showMessage('自动合并需要 FFmpeg，请先安装并配置 FFmpeg', 3000, 'error')
    return
  }

  downloadProgress.value = true
  downloadProgressPercent.value = 0
  downloadStatus.value = '准备下载...'
  downloadResult.value = null
  mergeProgress.value = false
  mergeStatus.value = ''

  try {
    const result = await downloadVideo({
      url: downloadUrl.value,
      quality: downloadQuality.value,
      format: downloadFormat.value,
      subtitle: downloadSubtitle.value,
      onProgress: (progress, status) => {
        downloadProgressPercent.value = progress
        downloadStatus.value = status
      }
    })

    downloadResult.value = result

    if (result.success) {
      showMessage(`视频下载成功！${result.fileName || ''}`, 3000, 'info')

      // 自动合并音视频
      if (autoMergeVideoAudio.value && result.fileName) {
        await handleAutoMerge(result.fileName)
      }

      emit('success')
    } else {
      showMessage(`视频下载失败: ${result.error || '未知错误'}`, 5000, 'error')
    }
  } catch (error: any) {
    console.error('下载视频失败:', error)
    downloadResult.value = {
      success: false,
      error: error.message || '下载失败'
    }
    showMessage('视频下载失败: ' + error.message, 5000, 'error')
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
    mergeStatus.value = '检查是否需要合并...'
    downloadStatus.value = '检查音视频文件...'

    // 获取视频目录
    const workspacePath = await getWorkspacePath()
    if (!workspacePath) {
      showMessage('无法获取工作区路径', 2000, 'error')
      return
    }

    const videoDir = `${workspacePath}/data/video`
    const fs = (window as any).require('fs')
    const path = (window as any).require('path')

    // 读取目录中的所有文件及其修改时间
    const files = fs.readdirSync(videoDir)
    const fileStats = new Map<string, { mtime: number; size: number }>()

    for (const f of files) {
      try {
        const fullPath = path.join(videoDir, f)
        const stats = fs.statSync(fullPath)
        fileStats.set(f, { mtime: stats.mtimeMs, size: stats.size })
      } catch (e) {
        // 忽略无法访问的文件
      }
    }

    console.log('[AutoMerge] 目录中的文件:', Array.from(fileStats.keys()))

    // 查找可能的相关文件
    const videoExtensions = ['.mp4', '.mkv', '.webm', '.m4v']
    const audioExtensions = ['.m4a', '.aac', '.mp3', '.opus', '.ogg', '.wav']

    // 找出所有可能的视频和音频文件
    const videoFiles: Array<{ name: string; path: string; mtime: number; normalized: string }> = []
    const audioFiles: Array<{ name: string; path: string; mtime: number; normalized: string }> = []

    const now = Date.now()
    const recentThreshold = 2 * 60 * 1000 // 2分钟内的文件

    // 规范化文件名用于比较：移除所有格式代码和特殊字符
    function normalizeFileName(name: string): string {
      return name
        .toLowerCase()
        .replace(/\.\w{5,6}$/, '') // 移除格式代码
        .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '') // 移除特殊字符，保留字母、数字、中文
    }

    for (const [fname, stats] of fileStats.entries()) {
      const ext = path.extname(fname).toLowerCase()
      const nameWithoutExt = path.basename(fname, ext)
      const normalized = normalizeFileName(nameWithoutExt)

      // 只考虑最近创建的文件
      if (now - stats.mtime > recentThreshold) {
        continue
      }

      if (videoExtensions.includes(ext)) {
        console.log(`[AutoMerge] 发现视频文件: ${fname} -> ${normalized}`)
        videoFiles.push({ name: fname, path: path.join(videoDir, fname), mtime: stats.mtime, normalized })
      } else if (audioExtensions.includes(ext)) {
        console.log(`[AutoMerge] 发现音频文件: ${fname} -> ${normalized}`)
        audioFiles.push({ name: fname, path: path.join(videoDir, fname), mtime: stats.mtime, normalized })
      }
    }

    console.log('[AutoMerge] 找到的视频文件:', videoFiles)
    console.log('[AutoMerge] 找到的音频文件:', audioFiles)

    let videoFile: string | null = null
    let audioFile: string | null = null

    // 匹配策略：找文件名最相似的视频和音频对
    if (videoFiles.length > 0 && audioFiles.length > 0) {
      let bestMatch = { video: -1, audio: -1, score: 0 }

      for (let i = 0; i < videoFiles.length; i++) {
        for (let j = 0; j < audioFiles.length; j++) {
          const videoNorm = videoFiles[i].normalized
          const audioNorm = audioFiles[j].normalized

          // 计算相似度（使用最长公共子序列）
          let score = 0
          const longer = videoNorm.length > audioNorm.length ? videoNorm : audioNorm
          const shorter = videoNorm.length > audioNorm.length ? audioNorm : videoNorm

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

          console.log(`[AutoMerge] 匹配分数: 视频=${videoFiles[i].name}, 音频=${audioFiles[j].name}, 分数=${score}`)

          if (score > bestMatch.score) {
            bestMatch = { video: i, audio: j, score }
          }
        }
      }

      // 只有当相似度足够高时才合并
      if (bestMatch.score > 10 && bestMatch.video >= 0 && bestMatch.audio >= 0) {
        videoFile = videoFiles[bestMatch.video].path
        audioFile = audioFiles[bestMatch.audio].path
        console.log('[AutoMerge] 最佳匹配:', videoFiles[bestMatch.video].name, '+', audioFiles[bestMatch.audio].name)
      }
    }

    if (!videoFile || !audioFile) {
      showMessage('未发现分离的音视频文件，无需合并', 2000, 'info')
      console.log('[AutoMerge] 未找到匹配的音视频文件对')
      return
    }

    // 执行合并
    downloadStatus.value = '正在合并音视频...'
    mergeStatus.value = '合并中...'

    // 构建输出文件名（使用视频文件的基础部分）
    const videoFileName = path.basename(videoFile)
    const outputBaseName = path.basename(videoFileName, path.extname(videoFileName))
      .replace(/\.\w{5,6}$/, '') // 移除格式代码
    const outputFileName = `${outputBaseName}.${downloadFormat.value}`
    const outputPath = await buildVideoPath(outputFileName)

    console.log('[AutoMerge] 开始合并...')
    console.log('[AutoMerge] 视频路径:', videoFile)
    console.log('[AutoMerge] 音频路径:', audioFile)
    console.log('[AutoMerge] 输出路径:', outputPath)

    const mergeResult = await mergeVideoAudio({
      videoPath: videoFile.replace(`${workspacePath}/`, ''),
      audioPath: audioFile.replace(`${workspacePath}/`, ''),
      outputPath,
      onProgress: (progress) => {
        downloadProgressPercent.value = progress
      }
    })

    if (mergeResult.success) {
      downloadStatus.value = '合并完成！'
      mergeStatus.value = '合并成功'

      // 删除原始分离文件
      try {
        fs.unlinkSync(videoFile)
        fs.unlinkSync(audioFile)
        showMessage(`音视频合并成功！已保存为 ${outputFileName}`, 3000, 'info')
        console.log('[AutoMerge] 合并成功，已删除原始文件')
      } catch (e) {
        showMessage(`音视频合并成功！已保存为 ${outputFileName}（原始文件未删除）`, 3000, 'info')
        console.log('[AutoMerge] 合并成功，但删除原始文件失败:', e)
      }
    } else {
      showMessage(`音视频合并失败: ${mergeResult.error}`, 5000, 'error')
      console.log('[AutoMerge] 合并失败:', mergeResult.error)
    }
  } catch (error: any) {
    console.error('自动合并失败:', error)
    showMessage('自动合并失败: ' + error.message, 5000, 'error')
  } finally {
    mergeProgress.value = false
  }
}
</script>

<style scoped lang="scss">
@use "../index.scss";
</style>
