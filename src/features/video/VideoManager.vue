<template>
  <div class="video-manager-overlay" v-if="visible" @click="onClose">
    <div class="video-manager" @click.stop>
      <!-- 头部 -->
      <div class="video-header">
        <div class="header-left">
          <h2>视频管理器</h2>
          <span class="video-count" v-if="videos.length > 0">
            {{ filteredVideos.length }} / {{ videos.length }} 个视频
          </span>
        </div>
        <div class="header-right">
          <button class="icon-btn" @click="onClose" title="关闭">
            <svg class="icon"><use xlink:href="#iconClose"></use></svg>
          </button>
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
        @merge-videos="showMergeDialog"
        @merge-audio="showMergeAudioDialog"
        @compress="showCompressDialog"
        @ffmpeg-settings="showFFmpegPathDialog"
        @category-change="handleCategoryChange"
      />

      <!-- 视频列表 -->
      <div class="video-content">
        <div class="video-list" v-if="filteredVideos.length > 0">
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

        <div class="empty-state" v-else>
          <IconWrapper name="video" :size="64" class="empty-icon" />
          <p>暂无视频</p>
          <p class="empty-hint">请将视频文件放入 data/video 目录</p>
        </div>
      </div>
    </div>
  </div>

  <!-- 视频播放器对话框 -->
  <VideoPlayerDialog
    :visible="playerVisible"
    :video="currentVideo"
    :video-url="currentVideoUrl"
    title="视频播放"
    @close="closePlayer"
    @error="handlePlayerError"
  />

  <!-- 批量加密对话框 -->
  <div class="dialog-overlay" v-if="encryptDialogVisible" @click="closeEncryptDialog">
    <div class="dialog" @click.stop>
      <div class="dialog-header">
        <h3>🔒 批量加密视频</h3>
        <button class="icon-btn" @click="closeEncryptDialog" :disabled="encryptProgress">
          <svg class="icon"><use xlink:href="#iconClose"></use></svg>
        </button>
      </div>
      <div class="dialog-body">
        <div class="form-group">
          <label>待加密视频数量</label>
          <div class="file-info">{{ unencryptedCount }} 个未加密视频</div>
        </div>
        
        <div class="form-group">
          <label class="checkbox-label">
            <input 
              v-model="encryptDoubleCompress" 
              type="checkbox"
              :disabled="encryptProgress"
            />
            <span>双重压缩（更小体积，更慢速度）</span>
          </label>
          <div class="form-hint">
            单重压缩：生成 .sn 格式，速度快<br>
            双重压缩：生成 .sn2 格式，体积更小但速度较慢
          </div>
        </div>
        
        <div class="form-group" v-if="encryptProgress">
          <label>加密进度</label>
          <div class="progress-info">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: encryptProgressPercent + '%' }"></div>
            </div>
            <div class="progress-text">
              {{ encryptCurrentFile }} ({{ encryptCurrentIndex }}/{{ encryptTotalCount }})
            </div>
          </div>
        </div>
        
        <div class="form-group">
          <div class="encrypt-info">
            <div class="info-item">
              <span class="info-label">加密后格式：</span>
              <span class="info-value">{{ encryptDoubleCompress ? '.sn2' : '.sn' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">原文件处理：</span>
              <span class="info-value">加密后自动删除</span>
            </div>
          </div>
        </div>
      </div>
      <div class="dialog-footer">
        <button 
          class="btn" 
          @click="closeEncryptDialog"
          :disabled="encryptProgress"
        >
          取消
        </button>
        <button 
          class="btn btn-primary" 
          @click="handleBatchEncrypt"
          :disabled="encryptProgress"
        >
          {{ encryptProgress ? '加密中...' : '开始加密' }}
        </button>
      </div>
    </div>
  </div>
  
  <!-- 批量解密对话框 -->
  <div class="dialog-overlay" v-if="decryptDialogVisible" @click="closeDecryptDialog">
    <div class="dialog" @click.stop>
      <div class="dialog-header">
        <h3>🔓 批量解密视频</h3>
        <button class="icon-btn" @click="closeDecryptDialog" :disabled="decryptProgress">
          <svg class="icon"><use xlink:href="#iconClose"></use></svg>
        </button>
      </div>
      <div class="dialog-body">
        <div class="form-group">
          <label>待解密视频数量</label>
          <div class="file-info">{{ encryptedCount }} 个加密视频</div>
        </div>
        
        <div class="form-group" v-if="decryptProgress">
          <label>解密进度</label>
          <div class="progress-info">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: decryptProgressPercent + '%' }"></div>
            </div>
            <div class="progress-text">
              {{ decryptCurrentFile }} ({{ decryptCurrentIndex }}/{{ decryptTotalCount }})
            </div>
          </div>
        </div>
        
        <div class="form-group">
          <div class="encrypt-info">
            <div class="info-item">
              <span class="info-label">解密后格式：</span>
              <span class="info-value">原始视频格式（.mp4 等）</span>
            </div>
            <div class="info-item">
              <span class="info-label">加密文件处理：</span>
              <span class="info-value">解密后自动删除</span>
            </div>
            <div class="info-item">
              <span class="info-label">用途：</span>
              <span class="info-value">方便迁移到其他平台</span>
            </div>
          </div>
        </div>
      </div>
      <div class="dialog-footer">
        <button 
          class="btn" 
          @click="closeDecryptDialog"
          :disabled="decryptProgress"
        >
          取消
        </button>
        <button 
          class="btn btn-primary" 
          @click="handleBatchDecrypt"
          :disabled="decryptProgress"
        >
          {{ decryptProgress ? '解密中...' : '开始解密' }}
        </button>
      </div>
    </div>
  </div>

  <!-- 视频合并对话框 -->
  <div class="dialog-overlay" v-if="mergeDialogVisible" @click="closeMergeDialog">
    <div class="dialog" @click.stop>
      <div class="dialog-header">
        <h3>🎬 视频合并</h3>
        <button class="icon-btn" @click="closeMergeDialog" :disabled="mergeProgress">
          <svg class="icon"><use xlink:href="#iconClose"></use></svg>
        </button>
      </div>
      <div class="dialog-body">
        <div class="form-group">
          <label>选择要合并的视频（按顺序）</label>
          <div class="video-selector">
            <div
              v-for="(video, index) in mergeSelectedVideos"
              :key="index"
              class="selected-video-item"
            >
              <span class="video-index">{{ index + 1 }}</span>
              <span class="video-name" :title="video.name">{{ video.name }}</span>
              <button class="icon-btn" @click="removeMergeVideo(index)" title="移除">
                <svg class="icon"><use xlink:href="#iconClose"></use></svg>
              </button>
            </div>
            <div v-if="mergeSelectedVideos.length === 0" class="empty-selection">
              请选择视频文件
            </div>
          </div>
        </div>

        <div class="form-group">
          <label>可选视频列表</label>
          <div class="video-list-select">
            <div
              v-for="video in videos"
              :key="video.path"
              class="video-option"
              :class="{ selected: isVideoSelected(video) }"
              @click="toggleMergeVideo(video)"
            >
              <span class="video-name">{{ video.name }}</span>
              <span class="video-size">{{ formatFileSize(video.size) }}</span>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label>输出文件名</label>
          <input
            v-model="mergeOutputName"
            type="text"
            class="b3-text-field"
            placeholder="merged_video.mp4"
          />
        </div>

        <div class="form-group" v-if="mergeProgress">
          <label>合并进度</label>
          <div class="progress-info">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: mergeProgressPercent + '%' }"></div>
            </div>
            <div class="progress-text">
              {{ mergeProgressPercent }}%
            </div>
          </div>
        </div>

        <div class="form-group" v-if="mergeResult">
          <div class="encrypt-info">
            <div class="info-item">
              <span class="info-label">状态：</span>
              <span class="info-value" :style="{ color: mergeResult.success ? '#788c5d' : '#d97757' }">
                {{ mergeResult.success ? '✅ 合并成功' : '❌ 合并失败' }}
              </span>
            </div>
            <div class="info-item" v-if="mergeResult.outputPath">
              <span class="info-label">输出路径：</span>
              <span class="info-value">{{ mergeResult.outputPath }}</span>
            </div>
            <div class="info-item" v-if="mergeResult.error">
              <span class="info-label">错误信息：</span>
              <span class="info-value">{{ mergeResult.error }}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="dialog-footer">
        <button
          class="btn"
          @click="closeMergeDialog"
          :disabled="mergeProgress"
        >
          {{ mergeResult ? '关闭' : '取消' }}
        </button>
        <button
          class="btn btn-primary"
          @click="handleMergeVideos"
          :disabled="mergeProgress || mergeSelectedVideos.length < 2"
        >
          {{ mergeProgress ? '合并中...' : '开始合并' }}
        </button>
      </div>
    </div>
  </div>

  <!-- 视频音频合并对话框 -->
  <div class="dialog-overlay" v-if="mergeAudioDialogVisible" @click="closeMergeAudioDialog">
    <div class="dialog" @click.stop>
      <div class="dialog-header">
        <h3>🎵 视频音频合并</h3>
        <button class="icon-btn" @click="closeMergeAudioDialog" :disabled="mergeAudioProgress">
          <svg class="icon"><use xlink:href="#iconClose"></use></svg>
        </button>
      </div>
      <div class="dialog-body">
        <div class="form-group">
          <label>选择视频文件</label>
          <select v-model="selectedVideoForMerge" class="b3-select">
            <option value="">请选择视频...</option>
            <option
              v-for="video in videos"
              :key="video.path"
              :value="video.path"
            >
              {{ video.name }} ({{ formatFileSize(video.size) }})
            </option>
          </select>
        </div>

        <div class="form-group">
          <label>选择音频文件</label>
          <select v-model="selectedAudioForMerge" class="b3-select">
            <option value="">请选择音频...</option>
            <option
              v-for="audio in audioFiles"
              :key="audio.path"
              :value="audio.path"
            >
              {{ audio.name }} ({{ formatFileSize(audio.size) }})
            </option>
          </select>
        </div>

        <div class="form-group">
          <label>输出文件名</label>
          <input
            v-model="mergeAudioOutputName"
            type="text"
            class="b3-text-field"
            placeholder="video_with_audio.mp4"
          />
        </div>

        <div class="form-group" v-if="mergeAudioProgress">
          <label>合并进度</label>
          <div class="progress-info">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: mergeAudioProgressPercent + '%' }"></div>
            </div>
            <div class="progress-text">
              {{ mergeAudioProgressPercent }}%
            </div>
          </div>
        </div>

        <div class="form-group" v-if="mergeAudioResult">
          <div class="encrypt-info">
            <div class="info-item">
              <span class="info-label">状态：</span>
              <span class="info-value" :style="{ color: mergeAudioResult.success ? '#788c5d' : '#d97757' }">
                {{ mergeAudioResult.success ? '✅ 合并成功' : '❌ 合并失败' }}
              </span>
            </div>
            <div class="info-item" v-if="mergeAudioResult.outputPath">
              <span class="info-label">输出路径：</span>
              <span class="info-value">{{ mergeAudioResult.outputPath }}</span>
            </div>
            <div class="info-item" v-if="mergeAudioResult.error">
              <span class="info-label">错误信息：</span>
              <span class="info-value">{{ mergeAudioResult.error }}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="dialog-footer">
        <button
          class="btn"
          @click="closeMergeAudioDialog"
          :disabled="mergeAudioProgress"
        >
          {{ mergeAudioResult ? '关闭' : '取消' }}
        </button>
        <button
          class="btn btn-primary"
          @click="handleMergeVideoAudio"
          :disabled="mergeAudioProgress || !selectedVideoForMerge || !selectedAudioForMerge"
        >
          {{ mergeAudioProgress ? '合并中...' : '开始合并' }}
        </button>
      </div>
    </div>
  </div>

  <!-- 视频压缩对话框 -->
  <div class="dialog-overlay" v-if="compressDialogVisible" @click="closeCompressDialog">
    <div class="dialog" @click.stop>
      <div class="dialog-header">
        <h3>🗜️ 视频压缩</h3>
        <button class="icon-btn" @click="closeCompressDialog" :disabled="compressProgress">
          <svg class="icon"><use xlink:href="#iconClose"></use></svg>
        </button>
      </div>
      <div class="dialog-body">
        <div class="form-group">
          <label>选择要压缩的视频</label>
          <select v-model="selectedVideoForCompress" class="b3-select">
            <option value="">请选择视频...</option>
            <option
              v-for="video in videos"
              :key="video.path"
              :value="video.path"
            >
              {{ video.name }} ({{ formatFileSize(video.size) }})
            </option>
          </select>
        </div>

        <div class="form-group">
          <label>压缩模式</label>
          <div class="compress-mode-selector">
            <label class="radio-label">
              <input type="radio" v-model="compressMode" value="crf" />
              <span>CRF 质量模式（推荐）</span>
            </label>
            <label class="radio-label">
              <input type="radio" v-model="compressMode" value="bitrate" />
              <span>比特率模式</span>
            </label>
          </div>
        </div>

        <div class="form-group" v-if="compressMode === 'crf'">
          <label>CRF 值（越小质量越好，推荐 23-28）</label>
          <input
            v-model.number="compressCRF"
            type="number"
            class="b3-text-field"
            min="18"
            max="51"
            step="1"
          />
          <div class="form-hint">
            18-23: 高质量（文件较大）<br>
            23-28: 平衡（推荐）<br>
            28-51: 高压缩（文件较小）
          </div>
        </div>

        <div class="form-group" v-if="compressMode === 'bitrate'">
          <label>目标比特率</label>
          <input
            v-model="compressBitrate"
            type="text"
            class="b3-text-field"
            placeholder="1000k"
          />
          <div class="form-hint">
            例如：500k, 1000k, 2000k, 5M
          </div>
        </div>

        <div class="form-group">
          <label>输出文件名</label>
          <input
            v-model="compressOutputName"
            type="text"
            class="b3-text-field"
            placeholder="compressed_video.mp4"
          />
        </div>

        <div class="form-group" v-if="selectedVideoForCompress">
          <div class="encrypt-info">
            <div class="info-item">
              <span class="info-label">原始大小：</span>
              <span class="info-value">{{ formatFileSize(getVideoSize(selectedVideoForCompress)) }}</span>
            </div>
          </div>
        </div>

        <div class="form-group" v-if="compressProgress">
          <label>压缩进度</label>
          <div class="progress-info">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: compressProgressPercent + '%' }"></div>
            </div>
            <div class="progress-text">
              {{ compressProgressPercent }}%
            </div>
          </div>
        </div>

        <div class="form-group" v-if="compressResult">
          <div class="encrypt-info">
            <div class="info-item">
              <span class="info-label">状态：</span>
              <span class="info-value" :style="{ color: compressResult.success ? '#788c5d' : '#d97757' }">
                {{ compressResult.success ? '✅ 压缩成功' : '❌ 压缩失败' }}
              </span>
            </div>
            <div class="info-item" v-if="compressResult.outputPath">
              <span class="info-label">输出路径：</span>
              <span class="info-value">{{ compressResult.outputPath }}</span>
            </div>
            <div class="info-item" v-if="compressOriginalSize && compressResult.success">
              <span class="info-label">原始大小：</span>
              <span class="info-value">{{ formatFileSize(compressOriginalSize) }}</span>
            </div>
            <div class="info-item" v-if="compressNewSize && compressResult.success">
              <span class="info-label">压缩后：</span>
              <span class="info-value">{{ formatFileSize(compressNewSize) }}</span>
            </div>
            <div class="info-item" v-if="compressNewSize && compressResult.success">
              <span class="info-label">压缩率：</span>
              <span class="info-value">{{ calculateCompressionRate(compressOriginalSize, compressNewSize) }}</span>
            </div>
            <div class="info-item" v-if="compressResult.error">
              <span class="info-label">错误信息：</span>
              <span class="info-value">{{ compressResult.error }}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="dialog-footer">
        <button
          class="btn"
          @click="closeCompressDialog"
          :disabled="compressProgress"
        >
          {{ compressResult ? '关闭' : '取消' }}
        </button>
        <button
          class="btn btn-primary"
          @click="handleCompressVideo"
          :disabled="compressProgress || !selectedVideoForCompress"
        >
          {{ compressProgress ? '压缩中...' : '开始压缩' }}
        </button>
      </div>
    </div>
  </div>

  <!-- FFmpeg 路径设置对话框 -->
  <div class="dialog-overlay" v-if="ffmpegPathDialogVisible" @click="closeFFmpegPathDialog">
    <div class="dialog" @click.stop>
      <div class="dialog-header">
        <h3>⚙️ FFmpeg 路径设置</h3>
        <button class="icon-btn" @click="closeFFmpegPathDialog">
          <svg class="icon"><use xlink:href="#iconClose"></use></svg>
        </button>
      </div>
      <div class="dialog-body">
        <div class="form-group">
          <label>当前 FFmpeg 路径</label>
          <div class="file-info" :title="currentFFmpegPath">
            {{ currentFFmpegPath }}
          </div>
          <div class="form-hint">
            系统自动检测到的 FFmpeg 路径
          </div>
        </div>

        <div class="form-group">
          <label>自定义 FFmpeg 路径</label>
          <input
            v-model="customFFmpegPath"
            type="text"
            class="b3-text-field"
            placeholder="例如：E:\\Program\\ffmpeg-8.0.1-essentials_build\\bin\\ffmpeg.exe"
          />
          <div class="form-hint">
            请输入 FFmpeg 可执行文件的完整路径（包含 ffmpeg.exe）
          </div>
        </div>

        <div class="form-group" v-if="ffmpegTestResult">
          <label>测试结果</label>
          <div class="encrypt-info">
            <div class="info-item">
              <span class="info-label">状态：</span>
              <span class="info-value" :style="{ color: ffmpegTestResult === 'success' ? '#788c5d' : '#d97757' }">
                {{ ffmpegTestResult === 'success' ? '✅ 路径有效' : '❌ 路径无效' }}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div class="dialog-footer">
        <button class="btn" @click="resetFFmpegPath">
          重置
        </button>
        <button class="btn" @click="testFFmpegPath">
          测试路径
        </button>
        <button class="btn btn-primary" @click="saveFFmpegPath">
          保存
        </button>
      </div>
    </div>
  </div>

</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { showMessage } from 'siyuan'
import IconWrapper from '@/components/IconWrapper.vue'
import VideoPlayerDialog from './components/VideoPlayerDialog.vue'
import VideoListItem from './components/VideoListItem.vue'
import VideoToolbar from './components/VideoToolbar.vue'
import {
  getVideoCategories,
  getVideoList,
  getVideoUrl,
  getVideoStoragePath,
  encryptAllVideos,
  decryptAllVideos,
  decryptVideoFile
} from './index'
import { isEncryptedVideo } from './crypto'
import {
  isFFmpegAvailable,
  mergeVideos,
  mergeVideoAudio,
  compressVideo,
  buildVideoPath,
  setFFmpegPath,
  getCurrentFFmpegPath,
  clearFFmpegPath
} from './ffmpeg'
import { usePlugin } from '@/main'

const plugin = usePlugin()

// Props
const props = defineProps<{
  visible: boolean
}>()

// Emits
const emit = defineEmits<{
  close: []
}>()

// 响应式数据
const videos = ref<any[]>([])
const categories = ref<string[]>([])
const selectedCategory = ref('')
const playerVisible = ref(false)
const currentVideo = ref<any>(null)
const currentVideoUrl = ref('')
const storagePath = ref('data/video')
const encryptDialogVisible = ref(false)
const encryptDoubleCompress = ref(false)
const encryptProgress = ref(false)
const encryptCurrentIndex = ref(0)
const encryptTotalCount = ref(0)
const encryptCurrentFile = ref('')
const decryptDialogVisible = ref(false)
const decryptProgress = ref(false)
const decryptCurrentIndex = ref(0)
const decryptTotalCount = ref(0)
const decryptCurrentFile = ref('')

// FFmpeg 相关响应式数据
const hasFFmpeg = ref(false)
const mergeDialogVisible = ref(false)
const mergeSelectedVideos = ref<any[]>([])
const mergeOutputName = ref('merged_video.mp4')
const mergeProgress = ref(false)
const mergeProgressPercent = ref(0)
const mergeResult = ref<{ success: boolean; outputPath?: string; error?: string } | null>(null)

const mergeAudioDialogVisible = ref(false)
const selectedVideoForMerge = ref('')
const selectedAudioForMerge = ref('')
const audioFiles = ref<any[]>([])
const mergeAudioOutputName = ref('video_with_audio.mp4')
const mergeAudioProgress = ref(false)
const mergeAudioProgressPercent = ref(0)
const mergeAudioResult = ref<{ success: boolean; outputPath?: string; error?: string } | null>(null)

const compressDialogVisible = ref(false)
const selectedVideoForCompress = ref('')
const compressMode = ref<'crf' | 'bitrate'>('crf')
const compressCRF = ref(23)
const compressBitrate = ref('1000k')
const compressOutputName = ref('compressed_video.mp4')
const compressProgress = ref(false)
const compressProgressPercent = ref(0)
const compressResult = ref<{ success: boolean; outputPath?: string; error?: string } | null>(null)
const compressOriginalSize = ref(0)
const compressNewSize = ref(0)

// FFmpeg 路径设置
const ffmpegPathDialogVisible = ref(false)
const customFFmpegPath = ref('')
const currentFFmpegPath = ref('')
const ffmpegTestResult = ref<'success' | 'failed' | null>(null)

// 计算属性
const filteredVideos = computed(() => {
  if (!selectedCategory.value) return videos.value
  return videos.value.filter(video => video.category === selectedCategory.value)
})

const unencryptedCount = computed(() => {
  return videos.value.filter(v => !isEncryptedVideo(v.name)).length
})

const hasUnencryptedVideos = computed(() => {
  return unencryptedCount.value > 0
})

const encryptedCount = computed(() => {
  return videos.value.filter(v => isEncryptedVideo(v.name)).length
})

const hasEncryptedVideos = computed(() => {
  return encryptedCount.value > 0
})

const encryptProgressPercent = computed(() => {
  if (encryptTotalCount.value === 0) return 0
  return Math.round((encryptCurrentIndex.value / encryptTotalCount.value) * 100)
})

const decryptProgressPercent = computed(() => {
  if (decryptTotalCount.value === 0) return 0
  return Math.round((decryptCurrentIndex.value / decryptTotalCount.value) * 100)
})

// 监听 visible 变化，自动刷新列表
watch(() => props.visible, async (newVal) => {
  if (newVal) {
    await loadVideos()
    await loadCategories()
  }
})

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
  emit('close')
}

async function loadCategories() {
  categories.value = await getVideoCategories(plugin)
}

async function loadVideos() {
  videos.value = await getVideoList(plugin)
  console.log('已加载视频列表:', videos.value.length, '个')
}

async function refreshList() {
  showMessage('正在扫描视频文件...', 0, 'info')
  await loadVideos()
  await loadCategories()
  showMessage(`扫描完成，找到 ${videos.value.length} 个视频`, 2000, 'info')
}

async function openVideoFolder() {
  showMessage(`视频文件夹: ${storagePath.value}`, 3000, 'info')
  
  // 如果是桌面端，尝试打开文件夹
  if (window.require) {
    try {
      const { shell } = window.require('electron')
      
      // 获取工作空间路径
      const response = await fetch('/api/system/getConf', {
        method: 'POST'
      })
      
      if (response.ok) {
        const data = await response.json()
        const workspacePath = data?.data?.conf?.system?.workspaceDir
        
        if (workspacePath) {
          const fullPath = `${workspacePath}/${storagePath.value}`
          const result = await shell.openPath(fullPath)
          
          if (result) {
            console.error('打开文件夹失败:', result)
            showMessage(`无法打开文件夹: ${result}`, 3000, 'error')
          } else {
            showMessage('已打开视频文件夹', 2000, 'info')
          }
        } else {
          showMessage('无法获取工作空间路径', 2000, 'error')
        }
      }
    } catch (error) {
      console.error('打开文件夹失败:', error)
      showMessage('打开文件夹失败', 2000, 'error')
    }
  } else {
    showMessage('当前环境不支持打开文件夹', 2000, 'error')
  }
}

async function playVideo(video: any) {
  try {
    currentVideo.value = video
    // 自动解密播放
    currentVideoUrl.value = await getVideoUrl(video.path)

    if (currentVideoUrl.value) {
      console.log('播放视频:', video.name)
      playerVisible.value = true
    } else {
      showMessage('视频加载失败', 3000, 'error')
    }
  } catch (error) {
    console.error('播放视频失败:', error)
    showMessage('视频播放失败: ' + (error as Error).message, 3000, 'error')
  }
}

function closePlayer() {
  // 释放 Blob URL 以避免内存泄漏
  if (currentVideoUrl.value && currentVideoUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(currentVideoUrl.value)
  }

  currentVideo.value = null
  currentVideoUrl.value = ''
  playerVisible.value = false
}

// 处理播放器错误
function handlePlayerError(error: any) {
  console.error('Video player error:', error)
  showMessage('视频播放出错', 3000, 'error')
}

// 处理分类变化
function handleCategoryChange(category: string) {
  selectedCategory.value = category
}

function formatFileSize(bytes?: number) {
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

function showBatchEncryptDialog() {
  if (unencryptedCount.value === 0) {
    showMessage('没有需要加密的视频', 2000, 'info')
    return
  }
  encryptDoubleCompress.value = false
  encryptProgress.value = false
  encryptDialogVisible.value = true
}

function closeEncryptDialog() {
  if (encryptProgress.value) {
    showMessage('加密进行中，请稍候...', 2000, 'info')
    return
  }
  encryptDialogVisible.value = false
}

async function handleBatchEncrypt() {
  encryptProgress.value = true
  encryptCurrentIndex.value = 0
  encryptTotalCount.value = unencryptedCount.value
  encryptCurrentFile.value = ''

  try {
    const result = await encryptAllVideos(
      plugin,
      encryptDoubleCompress.value,
      (current, total, fileName) => {
        encryptCurrentIndex.value = current
        encryptTotalCount.value = total
        encryptCurrentFile.value = fileName
      }
    )

    showMessage(
      `加密完成！成功: ${result.success} 个，失败: ${result.failed} 个`,
      5000,
      result.failed > 0 ? 'error' : 'info'
    )

    if (result.errors.length > 0) {
      console.error('加密错误:', result.errors)
    }

    // 刷新列表
    await loadVideos()
    await loadCategories()

    closeEncryptDialog()
  } catch (error) {
    console.error('批量加密失败:', error)
    showMessage('批量加密失败: ' + (error as Error).message, 3000, 'error')
  } finally {
    encryptProgress.value = false
  }
}

function showBatchDecryptDialog() {
  if (encryptedCount.value === 0) {
    showMessage('没有需要解密的视频', 2000, 'info')
    return
  }
  decryptProgress.value = false
  decryptDialogVisible.value = true
}

function closeDecryptDialog() {
  if (decryptProgress.value) {
    showMessage('解密进行中，请稍候...', 2000, 'info')
    return
  }
  decryptDialogVisible.value = false
}

async function handleBatchDecrypt() {
  decryptProgress.value = true
  decryptCurrentIndex.value = 0
  decryptTotalCount.value = encryptedCount.value
  decryptCurrentFile.value = ''
  
  try {
    const result = await decryptAllVideos(
      plugin,
      (current, total, fileName) => {
        decryptCurrentIndex.value = current
        decryptTotalCount.value = total
        decryptCurrentFile.value = fileName
      }
    )
    
    showMessage(
      `解密完成！成功: ${result.success} 个，失败: ${result.failed} 个`,
      5000,
      result.failed > 0 ? 'error' : 'info'
    )
    
    if (result.errors.length > 0) {
      console.error('解密错误:', result.errors)
    }
    
    // 刷新列表
    await loadVideos()
    await loadCategories()
    
    closeDecryptDialog()
  } catch (error) {
    console.error('批量解密失败:', error)
    showMessage('批量解密失败: ' + (error as Error).message, 3000, 'error')
  } finally {
    decryptProgress.value = false
  }
}

async function handleSingleDecrypt(video: any) {
  try {
    showMessage(`正在解密: ${video.name}`, 0, 'info')

    await decryptVideoFile(video.path)

    showMessage(`解密成功: ${video.name}`, 3000, 'info')

    // 刷新列表
    await loadVideos()
    await loadCategories()
  } catch (error) {
    console.error('解密失败:', error)
    showMessage(`解密失败: ${(error as Error).message}`, 3000, 'error')
  }
}

// ==================== FFmpeg 视频处理方法 ====================

// 视频合并相关方法
function showMergeDialog() {
  if (!hasFFmpeg.value) {
    showMessage('FFmpeg 未安装，无法使用视频合并功能', 3000, 'error')
    return
  }
  mergeSelectedVideos.value = []
  mergeOutputName.value = 'merged_video.mp4'
  mergeProgress.value = false
  mergeProgressPercent.value = 0
  mergeResult.value = null
  mergeDialogVisible.value = true
}

function closeMergeDialog() {
  if (mergeProgress.value) {
    showMessage('合并进行中，请稍候...', 2000, 'info')
    return
  }
  mergeDialogVisible.value = false
}

function isVideoSelected(video: any): boolean {
  return mergeSelectedVideos.value.some(v => v.path === video.path)
}

function toggleMergeVideo(video: any) {
  const index = mergeSelectedVideos.value.findIndex(v => v.path === video.path)
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
    showMessage('请至少选择2个视频进行合并', 2000, 'error')
    return
  }

  mergeProgress.value = true
  mergeProgressPercent.value = 0
  mergeResult.value = null

  try {
    const videoPaths = mergeSelectedVideos.value.map(v => v.path)
    const outputPath = await buildVideoPath(mergeOutputName.value)

    const result = await mergeVideos({
      videoPaths,
      outputPath,
      onProgress: (progress) => {
        mergeProgressPercent.value = progress
      }
    })

    if (result.success) {
      showMessage('视频合并成功！', 3000, 'info')
      mergeResult.value = {
        success: true,
        outputPath: mergeOutputName.value
      }
      // 刷新列表
      await loadVideos()
      await loadCategories()
    } else {
      showMessage('视频合并失败: ' + result.error, 5000, 'error')
      mergeResult.value = {
        success: false,
        error: result.error
      }
    }
  } catch (error: any) {
    console.error('视频合并失败:', error)
    showMessage('视频合并失败: ' + error.message, 5000, 'error')
    mergeResult.value = {
      success: false,
      error: error.message
    }
  } finally {
    mergeProgress.value = false
  }
}

// 视频音频合并相关方法
function showMergeAudioDialog() {
  if (!hasFFmpeg.value) {
    showMessage('FFmpeg 未安装，无法使用视频音频合并功能', 3000, 'error')
    return
  }

  // 加载音频文件
  loadAudioFiles()

  selectedVideoForMerge.value = ''
  selectedAudioForMerge.value = ''
  mergeAudioOutputName.value = 'video_with_audio.mp4'
  mergeAudioProgress.value = false
  mergeAudioProgressPercent.value = 0
  mergeAudioResult.value = null
  mergeAudioDialogVisible.value = true
}

function closeMergeAudioDialog() {
  if (mergeAudioProgress.value) {
    showMessage('合并进行中，请稍候...', 2000, 'info')
    return
  }
  mergeAudioDialogVisible.value = false
}

async function loadAudioFiles() {
  try {
    const response = await fetch('/api/file/readDir', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: 'data/video'
      })
    })

    const result = await response.json()

    if (result.code === 0 && result.data) {
      const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac']
      audioFiles.value = result.data
        .filter((item: any) => !item.isDir && audioExtensions.some(ext => item.name.toLowerCase().endsWith(ext)))
        .map((item: any) => ({
          name: item.name,
          path: `data/video/${item.name}`,
          size: 0 // 暂时设为0，后续可以获取实际大小
        }))
    }
  } catch (error) {
    console.error('加载音频文件失败:', error)
    audioFiles.value = []
  }
}

async function handleMergeVideoAudio() {
  if (!selectedVideoForMerge.value || !selectedAudioForMerge.value) {
    showMessage('请选择视频和音频文件', 2000, 'error')
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
      }
    })

    if (result.success) {
      showMessage('视频音频合并成功！', 3000, 'info')
      mergeAudioResult.value = {
        success: true,
        outputPath: mergeAudioOutputName.value
      }
      // 刷新列表
      await loadVideos()
      await loadCategories()
    } else {
      showMessage('视频音频合并失败: ' + result.error, 5000, 'error')
      mergeAudioResult.value = {
        success: false,
        error: result.error
      }
    }
  } catch (error: any) {
    console.error('视频音频合并失败:', error)
    showMessage('视频音频合并失败: ' + error.message, 5000, 'error')
    mergeAudioResult.value = {
      success: false,
      error: error.message
    }
  } finally {
    mergeAudioProgress.value = false
  }
}

// 视频压缩相关方法
function showCompressDialog() {
  if (!hasFFmpeg.value) {
    showMessage('FFmpeg 未安装，无法使用视频压缩功能', 3000, 'error')
    return
  }

  selectedVideoForCompress.value = ''
  compressMode.value = 'crf'
  compressCRF.value = 23
  compressBitrate.value = '1000k'
  compressOutputName.value = 'compressed_video.mp4'
  compressProgress.value = false
  compressProgressPercent.value = 0
  compressResult.value = null
  compressOriginalSize.value = 0
  compressNewSize.value = 0
  compressDialogVisible.value = true
}

function closeCompressDialog() {
  if (compressProgress.value) {
    showMessage('压缩进行中，请稍候...', 2000, 'info')
    return
  }
  compressDialogVisible.value = false
}

function getVideoSize(videoPath: string): number {
  const video = videos.value.find(v => v.path === videoPath)
  return video ? video.size : 0
}

async function handleCompressVideo() {
  if (!selectedVideoForCompress.value) {
    showMessage('请选择要压缩的视频', 2000, 'error')
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
      }
    }

    if (compressMode.value === 'crf') {
      params.crf = compressCRF.value
    } else {
      params.bitrate = compressBitrate.value
    }

    const result = await compressVideo(params)

    if (result.success) {
      // 获取压缩后的文件大小
      try {
        const fs = (window as any).require('fs')
        const stats = fs.statSync(outputPath)
        compressNewSize.value = stats.size
      } catch (e) {
        console.error('获取压缩后文件大小失败:', e)
      }

      showMessage('视频压缩成功！', 3000, 'info')
      compressResult.value = {
        success: true,
        outputPath: compressOutputName.value
      }
      // 刷新列表
      await loadVideos()
      await loadCategories()
    } else {
      showMessage('视频压缩失败: ' + result.error, 5000, 'error')
      compressResult.value = {
        success: false,
        error: result.error
      }
    }
  } catch (error: any) {
    console.error('视频压缩失败:', error)
    showMessage('视频压缩失败: ' + error.message, 5000, 'error')
    compressResult.value = {
      success: false,
      error: error.message
    }
  } finally {
    compressProgress.value = false
  }
}

// 使用 ffmpeg.ts 中的函数
function calculateCompressionRate(originalSize: number, compressedSize: number): string {
  if (originalSize === 0) return '0%'
  const rate = ((originalSize - compressedSize) / originalSize) * 100
  return rate.toFixed(1) + '%'
}

// FFmpeg 路径设置相关方法
function showFFmpegPathDialog() {
  // 获取当前路径
  currentFFmpegPath.value = getCurrentFFmpegPath()
  customFFmpegPath.value = ''
  ffmpegTestResult.value = null
  ffmpegPathDialogVisible.value = true
}

function closeFFmpegPathDialog() {
  ffmpegPathDialogVisible.value = false
}

async function testFFmpegPath() {
  if (!customFFmpegPath.value) {
    showMessage('请输入 FFmpeg 路径', 2000, 'error')
    return
  }

  try {
    const fs = (window as any).require('fs')
    if (fs.existsSync(customFFmpegPath.value)) {
      ffmpegTestResult.value = 'success'
      showMessage('FFmpeg 路径有效！', 2000, 'info')
    } else {
      ffmpegTestResult.value = 'failed'
      showMessage('FFmpeg 路径不存在', 2000, 'error')
    }
  } catch (error) {
    ffmpegTestResult.value = 'failed'
    showMessage('测试失败: ' + (error as Error).message, 2000, 'error')
  }
}

function saveFFmpegPath() {
  if (!customFFmpegPath.value) {
    showMessage('请输入 FFmpeg 路径', 2000, 'error')
    return
  }

  const success = setFFmpegPath(customFFmpegPath.value)
  if (success) {
    showMessage('FFmpeg 路径已保存！', 2000, 'info')
    currentFFmpegPath.value = getCurrentFFmpegPath()
    hasFFmpeg.value = isFFmpegAvailable()
    closeFFmpegPathDialog()
  } else {
    showMessage('保存失败：路径不存在', 2000, 'error')
  }
}

function resetFFmpegPath() {
  clearFFmpegPath()
  currentFFmpegPath.value = getCurrentFFmpegPath()
  hasFFmpeg.value = isFFmpegAvailable()
  showMessage('已重置为默认路径', 2000, 'info')
}

</script>

<style scoped lang="scss">
@use "./index.scss";
</style>
