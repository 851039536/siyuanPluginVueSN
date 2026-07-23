<!-- 状态栏主面板：监控项展示、快捷入口、功能抽屉容器 -->
<template>
  <div
    v-show="state.showMonitor"
    class="status__resUsage"
    :title="systemInfoTooltip"
  >
    <MonitorItem
      v-if="visibleMonitors.has('monitor-notes')"
      item-class="statistics-item notes-item"
      :title="statisticsTooltip"
    >
      {{ totalNotesDisplay }}
    </MonitorItem><!--
    --><MonitorItem
v-if="visibleMonitors.has('monitor-words')"
item-class="statistics-item words-item"
:title="statisticsTooltip"
>
{{ totalWordsDisplay }}
    </MonitorItem><!--
    --><MonitorItem
v-if="visibleMonitors.has('monitor-today')"
item-class="statistics-item today-activity-item"
:title="todayTooltip"
>
{{ todayActivityDisplay }}
    </MonitorItem><!--
    --><MonitorItem
v-if="visibleMonitors.has('monitor-cpu')"
item-class="cpu-item"
:level="cpuLevel"
>
{{ cpuUsageDisplay }}
    </MonitorItem><!--
    --><MonitorItem
v-if="visibleMonitors.has('monitor-memory')"
item-class="mem-item"
:level="memLevel"
>
{{ memoryUsageDisplay }}
    </MonitorItem><!--
    --><MonitorItem
v-if="visibleMonitors.has('monitor-uptime')"
item-class="uptime-item"
>
{{ uptimeDisplay }}
</MonitorItem>

    <span
      v-if="showSeparator"
      class="status-bar-separator"
    />

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
      :status-bar-visible="statusBarVisible"
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
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
} from "vue"
import { featureIdToSettingKey } from "@/config/settings"
import { emitCustomEvent } from "@/utils/eventBus"
import { PluginStorage } from "@/utils/pluginStorage"
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
const visibleMonitors = reactive(new Set<string>())

// 监控项 ID 集合（用于 handleToggleStatusBar 分流判断）
const MONITOR_IDS = new Set([
  "monitor-notes",
  "monitor-words",
  "monitor-today",
  "monitor-cpu",
  "monitor-memory",
  "monitor-uptime",
])
const DEFAULT_MONITOR_IDS = [...MONITOR_IDS]

// 单一功能注册表：抽屉展示 + 状态栏快捷 + 点击动作的统一数据源
// 添加新功能只需在此处新增一条；title / 处理逻辑不再分散于多处
interface FeatureRegistryEntry extends FeatureDrawerItem {
  // 状态栏快捷项，缺省则不在状态栏显示
  shortcut?: { icon: string, itemClass: string }
  // 点击（抽屉选中或快捷点击）触发的动作（监控项无动作）
  action?: () => void
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
    action: () => emitCustomEvent("openPasswordVault"),
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
    action: () => emitCustomEvent("toggleSkillsViewer"),
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
    action: () => emitCustomEvent("toggleWebsiteNavigation"),
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
    action: () => emitCustomEvent("openImageCreation"),
  },
  {
    id: "s3Backup",
    icon: "mdi:cloud-upload",
    color: "#f59e0b",
    title: props.plugin?.i18n?.s3Backup || "S3 备份",
    pinnable: true,
    shortcut: {
      icon: "mdi:cloud-upload",
      itemClass: "action-item s3-backup-item",
    },
    action: () => emitCustomEvent("openS3Backup"),
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
    action: () => emitCustomEvent("openEverythingSearch"),
  },
  {
    id: "imageCompressor",
    icon: "mdi:image",
    color: "#ef4444",
    title: props.plugin?.i18n?.imageCompressor?.title || "图片压缩",
    pinnable: true,
    shortcut: {
      icon: "ph:image",
      itemClass: "action-item image-compressor-item",
    },
    action: () => emitCustomEvent("openImageCompressor"),
  },
  {
    id: "toolCollection",
    icon: "mdi:toolbox-outline",
    color: "#6366f1",
    title: props.plugin?.i18n?.toolCollection || "工具合集",
    pinnable: true,
    shortcut: {
      icon: "mdi:toolbox-outline",
      itemClass: "action-item tool-collection-item",
    },
    action: () => emitCustomEvent("toggleToolCollection"),
  },
  {
    id: "bookmarkMarker",
    icon: "mdi:bookmark-multiple",
    color: "#10b981",
    title: props.plugin?.i18n?.bookmarkMarker?.title || "书签标记",
    pinnable: true,
    shortcut: {
      icon: "ph:bookmark-simple",
      itemClass: "action-item bookmark-marker-item",
    },
    action: () => emitCustomEvent("openBookmarkMarker"),
  },
  // ========== 状态栏监控项（可固定控制显隐） ==========
  {
    id: "monitor-notes",
    icon: "ph:file-text",
    color: "#3b82f6",
    title: props.plugin?.i18n?.statusBar?.monitorNotes || "文档数",
    pinnable: true,
    group: "监控",
  },
  {
    id: "monitor-words",
    icon: "ph:text-aa",
    color: "#8b5cf6",
    title: props.plugin?.i18n?.statusBar?.monitorWords || "总字数",
    pinnable: true,
    group: "监控",
  },
  {
    id: "monitor-today",
    icon: "ph:chart-line-up",
    color: "#22c55e",
    title: props.plugin?.i18n?.statusBar?.monitorToday || "今日活动",
    pinnable: true,
    group: "监控",
  },
  {
    id: "monitor-cpu",
    icon: "ph:cpu",
    color: "#ef4444",
    title: props.plugin?.i18n?.statusBar?.monitorCpu || "CPU 使用率",
    pinnable: true,
    group: "监控",
  },
  {
    id: "monitor-memory",
    icon: "ph:memory",
    color: "#f59e0b",
    title: props.plugin?.i18n?.statusBar?.monitorMemory || "内存使用",
    pinnable: true,
    group: "监控",
  },
  {
    id: "monitor-uptime",
    icon: "ph:timer",
    color: "#6b7280",
    title: props.plugin?.i18n?.statusBar?.monitorUptime || "运行时间",
    pinnable: true,
    group: "监控",
  },
]

// id → 功能映射，用于点击分发（O(1) 取代 `id in SHORTCUT_DISPLAY` + superPanel 特判）
const featureMap = new Map(FEATURES.map((f) => [f.id, f]))

// 功能开关快照：superPanel 关闭某功能后，抽屉与快捷入口应同步隐藏
const enabledSettings = ref<Record<string, any>>({ ...(props.plugin as any).settings })

// superPanel 恒启用；监控项无功能开关恒显示；其余按 enableXxx 判定（缺省视为启用）
const isFeatureEnabled = (id: string): boolean => {
  if (id === "superPanel" || MONITOR_IDS.has(id)) return true
  return enabledSettings.value[featureIdToSettingKey(id)] !== false
}

// 状态栏快捷：按 statusBarShortcuts 顺序映射出可渲染项（含 title / handler）
const visibleShortcuts = computed(() => {
  const result: { id: string, icon: string, title: string, itemClass: string, handler: (() => void) | undefined }[] = []
  for (const id of statusBarShortcuts.value) {
    if (!isFeatureEnabled(id)) continue
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

// 分隔线显隐：监控项有可见 且 快捷入口或后台任务有可见时才显示
const showSeparator = computed(() =>
  visibleMonitors.size > 0
  && (visibleShortcuts.value.length > 0 || activeTasks.value.length > 0),
)

// 合并快捷方式 + 监控项可见性，供 FeatureDrawer 显示 pin 状态
const statusBarVisible = computed(() => [
  ...statusBarShortcuts.value,
  ...visibleMonitors,
])

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
    if (!isFeatureEnabled(drawerItem.id)) continue
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

// 按分类（监控/功能）保存状态，消除 handleToggleStatusBar 与 handleToggleRarelyUsed 中的重复 save 模式
const saveCategory = async (id: string) => {
  if (MONITOR_IDS.has(id)) {
    await storage.save("statusBar-monitors", [...visibleMonitors])
  } else {
    await storage.save("statusBar-shortcuts", statusBarShortcuts.value)
  }
}

const handleToggleStatusBar = async (id: string) => {
  if (MONITOR_IDS.has(id)) {
    if (visibleMonitors.has(id)) {
      visibleMonitors.delete(id)
    } else {
      visibleMonitors.add(id)
    }
  } else {
    statusBarShortcuts.value = toggleMembership(statusBarShortcuts, id)
  }
  await saveCategory(id)
}

const handleToggleRarelyUsed = async (id: string) => {
  const wasRare = rarelyUsedFeatures.value.includes(id)
  rarelyUsedFeatures.value = toggleMembership(rarelyUsedFeatures, id)
  if (!wasRare) {
    if (MONITOR_IDS.has(id)) {
      visibleMonitors.delete(id)
    } else {
      statusBarShortcuts.value = statusBarShortcuts.value.filter((s) => s !== id)
    }
    await saveCategory(id)
  }
  await storage.save("statusBar-rarelyUsed", rarelyUsedFeatures.value)
}

storage.load<string[]>("statusBar-shortcuts").then((data) => {
  if (data) statusBarShortcuts.value = data
})

storage.load<string[]>("statusBar-rarelyUsed").then((data) => {
  if (data) rarelyUsedFeatures.value = data
})

// 加载监控项可见性偏好：有存储数据则按存储，否则默认全显
storage.load<string[]>("statusBar-monitors").then((data) => {
  if (data && data.length > 0) {
    for (const id of data) visibleMonitors.add(id)
  } else {
    for (const id of DEFAULT_MONITOR_IDS) visibleMonitors.add(id)
  }
})

const showFeatureDrawer = ref(false)

const toggleFeatureDrawer = () => {
  showFeatureDrawer.value = !showFeatureDrawer.value
}

const handleSelectFeature = (id: string) => {
  showFeatureDrawer.value = false
  featureMap.get(id)?.action?.()
}

// 监听设置变更事件，同步功能开关快照（statusBar 为独立挂载 app，需自行清理监听）
const syncEnabled = () => {
  enabledSettings.value = { ...(props.plugin as any).settings }
}
onMounted(() => window.addEventListener("settingsUpdated", syncEnabled))
onBeforeUnmount(() => window.removeEventListener("settingsUpdated", syncEnabled))
</script>
