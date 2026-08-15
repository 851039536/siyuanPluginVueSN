<!-- 功能抽屉面板：网格/列表展示所有功能入口，支持搜索、分组、固定角标 -->
<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="feature-drawer-overlay"
      @click="emit('close')"
    />
    <Transition name="drawer-slide">
      <div
        v-if="visible"
        class="feature-drawer"
      >
        <div class="feature-drawer-header">
          <span class="feature-drawer-title">功能列表</span>
          <div class="feature-drawer-header-actions">
            <button
              class="feature-drawer-view-btn"
              :title="gridMode ? '切换为列表' : '切换为网格'"
              @click="gridMode = !gridMode"
            >
              <svg
                v-if="gridMode"
                width="14"
                height="14"
                viewBox="0 0 24 24"
              >
                <path
                  fill="currentColor"
                  d="M3 4h4v4H3V4zm6 0h4v4H9V4zm6 0h4v4h-4V4zM3 10h4v4H3v-4zm6 0h4v4H9v-4zm6 0h4v4h-4v-4zM3 16h4v4H3v-4zm6 0h4v4H9v-4zm6 0h4v4h-4v-4z"
                />
              </svg>
              <svg
                v-else
                width="14"
                height="14"
                viewBox="0 0 24 24"
              >
                <path
                  fill="currentColor"
                  d="M3 4h18v2H3V4zm0 7h18v2H3v-2zm0 7h18v2H3v-2z"
                />
              </svg>
            </button>
            <button
              class="feature-drawer-close"
              @click="emit('close')"
            >
              <Icon
                icon="ph:x"
                :width="14"
              />
            </button>
          </div>
        </div>
        <div class="feature-drawer-search">
          <Icon
            icon="ph:magnifying-glass"
            :width="14"
            class="search-icon"
          />
          <input
            v-model="searchQuery"
            type="text"
            class="search-input"
            placeholder="搜索功能..."
            @keydown.escape="searchQuery = ''"
          />
          <button
            v-if="searchQuery"
            class="search-clear"
            @click="searchQuery = ''"
          >
            <Icon
              icon="ph:x"
              :width="12"
            />
          </button>
        </div>
        <!-- 分类标签栏（全部 / 已固定 / 未固定） -->
        <div
          v-if="!searchQuery"
          class="feature-drawer-tabs"
        >
          <button
            v-for="tab in pinTabs"
            :key="tab.key"
            class="feature-drawer-tab"
            :class="{ active: activeGroup === tab.key }"
            @click="activeGroup = tab.key"
          >
            {{ tab.label }}
          </button>
        </div>
        <div
          class="feature-drawer-list"
          :class="{ 'grid-mode': gridMode }"
        >
          <DrawerFeatureItem
            v-for="item in displayItems"
            :key="item.id"
            :item="item"
            :status-bar-visible="statusBarVisible"
            @select="handleClick"
            @toggle-status-bar="emit('toggleStatusBar', $event)"
            @toggle-rarely-used="emit('toggleRarelyUsed', $event)"
            @toggle-enabled="emit('toggleEnabled', $event)"
          />
          <div
            v-if="displayItems.length === 0"
            class="feature-drawer-empty"
          >
            {{ searchQuery ? '未找到匹配功能' : '暂无功能' }}
          </div>
        </div>
        <div
          v-if="filteredRarelyItems.length"
          class="feature-drawer-rarely"
        >
          <button
            class="feature-drawer-rarely-header"
            :class="{ collapsed: !rarelyExpanded }"
            @click="rarelyExpanded = !rarelyExpanded"
          >
            <Icon
              icon="ph:caret-down-bold"
              :width="12"
              class="feature-drawer-rarely-caret"
            />
            <span>不常用 ({{ filteredRarelyItems.length }})</span>
          </button>
          <div
            v-show="rarelyExpanded"
            class="feature-drawer-list rarely-list"
            :class="{ 'grid-mode': gridMode }"
          >
            <DrawerFeatureItem
              v-for="item in filteredRarelyItems"
              :key="item.id"
              :item="item"
              :status-bar-visible="statusBarVisible"
              mode="rarely"
              @select="handleClick"
              @toggle-status-bar="emit('toggleStatusBar', $event)"
              @toggle-rarely-used="emit('toggleRarelyUsed', $event)"
              @toggle-enabled="emit('toggleEnabled', $event)"
            />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
import {
  computed,
  ref,
  watch,
} from "vue"
import DrawerFeatureItem from "./DrawerFeatureItem.vue"

export interface FeatureDrawerItem {
  id: string
  icon: string
  color: string
  title: string
  pinnable: boolean
  group?: string
  enabled?: boolean
  toggleable?: boolean
}

interface Props {
  visible: boolean
  items: FeatureDrawerItem[]
  rarelyUsedItems?: FeatureDrawerItem[]
  statusBarVisible?: string[]
}

interface Emits {
  (e: "close"): void
  (e: "select", id: string): void
  (e: "toggleStatusBar", id: string): void
  (e: "toggleRarelyUsed", id: string): void
  (e: "toggleEnabled", id: string): void
}

const props = withDefaults(defineProps<Props>(), {
  rarelyUsedItems: () => [],
  statusBarVisible: () => [],
})
const emit = defineEmits<Emits>()

const gridMode = ref(true)
const rarelyExpanded = ref(false)
const searchQuery = ref("")
const activeGroup = ref("__all__")

// 当有"不常用"项被移除变为空时自动折叠
const hasRarelyUsed = computed(() => props.rarelyUsedItems.length > 0)

watch(hasRarelyUsed, (val) => {
  if (!val) {
    rarelyExpanded.value = false
  }
})

// 关闭抽屉时重置搜索状态和分组，避免残留状态导致下次打开时显示不完整
watch(() => props.visible, (val) => {
  if (!val) {
    searchQuery.value = ""
    activeGroup.value = "__all__"
  }
})

// 缓存小写搜索词，避免 matchSearch 每次过滤时重复 toLowerCase()
const searchQueryLower = computed(() => searchQuery.value.toLowerCase())

// 搜索过滤
const matchSearch = (item: FeatureDrawerItem) => {
  if (!searchQuery.value) return true
  const q = searchQueryLower.value
  return item.title.toLowerCase().includes(q)
    || (item.group && item.group.toLowerCase().includes(q))
}

const filteredItems = computed(() =>
  props.items.filter(matchSearch),
)

const filteredRarelyItems = computed(() =>
  props.rarelyUsedItems.filter(matchSearch),
)

// 分类标签栏：按固定状态 + 监控分组分为四个固定 Tab
const pinTabs: { key: string, label: string }[] = [
  {
    key: "__all__",
    label: "全部",
  },
  {
    key: "pinned",
    label: "已固定",
  },
  {
    key: "unpinned",
    label: "未固定",
  },
  {
    key: "monitor",
    label: "监控",
  },
]

// 监控项判定：监控项有独立「监控」Tab，不混入固定状态分类
const isMonitor = (item: FeatureDrawerItem) => item.group === "监控"

// 按分类过滤（非搜索模式），搜索时忽略分类
// "全部"/"已固定"/"未固定"排除监控项；"监控"仅显示监控项
const displayItems = computed(() => {
  if (searchQuery.value) return filteredItems.value
  if (activeGroup.value === "pinned") {
    return props.items.filter((item) =>
      !isMonitor(item) && props.statusBarVisible.includes(item.id))
  }
  if (activeGroup.value === "unpinned") {
    return props.items.filter((item) =>
      !isMonitor(item) && !props.statusBarVisible.includes(item.id))
  }
  if (activeGroup.value === "monitor") {
    return props.items.filter(isMonitor)
  }
  return props.items.filter((item) => !isMonitor(item)) // "__all__"
})

const handleClick = (id: string) => {
  emit("select", id)
}
</script>
