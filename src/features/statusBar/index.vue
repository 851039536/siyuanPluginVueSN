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

    <!-- 功能抽屉开关 -->
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
      @toggle-enabled="handleToggleEnabled"
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

// 单一功能注册表：抽屉展示 + 状态栏快捷 + 点击动作的统一数据源
// 添加新功能只需在此处新增一条；title / 处理逻辑不再分散于多处
interface FeatureRegistryEntry extends FeatureDrawerItem {
  // 状态栏快捷项，缺省则不在状态栏显示
  shortcut?: { icon: string, itemClass: string }
  // 点击（抽屉选中或快捷点击）触发的动作（监控项无动作）
  action?: () => void
}

// 速记 i18n 分片（思源类型将 i18n 声明为扁平 IObject，嵌套命名空间需显式收窄）
const quickNoteI18n = (props.plugin?.i18n?.quickNote ?? {}) as unknown as Record<string, string>
// 速记恢复 i18n 分片（同上，显式收窄嵌套命名空间）
const quickNoteResetI18n = (props.plugin?.i18n?.quickNoteReset ?? {}) as unknown as Record<string, string>
// 图片生成 i18n 分片（同上，显式收窄嵌套命名空间）
const imageCreationI18n = (props.plugin?.i18n?.imageCreation ?? {}) as unknown as Record<string, string>
// 全局关系列表 i18n 分片（同上，显式收窄嵌套命名空间）
const globalRelationsI18n = (props.plugin?.i18n?.globalRelations ?? {}) as unknown as Record<string, string>

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
    action: () => emitCustomEvent("openSkillsViewer"),
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
    id: "minimalBrowser",
    icon: "mdi:earth",
    color: "#0ea5e9",
    title: props.plugin?.i18n?.minimalBrowser?.title || "极简浏览器",
    pinnable: true,
    shortcut: {
      icon: "mdi:earth",
      itemClass: "action-item minimal-browser-item",
    },
    action: () => emitCustomEvent("openMinimalBrowser"),
  },
  {
    id: "imageCreation",
    icon: "mdi:image-text",
    color: "#f59e0b",
    title: imageCreationI18n.title,
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
    id: "s3FileManager",
    icon: "mdi:folder-network",
    color: "#0ea5e9",
    title: props.plugin?.i18n?.s3FileManager?.s3FileManager || "S3 文件管理",
    pinnable: true,
    shortcut: {
      icon: "mdi:folder-network",
      itemClass: "action-item s3-file-manager-item",
    },
    action: () => emitCustomEvent("openS3FileManager"),
  },
  {
    id: "globalRelations",
    icon: "mdi:relation-many-to-many",
    color: "#06b6d4",
    title: globalRelationsI18n.panelTitle || "全局关系列表",
    pinnable: true,
    shortcut: {
      icon: "mdi:relation-many-to-many",
      itemClass: "action-item global-relations-item",
    },
    action: () => emitCustomEvent("toggleGlobalRelations"),
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
  {
    id: "quickNote",
    icon: "mdi:note-edit-outline",
    color: "#f59e0b",
    title: quickNoteI18n.title,
    pinnable: true,
    shortcut: {
      icon: "ph:note-pencil",
      itemClass: "action-item quick-note-item",
    },
    action: () => emitCustomEvent("toggleQuickNote"),
  },
  // 速记恢复：弹窗卡死/位置异常时的应急兜底，点击即复位为居中展开态
  {
    id: "quickNoteReset",
    icon: "ph:arrow-counter-clockwise",
    color: "#f59e0b",
    title: quickNoteResetI18n.title,
    pinnable: false,
    action: () => emitCustomEvent("resetQuickNote"),
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

// 监控项 ID 集合：由 FEATURES 的 group 字段派生（单一数据源，避免与 group:"监控" 双处维护不同步）
const MONITOR_IDS = new Set(
  FEATURES.filter((f) => f.group === "监控").map((f) => f.id),
)

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

// 是否有功能开关：排除监控项（无 enableXxx）与无对应设置键的特殊项（superPanel/quickNoteReset）
const hasToggle = (id: string): boolean =>
  !MONITOR_IDS.has(id) && featureIdToSettingKey(id) in enabledSettings.value

// 抽屉常用/不常用一次遍历拆分（取代两个独立 filter）
// 不再过滤已关闭功能：关闭的功能置灰显示，保留开关角标供用户重新开启
const drawerPartition = computed(() => {
  const frequent: FeatureDrawerItem[] = []
  const rarely: FeatureDrawerItem[] = []
  const rareSet = new Set(rarelyUsedFeatures.value)
  for (const {
    shortcut: _,
    action: __,
    ...drawerItem
  } of FEATURES) {
    ;(rareSet.has(drawerItem.id) ? rarely : frequent).push({
      ...drawerItem,
      enabled: isFeatureEnabled(drawerItem.id),
      toggleable: hasToggle(drawerItem.id),
    })
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

// 从状态栏移除一个功能（监控项从 Set 删除，功能项从数组过滤）
const removeFromStatusBar = (id: string) => {
  if (MONITOR_IDS.has(id)) {
    visibleMonitors.delete(id)
  } else {
    statusBarShortcuts.value = statusBarShortcuts.value.filter((s) => s !== id)
  }
}

// 切换功能在状态栏的显隐（监控项 toggle Set，功能项 toggle 数组）
const toggleStatusBarMembership = (id: string) => {
  if (MONITOR_IDS.has(id)) {
    if (visibleMonitors.has(id)) {
      visibleMonitors.delete(id)
    } else {
      visibleMonitors.add(id)
    }
  } else {
    statusBarShortcuts.value = toggleMembership(statusBarShortcuts, id)
  }
}

const handleToggleStatusBar = async (id: string) => {
  toggleStatusBarMembership(id)
  await saveCategory(id)
}

const handleToggleRarelyUsed = async (id: string) => {
  const wasRare = rarelyUsedFeatures.value.includes(id)
  rarelyUsedFeatures.value = toggleMembership(rarelyUsedFeatures, id)
  if (!wasRare) {
    removeFromStatusBar(id)
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
    for (const id of MONITOR_IDS) visibleMonitors.add(id)
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

// 切换功能开关：经 plugin.updateSettings 保存（同步 feature-flags + 广播 settingsUpdated），
// enabledSettings 快照由 syncEnabled 监听更新，开关角标随之同步
const handleToggleEnabled = async (id: string) => {
  const settingKey = featureIdToSettingKey(id)
  const pluginSample = props.plugin as any
  const current = pluginSample.settings?.[settingKey] !== false
  await pluginSample.updateSettings({
    ...pluginSample.settings,
    [settingKey]: !current,
  })
}

// 监听设置变更事件，同步功能开关快照（statusBar 为独立挂载 app，需自行清理监听）
const syncEnabled = () => {
  enabledSettings.value = { ...(props.plugin as any).settings }
}
onMounted(() => window.addEventListener("settingsUpdated", syncEnabled))
onBeforeUnmount(() => window.removeEventListener("settingsUpdated", syncEnabled))
</script>
