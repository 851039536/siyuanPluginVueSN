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
      <div class="video-toolbar">
        <button class="btn btn-primary" @click="refreshList">
          <svg class="icon"><use xlink:href="#iconRefresh"></use></svg>
          刷新列表
        </button>
        <button class="btn" @click="openVideoFolder">
          <svg class="icon"><use xlink:href="#iconFolder"></use></svg>
          打开文件夹
        </button>
        <button class="btn btn-encrypt" @click="showBatchEncryptDialog" v-if="hasUnencryptedVideos">
          <svg class="icon"><use xlink:href="#iconLock"></use></svg>
          批量加密
        </button>
        <button class="btn btn-decrypt" @click="showBatchDecryptDialog" v-if="hasEncryptedVideos">
          <svg class="icon"><use xlink:href="#iconUnlock"></use></svg>
          批量解密
        </button>
        
        <!-- 分类筛选 -->
        <div class="category-filter">
          <label>分类:</label>
          <select v-model="selectedCategory" class="b3-select">
            <option value="">全部</option>
            <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
          </select>
        </div>
        
        <div class="toolbar-spacer"></div>
        
        <span class="toolbar-hint">自动扫描 data/video 目录及子文件夹</span>
      </div>
      
      <!-- 视频列表 -->
      <div class="video-content">
        <div class="video-list" v-if="filteredVideos.length > 0">
          <div class="video-grid">
            <div 
              v-for="video in filteredVideos" 
              :key="video.path" 
              class="video-item"
              @click="playVideo(video)"
            >
              <div class="video-thumbnail">
                <div class="video-icon">
                  <svg class="icon"><use xlink:href="#iconVideo"></use></svg>
                </div>
                <div class="video-info">
                  <span class="video-name" :title="video.name">{{ video.name }}</span>
                  <span class="video-size">{{ formatFileSize(video.size) }}</span>
                </div>
              </div>
              <div class="video-actions">
                <span class="video-category">{{ video.category }}</span>
                <div class="action-buttons">
                  <button class="icon-btn" @click.stop="playVideo(video)" title="播放">
                    <svg class="icon"><use xlink:href="#iconPlay"></use></svg>
                  </button>
                  <template v-if="isEncryptedVideo(video.name)">
                    <button class="icon-btn" @click.stop="handleSingleDecrypt(video)" title="解密">
                      <svg class="icon"><use xlink:href="#iconUnlock"></use></svg>
                    </button>
                    <span class="encrypted-badge" :title="getEncryptionType(video.name)">
                      {{ getEncryptionIcon(video.name) }}
                    </span>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="empty-state" v-else>
          <svg class="empty-icon"><use xlink:href="#iconVideo"></use></svg>
          <p>暂无视频</p>
          <p class="empty-hint">请将视频文件放入 data/video 目录</p>
        </div>
      </div>
    </div>
  </div>
  
  <!-- 视频播放器 -->
  <div class="dialog-overlay" v-if="playerVisible" @click="closePlayer">
    <div class="dialog dialog-large" @click.stop>
      <div class="dialog-header">
        <h3>视频播放</h3>
        <button class="icon-btn" @click="closePlayer">
          <svg class="icon"><use xlink:href="#iconClose"></use></svg>
        </button>
      </div>
      <div class="dialog-body">
        <div class="video-player-container">
          <video 
            ref="videoPlayer" 
            class="video-js vjs-default-skin vjs-big-play-centered"
          >
            您的浏览器不支持视频播放
          </video>
          <div class="video-details">
            <h4>{{ currentVideo?.name }}</h4>
            <div class="video-meta">
              <span class="video-category">{{ currentVideo?.category }}</span>
              <span>{{ formatFileSize(currentVideo?.size) }}</span>
              <span>{{ formatDate(currentVideo?.modTime) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
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
  
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch, onBeforeUnmount } from 'vue'
import { showMessage } from 'siyuan'
import videojs from 'video.js'
import type Player from 'video.js/dist/types/player'
import 'video.js/dist/video-js.css'
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
const videoPlayer = ref<HTMLVideoElement>()
let player: Player | null = null
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
})

onBeforeUnmount(() => {
  if (player) {
    player.dispose()
    player = null
  }
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
      
      // 等待 DOM 更新后初始化 video.js
      await new Promise(resolve => setTimeout(resolve, 100))
      initVideoPlayer()
    } else {
      showMessage('视频加载失败', 3000, 'error')
    }
  } catch (error) {
    console.error('播放视频失败:', error)
    showMessage('视频播放失败: ' + (error as Error).message, 3000, 'error')
  }
}

function initVideoPlayer() {
  if (!videoPlayer.value) return
  
  // 销毁旧的播放器实例
  if (player) {
    player.dispose()
    player = null
  }
  
  // 初始化 video.js 播放器
  player = videojs(videoPlayer.value, {
    controls: true,
    autoplay: false,
    preload: 'auto',
    fluid: false,
    width: 800,
    height: 450,
    playbackRates: [0.5, 1, 1.5, 2],
    controlBar: {
      children: [
        'playToggle',
        'volumePanel',
        'currentTimeDisplay',
        'timeDivider',
        'durationDisplay',
        'progressControl',
        'playbackRateMenuButton',
        'pictureInPictureToggle',
        'fullscreenToggle'
      ]
    }
  })
  
  // 设置视频源
  player.src({
    src: currentVideoUrl.value,
    type: 'video/mp4'
  })
}

function closePlayer() {
  // 销毁播放器
  if (player) {
    player.dispose()
    player = null
  }
  
  // 释放 Blob URL 以避免内存泄漏
  if (currentVideoUrl.value && currentVideoUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(currentVideoUrl.value)
  }
  
  currentVideo.value = null
  currentVideoUrl.value = ''
  playerVisible.value = false
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

function formatDate(timestamp?: number) {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleDateString()
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

function getEncryptionType(fileName: string): string {
  if (fileName.toLowerCase().endsWith('.sn2')) {
    return '双重压缩加密'
  }
  if (fileName.toLowerCase().endsWith('.sn')) {
    return '单重压缩加密'
  }
  return ''
}

function getEncryptionIcon(fileName: string): string {
  if (fileName.toLowerCase().endsWith('.sn2')) {
    return '🔒🔒'
  }
  return '🔒'
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

</script>

<style scoped lang="scss">
@use "./index.scss";
</style>
