<template>
  <div
    v-show="state.showMonitor"
    class="status__resUsage"
    :title="systemInfoTooltip"
  >
    <MonitorItem
      icon="ph:file-text"
      item-class="statistics-item notes-item"
      :title="statisticsTooltip"
    >
      {{ totalNotesDisplay }}
    </MonitorItem>

    <MonitorItem
      icon="ph:text-aa"
      item-class="statistics-item words-item"
      :title="statisticsTooltip"
    >
      {{ totalWordsDisplay }}
    </MonitorItem>

    <MonitorItem
      icon="ph:chart-line-up"
      item-class="statistics-item today-activity-item"
      :title="todayTooltip"
    >
      {{ todayActivityDisplay }}
    </MonitorItem>

    <MonitorItem
      icon="ph:cpu"
      item-class="cpu-item"
      :level="cpuLevel"
    >
      {{ cpuUsageDisplay }}
    </MonitorItem>

    <MonitorItem
      icon="ph:memory"
      item-class="mem-item"
      :level="memLevel"
    >
      {{ memoryUsageDisplay }}
    </MonitorItem>

    <MonitorItem
      icon="ph:timer"
      item-class="uptime-item"
    >
      {{ uptimeDisplay }}
    </MonitorItem>

    <MonitorItem
      icon="ph:lock-key"
      item-class="action-item password-vault-item"
      title="密码箱"
      @click="handleOpenPasswordVault"
    />

    <MonitorItem
      icon="ph:grid-four"
      item-class="action-item feature-drawer-item"
      title="功能列表"
      @click="toggleFeatureDrawer"
    />

    <FeatureDrawer
      :visible="showFeatureDrawer"
      @close="showFeatureDrawer = false"
      @select="handleSelectFeature"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"
import { emitCustomEvent } from "@/utils/eventBus"
import { showPasswordVault } from "../passwordVault/types"
import { showSkillsViewer } from "../skillsViewer/types"
import FeatureDrawer from "./components/FeatureDrawer.vue"
import MonitorItem from "./components/MonitorItem.vue"
import { useStatusBar } from "./composables/useStatusBar"

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
  todayActivityDisplay,
  todayTooltip,
} = useStatusBar()

const handleOpenPasswordVault = () => {
  showPasswordVault()
}

const showFeatureDrawer = ref(false)

const toggleFeatureDrawer = () => {
  showFeatureDrawer.value = !showFeatureDrawer.value
}

const handleSelectFeature = (id: string) => {
  showFeatureDrawer.value = false
  switch (id) {
    case "superPanel":
      emitCustomEvent("toggleSuperPanel")
      break
    case "video":
      emitCustomEvent("openVideoManager")
      break
    case "passwordVault":
      showPasswordVault()
      break
    case "skillsViewer":
      showSkillsViewer()
      break
    case "htmlViewer":
      emitCustomEvent("openHtmlViewer")
      break
  }
}
</script>
