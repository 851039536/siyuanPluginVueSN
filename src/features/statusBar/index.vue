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
      :items="drawerItems"
      :status-bar-visible="statusBarVisible"
      :category-manager="categoryManager"
      @close="showFeatureDrawer = false"
      @select="handleSelectFeature"
      @toggle-status-bar="handleToggleStatusBar"
      @assign-category="openAssignMenu"
      @toggle-enabled="handleToggleEnabled"
    />

    <!-- 分类分配弹出菜单 -->
    <CategoryAssignMenu
      :visible="assignMenu.visible"
      :categories="categoryManager.categories.value"
      :current-id="assignMenu.featureId ? categoryManager.categoryOf(assignMenu.featureId) : null"
      :x="assignMenu.x"
      :y="assignMenu.y"
      @close="assignMenu.visible = false"
      @select="handleAssignSelect"
    />
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import type { Ref } from "vue"
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
import CategoryAssignMenu from "./components/CategoryAssignMenu.vue"
import FeatureDrawer from "./components/FeatureDrawer.vue"
import MonitorItem from "./components/MonitorItem.vue"
import { useFeatureCategories } from "./composables/useFeatureCategories"
import { useStatusBar } from "./composables/useStatusBar"
import { activeTasks } from "./composables/useStatusBarTask"
import { createFeatureRegistry } from "./featureRegistry"

const props = defineProps<{
  plugin: Plugin
}>()

const storage = new PluginStorage(props.plugin)

// 单一功能注册表：抽屉展示 + 状态栏快捷 + 点击动作的统一数据源（详见 featureRegistry.ts）
const { features, MONITOR_IDS, featureMap } = createFeatureRegistry(props.plugin)

// 自定义分类管理：分类 CRUD + 功能归属分配（详见 useFeatureCategories.ts）
const categoryManager = useFeatureCategories(storage)

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
const visibleMonitors = reactive(new Set<string>())

// 功能开关快照：superPanel 关闭某功能后，抽屉与快捷入口应同步隐藏
const enabledSettings = ref<Record<string, any>>({ ...(props.plugin as any).settings })

// superPanel 恒启用；监控项无功能开关恒显示；其余按 enableXxx 判定（缺省视为启用）
const isFeatureEnabled = (id: string): boolean => {
  if (id === "superPanel" || MONITOR_IDS.has(id)) return true
  return enabledSettings.value[featureIdToSettingKey(id)] !== false
}

// 是否有功能开关：排除监控项（无 enableXxx）与无对应设置键的特殊项（superPanel/quickNoteReset）
const hasToggle = (id: string): boolean =>
  !MONITOR_IDS.has(id) && featureIdToSettingKey(id) in enabledSettings.value

// 抽屉条目：注册表剥离快捷/动作字段，附加开关状态与分类归属
const drawerItems = computed(() =>
  features.map(({ shortcut: _, action: __, ...item }) => ({
    ...item,
    enabled: isFeatureEnabled(item.id),
    toggleable: hasToggle(item.id),
    categoryId: categoryManager.categoryOf(item.id),
  })),
)

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

// 切换数组归属（存在则移除，不存在则追加）
const toggleMembership = (target: Ref<string[]>, id: string) =>
  target.value.includes(id)
    ? target.value.filter((s) => s !== id)
    : [...target.value, id]

// 按分类（监控/功能）保存状态，消除 handleToggleStatusBar 中的重复 save 模式
const saveCategory = async (id: string) => {
  if (MONITOR_IDS.has(id)) {
    await storage.save("statusBar-monitors", [...visibleMonitors])
  } else {
    await storage.save("statusBar-shortcuts", statusBarShortcuts.value)
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

storage.load<string[]>("statusBar-shortcuts").then((data) => {
  if (data) statusBarShortcuts.value = data
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

// ============================================================
// 分类分配弹出菜单
// ============================================================

// 菜单尺寸上限（与 .category-assign-menu 的 max-width 对齐，用于视口边界钳制）
const MENU_WIDTH = 240
const MENU_ESTIMATED_HEIGHT = 180

const assignMenu = reactive({
  visible: false,
  x: 0,
  y: 0,
  featureId: "",
})

// 打开分配菜单：定位到分类角标旁，超出视口时向上/向左钳制
const openAssignMenu = (id: string, event: MouseEvent) => {
  const badge = (event.target as HTMLElement).closest?.(".badge-category") as HTMLElement | null
  const rect = badge?.getBoundingClientRect()
  const right = rect?.right ?? event.clientX
  const top = rect?.top ?? event.clientY
  const bottom = rect?.bottom ?? event.clientY
  assignMenu.featureId = id
  assignMenu.x = Math.max(8, Math.min(right, window.innerWidth - MENU_WIDTH - 8))
  assignMenu.y = bottom + 4 + MENU_ESTIMATED_HEIGHT > window.innerHeight
    ? Math.max(8, top - MENU_ESTIMATED_HEIGHT - 4)
    : bottom + 4
  assignMenu.visible = true
}

const handleAssignSelect = (categoryId: string | null) => {
  if (assignMenu.featureId) {
    categoryManager.assignFeature(assignMenu.featureId, categoryId)
  }
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
