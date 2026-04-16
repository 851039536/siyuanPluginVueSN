<template>
  <div
    v-show="state.showMonitor"
    class="status__resUsage"
    :title="systemInfoTooltip"
  >
    <MonitorItem
      icon="ph:file-text"
      item-class="statistics-item"
      :title="statisticsTooltip"
    >
      {{ totalNotesDisplay }}
    </MonitorItem>

    <MonitorItem
      icon="ph:text-aa"
      item-class="statistics-item"
      :title="statisticsTooltip"
    >
      {{ totalWordsDisplay }}
    </MonitorItem>

    <MonitorItem icon="ph:cpu" :level="cpuLevel">
      {{ cpuUsageDisplay }}
    </MonitorItem>

    <MonitorItem icon="ph:memory" :level="memLevel">
      {{ memoryUsageDisplay }}
    </MonitorItem>

    <MonitorItem icon="ph:timer" item-class="uptime-item">
      {{ uptimeDisplay }}
    </MonitorItem>

    <MonitorItem
      icon="ph:lock-key"
      item-class="action-item password-vault-item"
      title="密码箱"
      @click="handleOpenPasswordVault"
    />

    <MonitorItem
      icon="ph:video"
      item-class="action-item video-manager-item"
      title="视频管理器"
      @click="handleOpenVideoManager"
    />
  </div>
</template>

<script setup lang="ts">
import MonitorItem from "./components/MonitorItem.vue";
import { useSystemMonitor } from "./composables/useSystemMonitor";
import { showPasswordVault } from "../passwordVault/types";

const {
	state,
	cpuUsageDisplay,
	memoryUsageDisplay,
	uptimeDisplay,
	systemInfoTooltip,
	cpuLevel,
	memLevel,
	totalNotesDisplay,
	totalWordsDisplay,
	statisticsTooltip,
} = useSystemMonitor();

const handleOpenPasswordVault = () => {
	showPasswordVault();
};

const handleOpenVideoManager = () => {
	window.dispatchEvent(new CustomEvent("openVideoManager"));
};
</script>
