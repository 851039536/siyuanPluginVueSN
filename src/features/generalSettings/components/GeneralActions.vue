<template>
  <div class="general-actions">
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

    // 保存当前设置到localStorage
    const currentSettings = {
      timestamp: Date.now(),
      action: 'refresh'
    }
    localStorage.setItem('general-last-action', JSON.stringify(currentSettings))

    // 延迟刷新以显示消息
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        window.location.reload()
      }
    }, 1000)
  } catch (error) {
    console.error('刷新失败:', error)
    showMessage(props.i18n.refreshFailed || '刷新失败', 3000, 'error')
  } finally {
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

<style scoped>
.general-actions {
  padding: 16px;
  height: 100%;
  overflow-y: auto;
  box-sizing: border-box;
  background: var(--b3-theme-background);
}

.settings-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 100%;
}

/* 区域容器 */
.action-section,
.info-section {
  border: 2px solid var(--b3-theme-outline);
  border-radius: 12px;
  overflow: hidden;
  background: var(--b3-theme-surface);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}

.action-section:hover,
.info-section:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 20px;
  background: linear-gradient(135deg, var(--b3-theme-surface-variant), var(--b3-theme-outline));
  border-bottom: 1px solid var(--b3-theme-outline);
}

.section-icon {
  font-size: 18px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.section-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* 操作按钮网格 */
.action-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 16px;
}

/* 信息网格 */
.info-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  background: var(--b3-theme-surface-variant);
  border-radius: 8px;
  border-left: 3px solid var(--b3-theme-primary);
}

.info-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-surface-variant);
}

.info-value {
  font-size: 13px;
  color: var(--b3-theme-on-surface);
  font-weight: 500;
  font-family: 'Courier New', monospace;
}

/* 操作按钮样式 */
.action-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border: 2px solid var(--b3-theme-outline);
  border-radius: 10px;
  background: var(--b3-theme-surface-variant);
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  font-family: inherit;
}

.action-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
  border-color: var(--b3-theme-primary);
  background: linear-gradient(135deg, var(--b3-theme-surface-variant), var(--b3-theme-surface));
}

.action-btn:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 按钮箭头 */
.btn-arrow {
  font-size: 16px;
  color: var(--b3-theme-on-surface-variant);
  transition: all 0.3s ease;
  opacity: 0.6;
}

.action-btn:hover .btn-arrow {
  transform: translateX(4px);
  opacity: 1;
  color: var(--b3-theme-primary);
}

/* 不同类型的按钮样式 */
.refresh-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--b3-theme-primary-container), var(--b3-theme-secondary-container));
}

.workspace-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #e8f5e9, #c8e6c9);
}

.close-tabs-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #fff3e0, #ffe0b2);
}

.cache-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--b3-theme-error-container), var(--b3-theme-error));
}

/* 按钮图标 */
.btn-icon {
  font-size: 24px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--b3-theme-surface);
  border-radius: 10px;
  border: 1px solid var(--b3-theme-outline);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.action-btn:hover .btn-icon {
  transform: scale(1.1);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

/* 按钮内容 */
.btn-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.btn-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.btn-desc {
  font-size: 12px;
  color: var(--b3-theme-on-surface-variant);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 按钮悬停时的文字效果 */
.action-btn:hover:not(:disabled) .btn-title {
  color: var(--b3-theme-on-primary);
}

.action-btn:hover:not(:disabled) .btn-desc {
  color: var(--b3-theme-on-primary);
  opacity: 0.9;
}

/* 响应式设计 */
@media (max-width: 480px) {
  .general-actions {
    padding: 12px;
  }

  .action-grid {
    grid-template-columns: 1fr;
    gap: 10px;
    padding: 12px;
  }

  .action-btn {
    padding: 14px;
  }

  .btn-icon {
    width: 36px;
    height: 36px;
    font-size: 20px;
  }

  .btn-title {
    font-size: 13px;
  }

  .btn-desc {
    font-size: 11px;
  }

  .section-header {
    padding: 12px 16px;
  }
}

@media (max-width: 320px) {
  .general-actions {
    padding: 8px;
  }

  .settings-container {
    gap: 16px;
  }

  .section-header h4 {
    font-size: 14px;
  }

  .action-btn {
    padding: 12px;
    gap: 10px;
  }

  .btn-icon {
    width: 32px;
    height: 32px;
    font-size: 18px;
  }

  .btn-arrow {
    font-size: 14px;
  }
}

/* 动画效果 */
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.action-section {
  animation: slideIn 0.3s ease-out;
}

.action-section:nth-child(2) {
  animation-delay: 0.1s;
}

/* 按钮进入动画 */
@keyframes btnSlideIn {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.action-btn {
  animation: btnSlideIn 0.3s ease-out;
}

.action-btn:nth-child(2) {
  animation-delay: 0.05s;
}

.action-btn:nth-child(3) {
  animation-delay: 0.1s;
}

.action-btn:nth-child(4) {
  animation-delay: 0.15s;
}

/* 渐变背景动画 */
@keyframes gradientShift {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

.action-btn:hover {
  background-size: 200% 200%;
  animation: gradientShift 1.5s ease infinite;
}

/* 滚动条样式 */
.general-actions::-webkit-scrollbar {
  width: 6px;
}

.general-actions::-webkit-scrollbar-track {
  background: var(--b3-theme-surface-variant);
  border-radius: 3px;
}

.general-actions::-webkit-scrollbar-thumb {
  background: var(--b3-theme-outline);
  border-radius: 3px;
  transition: all 0.3s ease;
}

.general-actions::-webkit-scrollbar-thumb:hover {
  background: var(--b3-theme-primary);
}
</style>
