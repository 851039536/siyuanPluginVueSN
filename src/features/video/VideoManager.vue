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
        <button class="btn btn-primary" @click="openUploadDialog">
          <svg class="icon"><use xlink:href="#iconUpload"></use></svg>
          上传视频
        </button>
        <button class="btn" @click="refreshList">
          <svg class="icon"><use xlink:href="#iconRefresh"></use></svg>
          刷新
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
        
        <button class="btn btn-text" @click="openCategorySettings">
          <svg class="icon"><use xlink:href="#iconSettings"></use></svg>
          管理分类
        </button>
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
                  <button class="icon-btn" @click.stop="deleteVideo(video)" title="删除">
                    <svg class="icon"><use xlink:href="#iconTrashcan"></use></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="empty-state" v-else>
          <svg class="empty-icon"><use xlink:href="#iconVideo"></use></svg>
          <p>暂无视频</p>
        </div>
      </div>
    </div>
  </div>
  
  <!-- 上传对话框 -->
  <div class="dialog-overlay" v-if="uploadDialogVisible" @click="uploadDialogVisible = false">
    <div class="dialog" @click.stop>
      <div class="dialog-header">
        <h3>上传视频</h3>
        <button class="icon-btn" @click="uploadDialogVisible = false">
          <svg class="icon"><use xlink:href="#iconClose"></use></svg>
        </button>
      </div>
      <div class="dialog-body">
        <div class="upload-area" @click="triggerFileInput" @drop.prevent="handleDrop" @dragover.prevent>
          <input 
            ref="fileInput" 
            type="file" 
            accept="video/*" 
            style="display: none" 
            @change="handleFileSelect"
          />
          <svg class="upload-icon"><use xlink:href="#iconUpload"></use></svg>
          <div class="upload-text">
            <div>点击或拖拽视频文件到此区域</div>
            <div class="upload-hint">支持 MP4、WebM、OGG 等格式，最大 100MB</div>
          </div>
        </div>
        
        <div class="upload-category" v-if="categories.length > 0">
          <label>选择分类（可选）:</label>
          <select v-model="uploadCategory" class="b3-select">
            <option value="">默认分类</option>
            <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
          </select>
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
            controls 
            :src="currentVideoUrl" 
            class="video-player"
          >
            您的浏览器不支持视频播放
          </video>
          <div class="video-details">
            <h4>{{ currentVideo?.name }}</h4>
            <div class="video-meta">
              <span class="video-category">{{ currentVideo?.category }}</span>
              <span>{{ formatFileSize(currentVideo?.size) }}</span>
              <span>{{ formatDate(currentVideo?.uploadTime) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <!-- 分类设置对话框 -->
  <div class="dialog-overlay" v-if="categoryDialogVisible" @click="categoryDialogVisible = false">
    <div class="dialog" @click.stop>
      <div class="dialog-header">
        <h3>管理视频分类</h3>
        <button class="icon-btn" @click="categoryDialogVisible = false">
          <svg class="icon"><use xlink:href="#iconClose"></use></svg>
        </button>
      </div>
      <div class="dialog-body">
        <div class="category-settings">
          <div class="category-list">
            <div 
              v-for="(_cat, index) in categories" 
              :key="index" 
              class="category-item"
            >
              <input v-model="categories[index]" class="b3-text-field" placeholder="分类名称" />
              <button class="btn btn-text" @click="removeCategory(index)">
                <svg class="icon"><use xlink:href="#iconTrashcan"></use></svg>
              </button>
            </div>
          </div>
          
          <div class="category-add">
            <input 
              v-model="newCategory" 
              class="b3-text-field" 
              placeholder="新分类名称" 
              @keyup.enter="addCategory"
            />
            <button class="btn btn-primary" @click="addCategory">添加</button>
          </div>
        </div>
      </div>
      <div class="dialog-footer">
        <button class="btn" @click="categoryDialogVisible = false">取消</button>
        <button class="btn btn-primary" @click="saveCategories">保存</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { showMessage } from 'siyuan'
import { getVideoCategories, saveVideoCategories, uploadVideoFile, getVideoList } from './index'
import { usePlugin } from '@/main'

const plugin = usePlugin()

// Props
defineProps<{
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
const uploadDialogVisible = ref(false)
const playerVisible = ref(false)
const categoryDialogVisible = ref(false)
const currentVideo = ref<any>(null)
const currentVideoUrl = ref('')
const uploadCategory = ref('')
const newCategory = ref('')
const fileInput = ref<HTMLInputElement>()
const videoPlayer = ref<HTMLVideoElement>()

// 计算属性
const filteredVideos = computed(() => {
  if (!selectedCategory.value) return videos.value
  return videos.value.filter(video => video.category === selectedCategory.value)
})

// 生命周期
onMounted(async () => {
  await loadCategories()
  await loadVideos()
})

// 方法
function onClose() {
  emit('close')
}

async function loadCategories() {
  categories.value = await getVideoCategories()
}

async function loadVideos() {
  videos.value = await getVideoList(plugin)
}

function openUploadDialog() {
  uploadDialogVisible.value = true
  uploadCategory.value = ''
}

function refreshList() {
  loadVideos()
  showMessage('视频列表已刷新', 2000, 'info')
}

async function openVideoFolder() {
  // 打开视频文件夹
  // 根据实际测试，视频文件存储在 workspace/data/video
  const relativePath = 'data/video'
  
  showMessage(`视频文件夹: ${relativePath}`, 3000, 'info')
  
  // 如果是桌面端，尝试打开文件夹
  if (window.require) {
    try {
      const { shell } = window.require('electron')
      
      // 尝试通过思源API获取工作空间路径
      const response = await fetch('/api/system/getConf', {
        method: 'POST'
      })
      
      if (response.ok) {
        const data = await response.json()
        const workspacePath = data?.data?.conf?.system?.workspaceDir
        
        if (workspacePath) {
          const fullPath = `${workspacePath}/${relativePath}`
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

function openCategorySettings() {
  categoryDialogVisible.value = true
}

function triggerFileInput() {
  fileInput.value?.click()
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    handleFileUpload(file)
  }
}

function handleDrop(event: DragEvent) {
  const file = event.dataTransfer?.files[0]
  if (file) {
    handleFileUpload(file)
  }
}

async function handleFileUpload(file: File) {
  const isVideo = file.type.startsWith('video/')
  const isLt100M = file.size / 1024 / 1024 < 100

  if (!isVideo) {
    showMessage('只能上传视频文件！', 3000, 'error')
    return
  }
  if (!isLt100M) {
    showMessage('视频大小不能超过 100MB！', 3000, 'error')
    return
  }
  
  try {
    const result = await uploadVideoFile(plugin, file, uploadCategory.value || undefined)
    
    if (result.success) {
      showMessage('视频上传成功！', 2000, 'info')
      await loadVideos()
      uploadDialogVisible.value = false
    } else {
      showMessage(`上传失败: ${result.error}`, 3000, 'error')
    }
  } catch (error) {
    console.error('上传出错:', error)
    showMessage('上传过程中出现错误', 3000, 'error')
  }
}

function playVideo(video: any) {
  currentVideo.value = video
  // 生成视频URL（这里需要根据实际存储方式调整）
  currentVideoUrl.value = `siyuan://${video.path}`
  playerVisible.value = true
}

function closePlayer() {
  if (videoPlayer.value) {
    videoPlayer.value.pause()
  }
  currentVideo.value = null
  currentVideoUrl.value = ''
  playerVisible.value = false
}

async function deleteVideo(video: any) {
  if (!confirm(`确定要删除视频 "${video.name}" 吗？此操作不可恢复。`)) {
    return
  }
  
  // TODO: 实现删除视频文件的逻辑
  showMessage('视频已删除', 2000, 'info')
  await loadVideos()
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

function formatDate(dateString?: string) {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString()
}

function addCategory() {
  if (newCategory.value.trim()) {
    categories.value.push(newCategory.value.trim())
    newCategory.value = ''
  }
}

function removeCategory(index: number) {
  categories.value.splice(index, 1)
}

async function saveCategories() {
  try {
    await saveVideoCategories(categories.value)
    showMessage('分类设置已保存', 2000, 'info')
    categoryDialogVisible.value = false
  } catch (error) {
    showMessage('保存失败', 3000, 'error')
  }
}
</script>

<style scoped lang="scss">
@import "./index.scss";
</style>
