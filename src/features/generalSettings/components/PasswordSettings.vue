<template>
  <div class="password-settings compact-mode">
    <div class="settings-container">
      <!-- 密码设置区域 -->
      <div class="password-section">
        <div class="section-header">
          <span class="section-icon">🔐</span>
          <h4>{{ i18n.passwordSetting || '密码设置' }}</h4>
        </div>

        <div class="password-content">
          <!-- 密码状态显示 -->
          <div class="password-status">
            <div class="status-indicator" :class="{ 'has-password': hasPassword }">
              <span class="status-icon">{{ hasPassword ? '✅' : '⚠️' }}</span>
              <span class="status-text">
                {{ hasPassword ? (i18n.passwordSet || '密码已设置') : (i18n.passwordNotSet || '尚未设置密码') }}
              </span>
            </div>
          </div>

          <!-- 密码说明 -->
          <div class="password-info">
            <div class="info-icon">ℹ️</div>
            <div class="info-text">
              {{ i18n.passwordSettingDesc || '设置全局加密密码，用于锁定文档' }}
            </div>
          </div>

          <!-- 设置/更新密码按钮 -->
          <button @click="openPasswordDialog" class="action-btn password-btn">
            <div class="btn-icon">🔑</div>
            <div class="btn-content">
              <span class="btn-title">
                {{ hasPassword ? (i18n.updatePassword || '更新密码') : (i18n.setPassword || '设置密码') }}
              </span>
              <span class="btn-desc">
                {{ hasPassword ? (i18n.updatePasswordDesc || '修改当前密码') : (i18n.setPasswordDesc || '设置文档加密密码') }}
              </span>
            </div>
            <div class="btn-arrow">→</div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { usePlugin } from '@/main'
import type PluginSample from '@/index'

interface Props {
  i18n?: any
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({})
})

const plugin = usePlugin() as PluginSample
const hasPassword = ref(false)

// 检查是否已设置密码
async function checkPassword() {
  try {
    const password = await plugin.loadData('global-password')
    hasPassword.value = !!password
  } catch (error) {
    console.error('检查密码失败:', error)
    hasPassword.value = false
  }
}

// 打开密码设置对话框
function openPasswordDialog() {
  // 触发自定义事件，由 pageLock 模块处理
  const event = new CustomEvent('open-password-dialog', {
    detail: { hasPassword: hasPassword.value }
  })
  window.dispatchEvent(event)
}

onMounted(() => {
  checkPassword()

  // 监听密码更新事件
  window.addEventListener('password-updated', () => {
    checkPassword()
  })
})

defineExpose({
  checkPassword,
  openPasswordDialog
})
</script>

<style scoped>
.password-settings {
  padding: 16px;
  box-sizing: border-box;
  background: var(--b3-theme-background);
}

.settings-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 100%;
}

.password-section {
  border: 2px solid var(--b3-theme-outline);
  border-radius: 12px;
  overflow: hidden;
  background: var(--b3-theme-surface);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}

.password-section:hover {
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

.password-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.password-status {
  padding: 12px;
  background: var(--b3-theme-surface-variant);
  border-radius: 8px;
  border-left: 3px solid var(--b3-theme-primary);
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-icon {
  font-size: 18px;
}

.status-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--b3-theme-on-surface);
}

.password-info {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px;
  background: var(--b3-theme-surface-variant);
  border-radius: 8px;
  border: 1px solid var(--b3-theme-outline);
}

.info-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.info-text {
  font-size: 12px;
  color: var(--b3-theme-on-surface-variant);
  line-height: 1.5;
}

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

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
  border-color: var(--b3-theme-primary);
  background: linear-gradient(135deg, var(--b3-theme-primary-container), var(--b3-theme-secondary-container));
}

.action-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

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
}

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

.action-btn:hover .btn-title,
.action-btn:hover .btn-desc {
  color: var(--b3-theme-on-primary);
}

/* 紧凑模式样式 */
.password-settings.compact-mode {
  padding: 12px 8px;
}

.password-settings.compact-mode .settings-container {
  gap: 12px;
}

.password-settings.compact-mode .password-section {
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
}

.password-settings.compact-mode .section-header {
  padding: 10px 12px;
  gap: 6px;
}

.password-settings.compact-mode .section-icon {
  font-size: 16px;
}

.password-settings.compact-mode .section-header h4 {
  font-size: 14px;
}

.password-settings.compact-mode .password-content {
  padding: 10px 8px;
  gap: 12px;
}

.password-settings.compact-mode .password-status {
  padding: 10px;
}

.password-settings.compact-mode .status-icon {
  font-size: 16px;
}

.password-settings.compact-mode .status-text {
  font-size: 12px;
}

.password-settings.compact-mode .password-info {
  padding: 10px;
}

.password-settings.compact-mode .info-icon {
  font-size: 14px;
}

.password-settings.compact-mode .info-text {
  font-size: 11px;
}

.password-settings.compact-mode .action-btn {
  padding: 10px;
  gap: 8px;
  border: 1px solid var(--b3-theme-outline);
  border-radius: 8px;
}

.password-settings.compact-mode .btn-icon {
  width: 32px;
  height: 32px;
  font-size: 18px;
  border-radius: 6px;
}

.password-settings.compact-mode .btn-title {
  font-size: 12px;
}

.password-settings.compact-mode .btn-desc {
  font-size: 10px;
}

.password-settings.compact-mode .btn-arrow {
  font-size: 14px;
}

/* 响应式设计 */
@media (max-width: 480px) {
  .password-settings.compact-mode {
    padding: 10px 6px;
  }

  .password-settings.compact-mode .action-btn {
    padding: 9px;
  }

  .password-settings.compact-mode .btn-icon {
    width: 28px;
    height: 28px;
    font-size: 16px;
  }
}

/* 滚动条样式 */
.password-settings::-webkit-scrollbar {
  width: 6px;
}

.password-settings::-webkit-scrollbar-track {
  background: var(--b3-theme-surface-variant);
  border-radius: 3px;
}

.password-settings::-webkit-scrollbar-thumb {
  background: var(--b3-theme-outline);
  border-radius: 3px;
  transition: all 0.3s ease;
}

.password-settings::-webkit-scrollbar-thumb:hover {
  background: var(--b3-theme-primary);
}
</style>
