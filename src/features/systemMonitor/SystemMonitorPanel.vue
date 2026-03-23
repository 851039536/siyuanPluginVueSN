<template>
  <div
    v-if="state.showMonitor"
    ref="monitorElement"
    class="status__resUsage"
    :title="systemInfoTooltip"
  >
    <div class="monitor-item statistics-item" :title="statisticsTooltip">
      <Icon icon="ph:file-text" class="monitor-icon" />
      <span class="monitor-value">{{ totalNotesDisplay }}</span>
    </div>

    <div class="monitor-item statistics-item" :title="statisticsTooltip">
      <Icon icon="ph:text-aa" class="monitor-icon" />
      <span class="monitor-value">{{ totalWordsDisplay }}</span>
    </div>

    <div class="monitor-item" :data-level="cpuLevel">
      <Icon icon="ph:cpu" class="monitor-icon" />
      <span class="monitor-value">{{ cpuUsageDisplay }}</span>
    </div>

    <div class="monitor-item" :data-level="memLevel">
      <Icon icon="ph:memory" class="monitor-icon" />
      <span class="monitor-value">{{ memoryUsageDisplay }}</span>
    </div>

    <div class="monitor-item uptime-item">
      <Icon icon="ph:timer" class="monitor-icon" />
      <span class="monitor-value">{{ uptimeDisplay }}</span>
    </div>

    <div class="monitor-item password-vault-item" @click="handleOpenPasswordVault" title="密码箱">
      <Icon icon="ph:lock-key" class="monitor-icon" />
    </div>

    <div class="monitor-item video-manager-item" @click="handleOpenVideoManager" title="视频管理器">
      <Icon icon="ph:video" class="monitor-icon" />
    </div>

  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useSystemMonitor } from './composables/useSystemMonitor'
import { showPasswordVault } from '../passwordVault'

const {
  state,
  monitorElement,
  cpuUsageDisplay,
  memoryUsageDisplay,
  uptimeDisplay,
  systemInfoTooltip,
  cpuLevel,
  memLevel,
  totalNotesDisplay,
  totalWordsDisplay,
  statisticsTooltip
} = useSystemMonitor()

const handleOpenPasswordVault = () => {
  showPasswordVault()
}

const handleOpenVideoManager = () => {
  window.dispatchEvent(new CustomEvent('openVideoManager'))
}
</script>


