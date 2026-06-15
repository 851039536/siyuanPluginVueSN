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
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
              >
                <path
                  fill="currentColor"
                  d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                />
              </svg>
            </button>
          </div>
        </div>
        <div class="feature-drawer-search">
          <Icon icon="ph:magnifying-glass" :width="14" class="search-icon" />
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
            <svg width="12" height="12" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
              />
            </svg>
          </button>
        </div>
        <!-- 分类标签栏 -->
        <div
          v-if="!searchQuery && groupTabs.length > 1"
          class="feature-drawer-tabs"
        >
          <button
            v-for="tab in groupTabs"
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
          <div
            v-for="item in displayItems"
            :key="item.id"
            class="feature-drawer-item"
            @click="handleClick(item.id)"
          >
            <div
              class="feature-drawer-item-icon"
              :style="{ color: item.color }"
            >
              <Icon
                :icon="item.icon"
                :width="25"
              />
            </div>
            <span class="feature-drawer-item-title">{{ item.title }}</span>
            <span
              v-if="item.pinnable"
              class="feature-drawer-item-badge badge-pin"
              :class="{ active: statusBarVisible.includes(item.id) }"
              :title="statusBarVisible.includes(item.id) ? '取消固定' : '固定到状态栏'"
              @click.stop="emit('toggleStatusBar', item.id)"
            >
              <Icon
                :icon="statusBarVisible.includes(item.id) ? 'ph:push-pin-simple-fill' : 'ph:push-pin-simple'"
                :width="12"
              />
            </span>
            <span
              class="feature-drawer-item-badge badge-rarely"
              title="标记为不常用"
              @click.stop="emit('toggleRarelyUsed', item.id)"
            >
              <Icon icon="ph:eye-slash" :width="12" />
            </span>
          </div>
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
            <div
              v-for="item in filteredRarelyItems"
              :key="item.id"
              class="feature-drawer-item"
              @click="handleClick(item.id)"
            >
              <div
                class="feature-drawer-item-icon"
                :style="{ color: item.color }"
              >
                <Icon
                  :icon="item.icon"
                  :width="25"
                />
              </div>
              <span class="feature-drawer-item-title">{{ item.title }}</span>
              <span
                v-if="item.pinnable"
                class="feature-drawer-item-badge badge-pin"
                :class="{ active: statusBarVisible.includes(item.id) }"
                :title="statusBarVisible.includes(item.id) ? '取消固定' : '固定到状态栏'"
                @click.stop="emit('toggleStatusBar', item.id)"
              >
                <Icon
                  :icon="statusBarVisible.includes(item.id) ? 'ph:push-pin-simple-fill' : 'ph:push-pin-simple'"
                  :width="12"
                />
              </span>
              <span
                class="feature-drawer-item-badge badge-rarely active"
                title="恢复为常用"
                @click.stop="emit('toggleRarelyUsed', item.id)"
              >
                <Icon icon="ph:eye-slash" :width="12" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
import { computed, ref, watch } from "vue"

export interface FeatureDrawerItem {
  id: string
  icon: string
  color: string
  title: string
  pinnable: boolean
  group?: string
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
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const gridMode = ref(true)
const rarelyExpanded = ref(false)
const searchQuery = ref("")
const activeGroup = ref("__all__")

// 当有"不常用"项被移除变为空时自动折叠
const hasRarelyUsed = computed(() =>
  props.rarelyUsedItems && props.rarelyUsedItems.length > 0,
)

watch(hasRarelyUsed, (val) => {
  if (!val) {
    rarelyExpanded.value = false
  }
})

// 搜索过滤
const matchSearch = (item: FeatureDrawerItem) => {
  if (!searchQuery.value) return true
  const q = searchQuery.value.toLowerCase()
  return item.title.toLowerCase().includes(q)
    || (item.group && item.group.toLowerCase().includes(q))
}

const filteredItems = computed(() =>
  props.items.filter(matchSearch),
)

const filteredRarelyItems = computed(() =>
  (props.rarelyUsedItems || []).filter(matchSearch),
)

// 从所有项提取唯一分组标签
const allGroups = computed(() => {
  const set = new Set<string>()
  for (const item of props.items) {
    if (item.group) set.add(item.group)
  }
  return [...set].sort()
})

// 标签栏选项
const groupTabs = computed(() => {
  const tabs: { key: string; label: string }[] = [
    { key: "__all__", label: "全部" },
  ]
  for (const g of allGroups.value) {
    tabs.push({ key: g, label: g })
  }
  return tabs
})

// 按 activeGroup 过滤（非搜索模式），搜索时忽略分组
const displayItems = computed(() => {
  if (searchQuery.value) return filteredItems.value
  if (activeGroup.value === "__all__") return props.items
  return props.items.filter((item) => item.group === activeGroup.value)
})

const handleClick = (id: string) => {
  emit("select", id)
}
</script>
