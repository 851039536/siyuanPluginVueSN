<template>
  <div class="plugin-app-main">
    <!-- 设置面板 -->
    <SettingPanel
      v-if="showSettings"
      :settings="pluginSettings"
      :i18n="plugin.i18n"
      @save="onSaveSettings"
      @cancel="onCancelSettings"
    />

    <!-- 图片压缩器 -->
    <ImageViewer
      :visible="showImageViewer"
      :i18n="(plugin.i18n as any).imageCompressor || {}"
      @close="onCloseImageViewer"
    />
  </div>
</template>

<script setup lang="ts">
import { usePlugin } from '@/main'
import { onMounted, ref, watchEffect } from 'vue'
import SettingPanel from '@/components/SettingPanel.vue'
import ImageViewer from '@/features/imageCompressor/ImageViewer.vue'
import { showMessage } from 'siyuan'
import type { PluginSettings } from '@/config/settings'
import type PluginSample from '@/index'

const plugin = usePlugin() as PluginSample
const showSettings = ref(false)
const showImageViewer = ref(false)
const pluginSettings = ref<PluginSettings>(plugin.settings)

console.log('plugin is ', plugin)

const openSetting = () => {
  showSettings.value = true
  // 同步最新配置
  pluginSettings.value = { ...plugin.settings }
}

const onSaveSettings = async (settings: PluginSettings) => {
  const success = await plugin.updateSettings(settings)
  if (success) {
    showMessage(plugin.i18n.saveSettingsSuccess || '配置保存成功,请重启插件生效', 3000, 'info')
    showSettings.value = false
    // 更新本地配置副本
    pluginSettings.value = { ...settings }
  } else {
    showMessage(plugin.i18n.saveSettingsFailed || '配置保存失败', 3000, 'error')
  }
}

const onCancelSettings = () => {
  showSettings.value = false
}

// 打开图片压缩器
const openImageCompressor = () => {
  showImageViewer.value = true
}

// 关闭图片压缩器
const onCloseImageViewer = () => {
  showImageViewer.value = false
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
  window._sy_plugin_sample.openSetting = openSetting

  // 监听打开图片压缩器事件
  window.addEventListener('openImageCompressor', openImageCompressor)
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
