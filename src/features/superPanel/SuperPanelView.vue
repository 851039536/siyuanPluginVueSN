<template>
  <!-- 遮罩层 -->
  <Transition name="overlay">
    <div
      v-if="visible"
      class="super-panel-overlay"
      @click="handleClose"
    />
  </Transition>

  <!-- 面板容器 -->
  <Transition name="panel">
    <div v-if="visible" class="super-panel-container">
      <!-- 头部 -->
      <div class="super-panel-header">
        <div class="super-panel-title">
          <IconWrapper name="superPanel" :size="20" />
          <span>{{ i18n.title || '超级面板' }}</span>
        </div>
        <button class="super-panel-close" :title="i18n.close || '关闭'" @click="handleClose">
          <IconWrapper name="close" :size="16" />
        </button>
      </div>

      <!-- 内容区 -->
      <div class="super-panel-content">
        <FeatureCard
          v-for="feature in features"
          :key="feature.id"
          :feature="feature"
          :i18n="i18n"
          @action="handleFeatureAction"
        />
      </div>

      <!-- 底部 -->
      <div class="super-panel-footer">
        <button class="super-panel-settings-btn" @click="handleOpenSettings">
          <IconWrapper name="settings" :size="16" />
          <span>{{ i18n.settings || '插件设置' }}</span>
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import IconWrapper from '@/components/IconWrapper.vue'
import FeatureCard from './components/FeatureCard.vue'
import type { Feature } from './types'

interface Props {
  visible: boolean
  settings: any
  i18n: any
}

interface Emits {
  (e: 'close'): void
  (e: 'openSettings'): void
  (e: 'action', action: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 功能列表配置
const features = computed<Feature[]>(() => [
  {
    id: 'tableOfContents',
    iconKey: 'tableOfContents',
    title: props.i18n.tableOfContents || '目录索引',
    desc: props.i18n.tableOfContentsDesc || '快速生成文档目录和大纲',
    enabled: props.settings.enableTableOfContents,
    actions: [
      { key: 'insertIndex', label: '插入索引', hotkey: 'Ctrl+Alt+I' },
      { key: 'insertOutline', label: '插入大纲', hotkey: 'Ctrl+Alt+O' },
      { key: 'insertRef', label: '插入引用', hotkey: 'Ctrl+Alt+R' }
    ]
  },
  {
    id: 'imageCompressor',
    iconKey: 'imageCompressor',
    title: props.i18n.imageCompressor || '图片压缩',
    desc: props.i18n.imageCompressorDesc || '批量压缩文档中的图片',
    enabled: props.settings.enableImageCompressor,
    actions: [
      { key: 'openCompressor', label: '打开压缩器', hotkey: 'Ctrl+Alt+C' }
    ]
  },
  {
    id: 'docNavigation',
    iconKey: 'docNavigation',
    title: props.i18n.docNavigation || '文档导航',
    desc: props.i18n.docNavigationDesc || '显示父子文档导航链接',
    enabled: props.settings.enableDocNavigation,
    actions: []
  },
  {
    id: 'pageLock',
    iconKey: 'pageLock',
    title: props.i18n.pageLock || '页面锁定',
    desc: props.i18n.pageLockDesc || '锁定页面防止误编辑',
    enabled: props.settings.enablePageLock,
    actions: []
  },
  {
    id: 'wordQuery',
    iconKey: 'wordQuery',
    title: props.i18n.wordQuery || '单词查询',
    desc: props.i18n.wordQueryDesc || '快速查询单词释义',
    enabled: props.settings.enableWordQuery,
    actions: []
  },
  {
    id: 'qrCode',
    iconKey: 'qrCode',
    title: props.i18n.qrCode || '二维码生成',
    desc: props.i18n.qrCodeDesc || '生成文本或链接的二维码',
    enabled: props.settings.enableQRCode,
    actions: []
  },
  {
    id: 'unitConverter',
    iconKey: 'unitConverter',
    title: props.i18n.unitConverter || '单位转换',
    desc: props.i18n.unitConverterDesc || '快速转换各种单位',
    enabled: props.settings.enableUnitConverter,
    actions: []
  },
  {
    id: 'shortcuts',
    iconKey: 'shortcuts',
    title: props.i18n.shortcuts || '快捷键面板',
    desc: props.i18n.shortcutsDesc || '查看和管理快捷键',
    enabled: props.settings.enableShortcuts,
    actions: []
  },
  {
    id: 'diskBrowser',
    iconKey: 'diskBrowser',
    title: props.i18n.diskBrowser || '本地磁盘',
    desc: props.i18n.diskBrowserDesc || '浏览本地磁盘和文件夹',
    enabled: props.settings.enableDiskBrowser,
    actions: []
  }
])

const handleClose = () => {
  emit('close')
}

const handleOpenSettings = () => {
  emit('openSettings')
  emit('close')
}

const handleFeatureAction = (action: string) => {
  emit('action', action)
}
</script>

<style scoped lang="scss">
/* 遮罩层动画 */
.overlay-enter-active,
.overlay-leave-active {
  transition: opacity 0.3s ease;
}

.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}

/* 面板动画 */
.panel-enter-active,
.panel-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.panel-enter-from,
.panel-leave-to {
  transform: translateX(100%);
}

/* 遮罩层 */
.super-panel-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(2px);
  z-index: 9998;
}

/* 面板容器 */
.super-panel-container {
  position: fixed;
  top: 0;
  right: 0;
  width: 360px;
  height: 100vh;
  background: var(--b3-theme-background);
  box-shadow: -2px 0 12px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  display: flex;
  flex-direction: column;
}

/* 面板头部 */
.super-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  background: var(--b3-theme-surface);
}

.super-panel-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
}

.super-panel-close {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;

  &:hover {
    background: var(--b3-theme-error-lighter);
  }
}

/* 面板内容 */
.super-panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;

  /* 滚动条样式 */
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--b3-theme-surface-lighter);
    border-radius: 3px;

    &:hover {
      background: var(--b3-theme-on-surface);
    }
  }
}

/* 面板底部 */
.super-panel-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--b3-theme-surface-lighter);
  background: var(--b3-theme-surface);
}

.super-panel-settings-btn {
  width: 100%;
  padding: 12px;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-surface);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s;

  &:hover {
    background: var(--b3-theme-primary-light);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }
}
</style>
