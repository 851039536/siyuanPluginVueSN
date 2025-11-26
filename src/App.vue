<template>
  <div class="plugin-app-main">


  </div>
</template>

<script setup lang="ts">
import { usePlugin } from '@/main'
import { onMounted, ref, watchEffect } from 'vue'



const openSetting = () => {
  alert('Need open plugin setting.')
}

const plugin = usePlugin()
console.log('plugin is ', plugin)




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
