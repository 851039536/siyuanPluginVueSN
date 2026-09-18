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
      :color="shortcut.color"
      @click="shortcut.handler"
    />

    <!-- 功能抽屉开关 -->
    <MonitorItem
      icon="gridFour"
      item-class="action-item feature-drawer-item"
      :title="i18n.drawerOpenLabel"
      @click="toggleFeatureDrawer"
    />

    <FeatureDrawer
      :visible="showFeatureDrawer"
      :items="drawerItems"
      :status-bar-visible="statusBarVisible"
      :category-manager="categoryManager"
      :i18n="i18n"
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
      :i18n="i18n"
      @close="assignMenu.visible = false"
      @select="handleAssignSelect"
    />
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue"
import { featureIdToSettingKey } from "@/config/settings"
import CategoryAssignMenu from "./components/CategoryAssignMenu.vue"
import FeatureDrawer from "./components/FeatureDrawer.vue"
import MonitorItem from "./components/MonitorItem.vue"
import { useFeatureCategories } from "./composables/useFeatureCategories"
import { useStatusBar } from "./composables/useStatusBar"
import { activeTasks } from "./composables/useStatusBarTask"
import { createFeatureRegistry } from "./featureRegistry"
import { StatusBarStorage } from "./types/storage"

const props = defineProps<{
  plugin: Plugin
}>()

const storage = new StatusBarStorage(props.plugin)

/** statusBar 分片文案（供子组件消费；避免各组件自行从 plugin 取） */
const i18n = ((props.plugin.i18n as unknown as Record<string, Record<string, string>>)?.statusBar ?? {})

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
} = useStatusBar(i18n)

/**
 * 状态栏固定项（监控项 + 功能快捷项**共用同一份有序列表**）。
 * 监控项的显隐与功能的 pin 本质是同一件事，故合并存储与切换逻辑，不再分两套。
 */
const pinnedIds = ref<string[]>([])
const visibleMonitors = reactive(new Set<string>())

// 功能开关快照：superPanel 关闭某功能后，抽屉与快捷入口应同步隐藏
const enabledSettings = ref<Record<string, unknown>>(
  { ...((props.plugin as unknown as { settings?: Record<string, unknown> }).settings ?? {}) },
)

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
  features.map((entry) => {
    const { shortcut: _shortcut, action: _action, ...item } = entry
    return {
      ...item,
      enabled: isFeatureEnabled(item.id),
      toggleable: hasToggle(item.id),
      categoryId: categoryManager.categoryOf(item.id),
    }
  }),
)

/** 功能快捷项（按 pinnedIds 顺序映射出可渲染项；监控项由 visibleMonitors 单独驱动） */
const visibleShortcuts = computed(() => {
  const result: { id: string, icon: string, color: string, title: string, itemClass: string, handler: (() => void) | undefined }[] = []
  for (const id of pinnedIds.value) {
    if (MONITOR_IDS.has(id)) continue
    if (!isFeatureEnabled(id)) continue
    const f = featureMap.get(id)
    if (f?.shortcut) {
      result.push({
        id: f.id,
        icon: f.shortcut.icon,
        // 品牌色来自 FEATURE_ICONS 真源（不再依赖「itemClass 是否恰好有 SCSS 规则」）
        color: f.color,
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
  ...pinnedIds.value,
  ...visibleMonitors,
])

/** 反转某 id 的固定状态（监控项与功能项统一走同一份列表） */
const togglePinned = (id: string) => {
  pinnedIds.value = pinnedIds.value.includes(id)
    ? pinnedIds.value.filter((s) => s !== id)
    : [...pinnedIds.value, id]
  void storage.shortcuts.save(pinnedIds.value)
}

/** 切换功能在状态栏的显隐（监控项另存 monitors 槽，语义上区分「监控区」与「快捷区」） */
const handleToggleStatusBar = (id: string) => {
  if (MONITOR_IDS.has(id)) {
    if (visibleMonitors.has(id)) {
      visibleMonitors.delete(id)
    } else {
      visibleMonitors.add(id)
    }
    void storage.monitors.save([...visibleMonitors])
    return
  }
  togglePinned(id)
}

// 加载固定项与监控项偏好
void storage.shortcuts.loadOrDefault().then((data) => {
  if (Array.isArray(data)) pinnedIds.value = data
})

// 监控项可见性：有存储数据则按存储，否则默认全显
void storage.monitors.loadOrDefault().then((data) => {
  if (Array.isArray(data) && data.length > 0) {
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

const assignMenu = reactive({
  visible: false,
  x: 0,
  y: 0,
  featureId: "",
})

/**
 * 打开分配菜单：定位到分类角标旁。
 * 锚点由触发按钮自身提供（`currentTarget`），不再依赖 `.badge-category` 类名穿透子组件 DOM
 * —— 后者在子组件改类名时会静默退化为鼠标坐标。
 */
const openAssignMenu = (id: string, event: MouseEvent) => {
  const trigger = event.currentTarget as HTMLElement | null
  const rect = trigger?.getBoundingClientRect()
  assignMenu.featureId = id
  assignMenu.x = rect?.right ?? event.clientX
  assignMenu.y = rect?.bottom ?? event.clientY
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
  const pluginSample = props.plugin as unknown as {
    settings?: Record<string, unknown>
    updateSettings: (s: Record<string, unknown>) => Promise<unknown>
  }
  const current = pluginSample.settings?.[settingKey] !== false
  await pluginSample.updateSettings({
    ...pluginSample.settings,
    [settingKey]: !current,
  })
}

// 监听设置变更事件，同步功能开关快照（statusBar 为独立挂载 app，需自行清理监听）
const syncEnabled = () => {
  enabledSettings.value = {
    ...((props.plugin as unknown as { settings?: Record<string, unknown> }).settings ?? {}),
  }
}
onMounted(() => window.addEventListener("settingsUpdated", syncEnabled))
onBeforeUnmount(() => window.removeEventListener("settingsUpdated", syncEnabled))
</script>
