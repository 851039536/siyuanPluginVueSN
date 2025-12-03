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
  getVideoStoragePath
} from './index'
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

// 计算属性
const filteredVideos = computed(() => {
  if (!selectedCategory.value) return videos.value
  return videos.value.filter(video => video.category === selectedCategory.value)
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
  currentVideo.value = video
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

</script>

<style scoped lang="scss">
@import "./index.scss";
</style>
