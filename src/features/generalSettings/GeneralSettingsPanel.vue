<template>
  <div class="general-settings">
    <div class="settings-header">
      <h3>{{ i18n.commonSettings || '常用设置' }}</h3>
    </div>

    <!-- 统一内容区域 -->
    <div class="unified-content">
      <!-- 字体设置区域 -->
      <div class="setting-section">
        <div class="section-title">
          <span class="section-icon">🔤</span>
          <span>{{ i18n.fontSettings || '字体设置' }}</span>
        </div>
        <FontSettings :i18n="i18n" @change="handleFontChange" />
      </div>

      <!-- 代码块美化区域 -->
      <div class="setting-section">
        <div class="section-title">
          <span class="section-icon">💻</span>
          <span>{{ i18n.codeBlockSettings || '代码块美化' }}</span>
        </div>
        <CodeBlockSettings :i18n="i18n" @change="handleCodeBlockChange" />
      </div>

      <!-- 密码设置区域 -->
      <div class="setting-section">
        <div class="section-title">
          <span class="section-icon">🔒</span>
          <span>{{ i18n.passwordSetting || '密码设置' }}</span>
        </div>
        <PasswordSettings :i18n="i18n" />
      </div>

      <!-- 通用操作区域 -->
      <div class="setting-section">
        <div class="section-title">
          <span class="section-icon">🚀</span>
          <span>{{ i18n.generalActions || '通用操作' }}</span>
        </div>
        <GeneralActions :i18n="i18n" @change="handleActionsChange" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import FontSettings from './components/FontSettings.vue'
import GeneralActions from './components/GeneralActions.vue'
import PasswordSettings from './components/PasswordSettings.vue'
import CodeBlockSettings from './components/CodeBlockSettings.vue'

interface Props {
  i18n?: any
  onSettingsChange?: (settings: any) => void
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
  onSettingsChange: () => {}
})

function handleFontChange(settings: any) {
  console.log('字体设置已更改:', settings)
  props.onSettingsChange?.({
    moduleId: 'font',
    settings
  })
}

function handleCodeBlockChange(settings: any) {
  console.log('代码块设置已更改:', settings)
  props.onSettingsChange?.({
    moduleId: 'codeblock',
    settings
  })
}

function handleActionsChange(settings: any) {
  console.log('通用操作已更改:', settings)
  props.onSettingsChange?.({
    moduleId: 'actions',
    settings
  })
}

// 暴露方法给父组件
defineExpose({
  handleFontChange,
  handleCodeBlockChange,
  handleActionsChange
})
</script>

<style scoped>
.general-settings {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  overflow: hidden;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.settings-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--b3-theme-surface-variant);
  background: linear-gradient(135deg,
    var(--b3-theme-surface),
    rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.03)
  );
}

.settings-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  display: flex;
  align-items: center;
  gap: 8px;
}

.settings-header h3::before {
  content: '⚙️';
  font-size: 18px;
  opacity: 0.9;
}

/* 统一内容区域 */
.unified-content {
  flex: 1;
  overflow-y: auto;
  background: var(--b3-theme-background);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.unified-content::-webkit-scrollbar {
  width: 6px;
}

.unified-content::-webkit-scrollbar-track {
  background: transparent;
}

.unified-content::-webkit-scrollbar-thumb {
  background: var(--b3-theme-surface-variant);
  border-radius: 3px;
  transition: background 0.3s ease;
}

.unified-content::-webkit-scrollbar-thumb:hover {
  background: var(--b3-theme-outline);
}

/* 设置区块 */
.setting-section {
  background: var(--b3-theme-surface);
  border-radius: 12px;
  border: 1px solid var(--b3-theme-surface-variant);
  overflow: visible;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.setting-section:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
  border-color: rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.2);
}

/* 区块标题 */
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: linear-gradient(135deg,
    rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.05),
    rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.02)
  );
  border-bottom: 1px solid var(--b3-theme-surface-variant);
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  border-radius: 11px 11px 0 0;
}

.section-icon {
  font-size: 14px;
  opacity: 0.85;
}

/* 响应式设计 */
@media (max-width: 400px) {
  .settings-header {
    padding: 8px 12px;
  }

  .settings-header h3 {
    font-size: 14px;
  }

  .settings-header h3::before {
    font-size: 16px;
  }

  .unified-content {
    padding: 6px;
    gap: 12px;
  }

  .section-title {
    padding: 10px 12px;
    font-size: 12px;
  }

  .section-icon {
    font-size: 13px;
  }
}
</style>
