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
      v-for="shortcut in visibleShortcuts"
      :key="shortcut.id"
      :icon="shortcut.icon"
      :item-class="shortcut.itemClass"
      :title="shortcut.title"
      @click="shortcut.handler"
    />

    <MonitorItem
      icon="ph:grid-four"
      item-class="action-item feature-drawer-item"
      title="功能列表"
      @click="toggleFeatureDrawer"
    />

    <FeatureDrawer
      :visible="showFeatureDrawer"
      :items="featureDrawerItems"
      :status-bar-visible="statusBarShortcuts"
      @close="showFeatureDrawer = false"
      @select="handleSelectFeature"
      @toggle-status-bar="handleToggleStatusBar"
    />
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import type { FeatureDrawerItem } from "./components/FeatureDrawer.vue"
import {
  computed,
  ref,
} from "vue"
import { emitCustomEvent } from "@/utils/eventBus"
import { PluginStorage } from "@/utils/pluginStorage"
import { showPasswordVault } from "../passwordVault/types"
import { showSkillsViewer } from "../skillsViewer/types"
import FeatureDrawer from "./components/FeatureDrawer.vue"
import MonitorItem from "./components/MonitorItem.vue"
import { useStatusBar } from "./composables/useStatusBar"

const props = defineProps<{
  plugin: Plugin
}>()

const storage = new PluginStorage(props.plugin)

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

const statusBarShortcuts = ref<string[]>([])

const featureDrawerItems: FeatureDrawerItem[] = [
  {
    id: "superPanel",
    icon: "mdi:view-dashboard",
    color: "#3b82f6",
    title: "超级面板",
    pinnable: false,
  },
  {
    id: "video",
    icon: "mdi:video",
    color: "#6366f1",
    title: "视频管理器",
    pinnable: true,
  },
  {
    id: "passwordVault",
    icon: "mdi:lock",
    color: "#22c55e",
    title: "密码箱",
    pinnable: true,
  },
  {
    id: "skillsViewer",
    icon: "mdi:puzzle",
    color: "#f59e0b",
    title: "Skills 查看器",
    pinnable: true,
  },
  {
    id: "htmlViewer",
    icon: "mdi:language-html5",
    color: "#e67e22",
    title: "HTML 展示",
    pinnable: true,
  },
  {
    id: "formatAssistant",
    icon: "mdi:format-align-left",
    color: "#07c160",
    title: "排版助手",
    pinnable: true,
  },
]

interface ShortcutDisplay {
  id: string
  icon: string
  title: string
  itemClass: string
  handler: () => void
}

const SHORTCUT_DISPLAY: Record<string, ShortcutDisplay> = {
  passwordVault: {
    id: "passwordVault",
    icon: "ph:lock-key",
    title: "密码箱",
    itemClass: "action-item password-vault-item",
    handler: () => showPasswordVault(),
  },
  video: {
    id: "video",
    icon: "ph:video",
    title: "视频管理器",
    itemClass: "action-item video-manager-item",
    handler: () => emitCustomEvent("openVideoManager"),
  },
  htmlViewer: {
    id: "htmlViewer",
    icon: "ph:code",
    title: "HTML展示",
    itemClass: "action-item html-viewer-item",
    handler: () => emitCustomEvent("openHtmlViewer"),
  },
  skillsViewer: {
    id: "skillsViewer",
    icon: "ph:puzzle-piece",
    title: "Skills查看器",
    itemClass: "action-item skills-viewer-item",
    handler: () => showSkillsViewer(),
  },
  formatAssistant: {
    id: "formatAssistant",
    icon: "ph:text-align-left",
    title: "排版助手",
    itemClass: "action-item format-assistant-item",
    handler: () => emitCustomEvent("openFormatAssistant"),
  },
}

const visibleShortcuts = computed(() =>
  statusBarShortcuts.value
    .filter((id) => id in SHORTCUT_DISPLAY)
    .map((id) => SHORTCUT_DISPLAY[id]),
)

const handleToggleStatusBar = async (id: string) => {
  const idx = statusBarShortcuts.value.indexOf(id)
  if (idx === -1) {
    statusBarShortcuts.value = [...statusBarShortcuts.value, id]
  } else {
    statusBarShortcuts.value = statusBarShortcuts.value.filter((s) => s !== id)
  }
  await storage.save("statusBar-shortcuts", statusBarShortcuts.value)
}

storage.load<string[]>("statusBar-shortcuts").then((data) => {
  if (data) statusBarShortcuts.value = data
})

const showFeatureDrawer = ref(false)

const toggleFeatureDrawer = () => {
  showFeatureDrawer.value = !showFeatureDrawer.value
}

const handleSelectFeature = (id: string) => {
  showFeatureDrawer.value = false
  if (id in SHORTCUT_DISPLAY) {
    SHORTCUT_DISPLAY[id].handler()
    return
  }
  if (id === "superPanel") {
    emitCustomEvent("toggleSuperPanel")
  }
}
</script>
