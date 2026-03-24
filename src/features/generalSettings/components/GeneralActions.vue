<template>
  <div class="general-actions compact-mode">
    <div class="settings-container">
      <!-- 页面操作区域 -->
      <div class="action-section">
        <div class="section-header">
          <span class="section-icon">🔄</span>
          <h4>{{ i18n.pageActions || '页面操作' }}</h4>
        </div>
        <div class="action-grid">
          <!-- 刷新页面按钮 -->
          <button @click="refreshPage" class="action-btn refresh-btn" :disabled="isLoading">
            <div class="btn-icon">🔃</div>
            <div class="btn-content">
              <span class="btn-title">{{ i18n.refreshPage || '刷新页面' }}</span>
              <span class="btn-desc">{{ i18n.refreshPageDesc || '重新加载当前页面' }}</span>
            </div>
            <div class="btn-arrow">→</div>
          </button>

          <!-- 打开工作区按钮 -->
          <button @click="openWorkspace" class="action-btn workspace-btn" :disabled="isLoading">
            <div class="btn-icon">📁</div>
            <div class="btn-content">
              <span class="btn-title">{{ i18n.openWorkspace || '打开工作区' }}</span>
              <span class="btn-desc">{{ i18n.openWorkspaceDesc || '打开笔记本文件夹' }}</span>
            </div>
            <div class="btn-arrow">→</div>
          </button>

          <!-- 关闭所有页签按钮 -->
          <button @click="closeAllTabs" class="action-btn close-tabs-btn" :disabled="isLoading">
            <div class="btn-icon">✕</div>
            <div class="btn-content">
              <span class="btn-title">{{ i18n.closeAllTabs || '关闭所有页签' }}</span>
              <span class="btn-desc">{{ i18n.closeAllTabsDesc || '关闭除文件树外的所有页签' }}</span>
            </div>
            <div class="btn-arrow">→</div>
          </button>
        </div>
      </div>

      <!-- 系统信息区域 -->
      <div class="info-section" v-if="systemInfo">
        <div class="section-header">
          <span class="section-icon">ℹ️</span>
          <h4>{{ i18n.systemInfo || '系统信息' }}</h4>
        </div>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">{{ i18n.version || '版本' }}</span>
            <span class="info-value">{{ systemInfo.version }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ i18n.platform || '平台' }}</span>
            <span class="info-value">{{ systemInfo.platform }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ i18n.currentTime || '当前时间' }}</span>
            <span class="info-value">{{ systemInfo.currentTime }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { showMessage } from 'siyuan'
import { ref, onMounted } from 'vue'
import * as api from '@/api'

interface Props {
  i18n?: any
}

interface SystemInfo {
  version: string
  platform: string
  currentTime: string
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({})
})

const isLoading = ref(false)
const systemInfo = ref<SystemInfo | null>(null)

// 初始化系统信息
onMounted(async () => {
  await loadSystemInfo()
})

// 加载系统信息
async function loadSystemInfo() {
  try {
    const version = await api.version()
    const currentTime = await api.currentTime()
    const platform = getPlatformInfo()

    systemInfo.value = {
      version: version || 'Unknown',
      platform: platform,
      currentTime: new Date(currentTime).toLocaleString()
    }
  } catch (error) {
    console.error('Failed to load system info:', error)
  }
}

// 获取平台信息
function getPlatformInfo(): string {
  const ua = navigator.userAgent
  if (ua.includes('Windows')) return 'Windows'
  if (ua.includes('Mac')) return 'macOS'
  if (ua.includes('Linux')) return 'Linux'
  if (ua.includes('Android')) return 'Android'
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS'
  return 'Unknown'
}

// 刷新页面
async function refreshPage() {
  if (isLoading.value) return

  try {
    isLoading.value = true
    showMessage(props.i18n.refreshing || '正在刷新页面...', 2000, 'info')

    // 使用封装的思源API重新加载UI
    await api.reloadUI()
  } catch (error) {
    console.error('刷新失败:', error)
    showMessage(props.i18n.refreshFailed || '刷新失败', 3000, 'error')
    isLoading.value = false
  }
}

// 打开工作区
async function openWorkspace() {
  if (isLoading.value) return

  try {
    isLoading.value = true
    const event = new CustomEvent('openWorkspace')
    window.dispatchEvent(event)
    showMessage(props.i18n.workspaceOpened || '工作区已打开', 2000, 'info')
  } catch (error) {
    console.error('打开工作区失败:', error)
    showMessage(props.i18n.openWorkspaceFailed || '打开工作区失败', 3000, 'error')
  } finally {
    isLoading.value = false
  }
}

// 关闭所有页签
async function closeAllTabs() {
  if (isLoading.value) return

  try {
    isLoading.value = true
    showMessage(props.i18n.closingTabs || '正在关闭页签...', 2000, 'info')

    // 触发思源的关闭事件
    const event = new CustomEvent('closeAllTabs')
    window.dispatchEvent(event)

    setTimeout(() => {
      showMessage(props.i18n.allTabsClosed || '所有页签已关闭', 2000, 'info')
    }, 500)
  } catch (error) {
    console.error('关闭页签失败:', error)
    showMessage(props.i18n.closeTabsFailed || '关闭页签失败', 3000, 'error')
  } finally {
    isLoading.value = false
  }
}

// 暴露方法给父组件
defineExpose({
  refreshPage,
  openWorkspace,
  closeAllTabs,
  loadSystemInfo
})
</script>

<style lang="scss" scoped>
@use "./styles/GeneralActions.scss";
</style>
