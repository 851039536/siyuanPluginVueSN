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
      v-for="task in activeTasks"
      :key="task.id"
      :icon="task.icon"
      item-class="status-bar-task-item"
      :title="task.tooltip"
      :level="task.level"
    >
      {{ task.display }}
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
      :items="drawerPartition.frequent"
      :rarely-used-items="drawerPartition.rarely"
      :status-bar-visible="statusBarShortcuts"
      @close="showFeatureDrawer = false"
      @select="handleSelectFeature"
      @toggle-status-bar="handleToggleStatusBar"
      @toggle-rarely-used="handleToggleRarelyUsed"
    />
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import type { Ref } from "vue"
import type { FeatureDrawerItem } from "./components/FeatureDrawer.vue"
import {
  computed,
  ref,
} from "vue"
import { emitCustomEvent } from "@/utils/eventBus"
import { PluginStorage } from "@/utils/pluginStorage"
import { showEverythingSearch } from "../everythingSearch"
import { showImageCreation } from "../imageCreation"
import { showPasswordVault } from "../passwordVault/types"
import { showSkillsViewer } from "../skillsViewer/types"
import { showWebsiteNavigation } from "../websiteNavigation/types"
import FeatureDrawer from "./components/FeatureDrawer.vue"
import MonitorItem from "./components/MonitorItem.vue"
import { useStatusBar } from "./composables/useStatusBar"
import { activeTasks } from "./composables/useStatusBarTask"

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
const rarelyUsedFeatures = ref<string[]>([])

// 单一功能注册表：抽屉展示 + 状态栏快捷 + 点击动作的统一数据源
// 添加新功能只需在此处新增一条；title / 处理逻辑不再分散于多处
interface FeatureRegistryEntry extends FeatureDrawerItem {
  // 状态栏快捷项，缺省则不在状态栏显示
  shortcut?: { icon: string, itemClass: string }
  // 点击（抽屉选中或快捷点击）触发的动作
  action: () => void
}

const FEATURES: FeatureRegistryEntry[] = [
  {
    id: "superPanel",
    icon: "mdi:view-dashboard",
    color: "#3b82f6",
    title: "超级面板",
    pinnable: false,
    action: () => emitCustomEvent("toggleSuperPanel"),
  },
  {
    id: "video",
    icon: "mdi:video",
    color: "#6366f1",
    title: "视频管理器",
    pinnable: true,
    shortcut: {
      icon: "ph:video",
      itemClass: "action-item video-manager-item",
    },
    action: () => emitCustomEvent("openVideoManager"),
  },
  {
    id: "passwordVault",
    icon: "mdi:lock",
    color: "#22c55e",
    title: "密码箱",
    pinnable: true,
    shortcut: {
      icon: "ph:lock-key",
      itemClass: "action-item password-vault-item",
    },
    action: () => showPasswordVault(),
  },
  {
    id: "skillsViewer",
    icon: "mdi:puzzle",
    color: "#f59e0b",
    title: "Skills 查看器",
    pinnable: true,
    shortcut: {
      icon: "ph:puzzle-piece",
      itemClass: "action-item skills-viewer-item",
    },
    action: () => showSkillsViewer(),
  },
  {
    id: "htmlViewer",
    icon: "mdi:language-html5",
    color: "#e67e22",
    title: "HTML 展示",
    pinnable: true,
    shortcut: {
      icon: "ph:code",
      itemClass: "action-item html-viewer-item",
    },
    action: () => emitCustomEvent("openHtmlViewer"),
  },
  {
    id: "formatAssistant",
    icon: "mdi:format-align-left",
    color: "#07c160",
    title: "排版助手",
    pinnable: true,
    shortcut: {
      icon: "ph:text-align-left",
      itemClass: "action-item format-assistant-item",
    },
    action: () => emitCustomEvent("openFormatAssistant"),
  },
  {
    id: "websiteNavigation",
    icon: "mdi:link-variant",
    color: "#8b5cf6",
    title: "网站导航",
    pinnable: true,
    shortcut: {
      icon: "ph:link",
      itemClass: "action-item website-navigation-item",
    },
    action: () => showWebsiteNavigation(props.plugin),
  },
  {
    id: "imageCreation",
    icon: "mdi:image-text",
    color: "#f59e0b",
    title: "图片生成",
    pinnable: false,
    shortcut: {
      icon: "ph:image-square",
      itemClass: "action-item image-creation-item",
    },
    action: () => showImageCreation(),
  },
  {
    id: "dataBackup",
    icon: "mdi:backup-restore",
    color: "#10b981",
    title: props.plugin?.i18n?.dataBackup || "数据备份",
    pinnable: true,
    shortcut: {
      icon: "mdi:backup-restore",
      itemClass: "action-item data-backup-item",
    },
    action: () => emitCustomEvent("openDataBackup"),
  },
  {
    id: "everythingSearch",
    icon: "ph:binoculars",
    color: "#d97706",
    title: "Everything 搜索",
    pinnable: true,
    shortcut: {
      icon: "ph:binoculars",
      itemClass: "action-item everything-search-item",
    },
    action: () => showEverythingSearch(),
  },
]

// id → 功能映射，用于点击分发（O(1) 取代 `id in SHORTCUT_DISPLAY` + superPanel 特判）
const featureMap = new Map(FEATURES.map((f) => [f.id, f]))

// 状态栏快捷：按 statusBarShortcuts 顺序映射出可渲染项（含 title / handler）
const visibleShortcuts = computed(() => {
  const result: { id: string, icon: string, title: string, itemClass: string, handler: () => void }[] = []
  for (const id of statusBarShortcuts.value) {
    const f = featureMap.get(id)
    if (f?.shortcut) {
      result.push({
        id: f.id,
        icon: f.shortcut.icon,
        title: f.title,
        itemClass: f.shortcut.itemClass,
        handler: f.action,
      })
    }
  }
  return result
})

// 抽屉常用/不常用一次遍历拆分（取代两个独立 filter）
const drawerPartition = computed(() => {
  const frequent: FeatureDrawerItem[] = []
  const rarely: FeatureDrawerItem[] = []
  const rareSet = new Set(rarelyUsedFeatures.value)
  for (const {
    shortcut: _,
    action: __,
    ...drawerItem
  } of FEATURES) {
    ;(rareSet.has(drawerItem.id) ? rarely : frequent).push(drawerItem)
  }
  return {
    frequent,
    rarely,
  }
})

// 切换数组归属（存在则移除，不存在则追加）
const toggleMembership = (target: Ref<string[]>, id: string) =>
  target.value.includes(id)
    ? target.value.filter((s) => s !== id)
    : [...target.value, id]

const handleToggleStatusBar = async (id: string) => {
  statusBarShortcuts.value = toggleMembership(statusBarShortcuts, id)
  await storage.save("statusBar-shortcuts", statusBarShortcuts.value)
}

const handleToggleRarelyUsed = async (id: string) => {
  const wasRare = rarelyUsedFeatures.value.includes(id)
  rarelyUsedFeatures.value = toggleMembership(rarelyUsedFeatures, id)
  if (!wasRare) {
    // 标记为不常用后，从状态栏固定中移除
    statusBarShortcuts.value = statusBarShortcuts.value.filter((s) => s !== id)
    await storage.save("statusBar-shortcuts", statusBarShortcuts.value)
  }
  await storage.save("statusBar-rarelyUsed", rarelyUsedFeatures.value)
}

storage.load<string[]>("statusBar-shortcuts").then((data) => {
  if (data) statusBarShortcuts.value = data
})

storage.load<string[]>("statusBar-rarelyUsed").then((data) => {
  if (data) rarelyUsedFeatures.value = data
})

const showFeatureDrawer = ref(false)

const toggleFeatureDrawer = () => {
  showFeatureDrawer.value = !showFeatureDrawer.value
}

const handleSelectFeature = (id: string) => {
  showFeatureDrawer.value = false
  featureMap.get(id)?.action()
}
</script>
