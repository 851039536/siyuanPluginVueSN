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
const downloadProgress = ref(false)
const downloadProgressPercent = ref(0)
const downloadStatus = ref('')
const downloadResult = ref<YtdlpResult | null>(null)
const currentYtdlpPath = ref('')
const ytdlpTestResult = ref<'success' | 'failed' | null>(null)

// 监听 visible 变化，初始化路径
watch(() => props.visible, (newVal) => {
  if (newVal) {
    currentYtdlpPath.value = getCurrentYtdlpPath()
    ytdlpTestResult.value = null
    downloadUrl.value = ''
    downloadQuality.value = 'best'
    downloadFormat.value = 'mp4'
    downloadSubtitle.value = false
    downloadProgress.value = false
    downloadProgressPercent.value = 0
    downloadStatus.value = ''
    downloadResult.value = null
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

  downloadProgress.value = true
  downloadProgressPercent.value = 0
  downloadStatus.value = '准备下载...'
  downloadResult.value = null

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
  }
}
</script>

<style scoped lang="scss">
@use "../index.scss";
</style>
