<template>
  <div class="plugin-app-main">
    <!-- 图片压缩器 -->
    <ImageViewer
      :visible="showImageViewer"
      :i18n="(plugin.i18n as any).imageCompressor || {}"
      @close="onCloseImageViewer"
    />
    <!-- 二维码对话框 -->
    <QRCodeDialog
      :visible="showQRCodeDialog"
      :content="qrcodeContent"
      :i18n="plugin.i18n"
      @update:visible="onQRCodeDialogVisibleChange"
      @close="onCloseQRCodeDialog"
    />

    <!-- 视频管理器 -->
    <VideoManager
      :visible="showVideoManager"
      @close="onCloseVideoManager"
    />

    <!-- Everything搜索弹窗 -->
    <EverythingSearchDialog
      :visible="everythingSearchVisible"
      @update:visible="(v) => everythingSearchVisible = v"
      @close="hideEverythingSearch"
    />
  </div>
</template>

<script setup lang="ts">
import { usePlugin } from '@/main'
import { onMounted, ref, watchEffect } from 'vue'
import ImageViewer from '@/features/imageCompressor/ImageViewer.vue'
import QRCodeDialog from '@/features/qrCode/QRCodeDialog.vue'
import VideoManager from '@/features/video/VideoManager.vue'
import EverythingSearchDialog from '@/features/everythingSearch/EverythingSearchDialog.vue'
import { everythingSearchVisible, hideEverythingSearch, showApiReferencePanel } from '@/features'
import type PluginSample from '@/index'

const plugin = usePlugin() as PluginSample
const showImageViewer = ref(false)
const showQRCodeDialog = ref(false)
const showVideoManager = ref(false)
const qrcodeContent = ref('')

console.log('plugin is ', plugin)

// 打开图片压缩器
const openImageCompressor = () => {
  showImageViewer.value = true
}

// 关闭图片压缩器
const onCloseImageViewer = () => {
  showImageViewer.value = false
}

// 二维码对话框控制
const onQRCodeDialogVisibleChange = (visible: boolean) => {
  showQRCodeDialog.value = visible
}

const onCloseQRCodeDialog = () => {
  showQRCodeDialog.value = false
}

// 视频管理器控制
const openVideoManager = () => {
  showVideoManager.value = true
}

const onCloseVideoManager = () => {
  showVideoManager.value = false
}

// 公开方法，纲projuct可以通过事件打开二维码对话框
const openQRCodeDialog = (content: string) => {
  qrcodeContent.value = content
  showQRCodeDialog.value = true
}




const statusRef = ref<HTMLDivElement>()
watchEffect(() => {
  console.log('statusRef is ', statusRef.value)
})
// two ways to add status bar
onMounted(() => {
  // 1. use Teleport in Vue way
  // show as a green heart icon
  const status = document.getElementById('status') as HTMLDivElement
  if (status) {
    // delay 5 seconds to bind statusRef
    // avoid status is not ready
    setTimeout(() => {
      statusRef.value = status
    }, 5000)
  }

  // 2. use addStatusBar in siyuan plugin way
  // show as a red heart icon
  const tempStatus = document.createElement('div')
  tempStatus.classList.add('temp-status')
  tempStatus.innerHTML = `
    <svg style="width: 12px; height: 12px; color: red;">
      <use xlink:href="#iconHeart"></use>
    </svg>
  `

  plugin.addStatusBar({
    element: tempStatus,
    position: 'right',
  })
})


onMounted(() => {
  window._sy_plugin_sample = {}
  window._sy_plugin_sample.openQRCodeDialog = openQRCodeDialog

  // 监听打开二维码对话框事件
  window.addEventListener('openQRCodeDialog', ((event: any) => {
    const content = event.detail?.content
    if (content) {
      qrcodeContent.value = content
      showQRCodeDialog.value = true
    }
  }) as EventListener)

  // 监听打开图片压缩器事件
  window.addEventListener('openImageCompressor', openImageCompressor)

  // 监听打开视频管理器事件
  window.addEventListener('openVideoManager', openVideoManager)

  // 监听打开Everything搜索事件
  window.addEventListener('openEverythingSearch', () => {
    console.log('收到 openEverythingSearch 事件')
    everythingSearchVisible.value = true
    console.log('弹窗状态设置为:', everythingSearchVisible.value)
  })

  // 监听打开API参考事件
  window.addEventListener('openApiReference', () => {
    console.log('收到 openApiReference 事件')
    showApiReferencePanel(plugin)
  })
})
</script>


<!-- 局部样式 -->
<style lang="scss" scoped>
.plugin-app-main {
  width: 100%;
  height: 100%;
  max-height: 100vh;
  box-sizing: border-box;
  pointer-events: none;

  position: absolute;
  top: 0;
  left: 0;
  z-index: 4;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: nowrap;

  .demo {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    pointer-events: auto;

    z-index: 10;

    background-color: var(--b3-theme-surface);
    border-radius: var(--b3-border-radius);
    border: 1px solid var(--b3-border-color);
    padding: 16px;
  }
}
</style>

<!-- 全局样式 -->
<style lang="scss">
.siyuan-plugin-vite-vue-sn-app {
  width: 100vw;
  height: 100dvh;
  max-height: 100vh;
  position: absolute;
  top: 0px;
  left: 0px;
  pointer-events: none;
  box-sizing: border-box;
}

.row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
</style>
