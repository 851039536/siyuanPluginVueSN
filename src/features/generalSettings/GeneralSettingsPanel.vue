<template>
  <div class="general-settings">
    <div class="settings-header">
      <h3>{{ i18n.commonSettings || '常用设置' }}</h3>
    </div>

    <div class="settings-layout">
      <!-- 左侧导航栏 -->
      <div class="settings-sidebar">
        <div
          v-for="category in categories"
          :key="category.id"
          :class="['sidebar-item', { active: activeCategory === category.id }]"
          @click="activeCategory = category.id"
        >
          <span class="sidebar-title">{{ category.label }}</span>
        </div>
      </div>

      <!-- 右侧内容区域 -->
      <div class="settings-content">
        <!-- 高亮设置 -->
        <div v-show="activeCategory === 'highlight'" class="content-section">
          <HighlightSettings :i18n="i18n" :plugin="plugin" />
        </div>

        <!-- 代码块美化 -->
        <div v-show="activeCategory === 'codeblock'" class="content-section">
          <CodeBlockSettings :i18n="i18n" :plugin="plugin" @change="handleCodeBlockChange" />
        </div>

        <!-- 标题配置 -->
        <div v-show="activeCategory === 'heading'" class="content-section">
          <HeadingSettings :i18n="i18n" :plugin="plugin" @change="handleHeadingChange" />
        </div>

        <!-- 加密设置 -->
        <div v-show="activeCategory === 'encryption'" class="content-section">
          <PasswordSettings :i18n="i18n" />
          <EncryptionSettings :plugin="plugin" />
        </div>

        <!-- 列表设置 -->
        <div v-show="activeCategory === 'list'" class="content-section">
          <ListSettings :i18n="i18n" :plugin="plugin" @change="handleListChange" />
        </div>

        <!-- 通用操作 -->
        <div v-show="activeCategory === 'actions'" class="content-section">
          <GeneralActions :i18n="i18n" @change="handleActionsChange" />
        </div>

        <!-- 数据备份 -->
        <div v-show="activeCategory === 'backup'" class="content-section">
          <DataBackupSettings :i18n="i18n" :plugin="plugin" @change="handleBackupChange" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import GeneralActions from './components/GeneralActions.vue'
import PasswordSettings from './components/PasswordSettings.vue'
import CodeBlockSettings from './components/CodeBlockSettings.vue'
import HeadingSettings from './components/HeadingSettings.vue'
import ListSettings from './components/ListSettings.vue'
import EncryptionSettings from './components/EncryptionSettings.vue'
import HighlightSettings from './components/HighlightSettings.vue'
import DataBackupSettings from './components/DataBackupSettings.vue'

interface Props {
  i18n?: any
  plugin?: any
  onSettingsChange?: (settings: any) => void
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
  plugin: null,
  onSettingsChange: () => {}
})

// 当前激活的分类
const activeCategory = ref('highlight')

// 分类列表
const categories = computed(() => [
  {
    id: 'highlight',
    label: props.i18n.enableHighlight || '高亮设置'
  },
  {
    id: 'codeblock',
    label: props.i18n.codeBlockSettings || '代码块美化'
  },
  {
    id: 'heading',
    label: props.i18n.headingSettings || '标题配置'
  },
  {
    id: 'list',
    label: props.i18n.listSettings || '列表设置'
  },
  {
    id: 'encryption',
    label: props.i18n.encryptionSettings || '加密设置'
  },
  {
    id: 'actions',
    label: props.i18n.generalActions || '通用操作'
  },
  {
    id: 'backup',
    label: props.i18n.dataBackup || '数据备份'
  }
])

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

function handleHeadingChange(settings: any) {
  console.log('标题设置已更改:', settings)
  props.onSettingsChange?.({
    moduleId: 'heading',
    settings
  })
}

function handleListChange(settings: any) {
  console.log('列表设置已更改:', settings)
  props.onSettingsChange?.({
    moduleId: 'list',
    settings
  })
}

function handleBackupChange(settings: any) {
  console.log('备份设置已更改:', settings)
  props.onSettingsChange?.({
    moduleId: 'backup',
    settings
  })
}

// 暴露方法给父组件
defineExpose({
  handleCodeBlockChange,
  handleActionsChange,
  handleHeadingChange,
  handleListChange,
  handleBackupChange
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
}

.settings-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--b3-theme-surface-variant);
  background: linear-gradient(to right, var(--b3-theme-surface), var(--b3-theme-background));
  flex-shrink: 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.settings-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  letter-spacing: 0.3px;
}

/* 布局容器 */
.settings-layout {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* 左侧导航栏 */
.settings-sidebar {
  width: 150px;
  background: linear-gradient(to bottom, var(--b3-theme-surface), rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.02));
  border-right: 1px solid var(--b3-theme-surface-variant);
  overflow-y: auto;
  flex-shrink: 0;
  padding: 8px 0;
}

.settings-sidebar::-webkit-scrollbar {
  width: 4px;
}

.settings-sidebar::-webkit-scrollbar-track {
  background: transparent;
}

.settings-sidebar::-webkit-scrollbar-thumb {
  background: var(--b3-theme-surface-variant);
  border-radius: 2px;
}

.sidebar-item {
  margin: 4px 8px;
  padding: 12px 14px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 8px;
  position: relative;
  border-left: 3px solid transparent;
}

.sidebar-item:hover {
  background: rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.08);
  transform: translateX(2px);
}

.sidebar-item.active {
  background: linear-gradient(135deg,
    rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.15),
    rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.08)
  );
  border-left-color: var(--b3-theme-primary);
  box-shadow: 0 2px 8px rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.15);
}

.sidebar-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--b3-theme-on-surface);
  display: block;
  line-height: 1.5;
  transition: all 0.2s ease;
}

.sidebar-item.active .sidebar-title {
  color: var(--b3-theme-primary);
  font-weight: 600;
  letter-spacing: 0.2px;
}

.sidebar-item:hover .sidebar-title {
  color: var(--b3-theme-primary);
}

/* 右侧内容区域 */
.settings-content {
  flex: 1;
  overflow-y: auto;
  background: var(--b3-theme-background);
}

.settings-content::-webkit-scrollbar {
  width: 6px;
}

.settings-content::-webkit-scrollbar-track {
  background: transparent;
}

.settings-content::-webkit-scrollbar-thumb {
  background: var(--b3-theme-surface-variant);
  border-radius: 3px;
  transition: background 0.3s ease;
}

.settings-content::-webkit-scrollbar-thumb:hover {
  background: var(--b3-theme-outline);
}

.content-section {
  height: 100%;
  overflow-y: auto;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 响应式设计 */
@media (max-width: 500px) {
  .settings-sidebar {
    width: 110px;
    padding: 6px 0;
  }

  .sidebar-item {
    margin: 3px 6px;
    padding: 10px 10px;
  }

  .sidebar-title {
    font-size: 12px;
  }
}

@media (max-width: 400px) {
  .settings-header {
    padding: 12px 14px;
  }

  .settings-header h3 {
    font-size: 14px;
  }

  .settings-sidebar {
    width: 90px;
    padding: 4px 0;
  }

  .sidebar-item {
    margin: 2px 4px;
    padding: 8px 8px;
  }

  .sidebar-title {
    font-size: 11px;
  }
}
</style>
