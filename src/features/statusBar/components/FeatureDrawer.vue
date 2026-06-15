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
        <div
          class="feature-drawer-list"
          :class="{ 'grid-mode': gridMode }"
        >
          <div
            v-for="item in items"
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
            <button
              v-if="item.pinnable"
              class="feature-drawer-item-pin"
              :class="{ pinned: statusBarVisible.includes(item.id) }"
              :title="statusBarVisible.includes(item.id) ? '取消固定' : '固定到状态栏'"
              @click.stop="emit('toggleStatusBar', item.id)"
            >
              <Icon
                :icon="statusBarVisible.includes(item.id) ? 'mdi:pin' : 'mdi:pin-off-outline'"
                :width="14"
              />
            </button>
            <button
              class="feature-drawer-item-bookmark"
              title="标记为不常用"
              @click.stop="emit('toggleRarelyUsed', item.id)"
            >
              <Icon
                icon="ph:bookmark-simple"
                :width="14"
              />
            </button>
          </div>
        </div>
        <div
          v-if="rarelyUsedItems && rarelyUsedItems.length"
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
            <span>不常用 ({{ rarelyUsedItems.length }})</span>
          </button>
          <div
            v-show="rarelyExpanded"
            class="feature-drawer-list rarely-list"
            :class="{ 'grid-mode': gridMode }"
          >
            <div
              v-for="item in rarelyUsedItems"
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
              <button
                v-if="item.pinnable"
                class="feature-drawer-item-pin"
                :class="{ pinned: statusBarVisible.includes(item.id) }"
                :title="statusBarVisible.includes(item.id) ? '取消固定' : '固定到状态栏'"
                @click.stop="emit('toggleStatusBar', item.id)"
              >
                <Icon
                  :icon="statusBarVisible.includes(item.id) ? 'mdi:pin' : 'mdi:pin-off-outline'"
                  :width="14"
                />
              </button>
              <button
                class="feature-drawer-item-bookmark marked"
                title="恢复为常用"
                @click.stop="emit('toggleRarelyUsed', item.id)"
              >
                <Icon
                  icon="ph:bookmark-simple-fill"
                  :width="14"
                />
              </button>
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
const rarelyExpanded = ref(true)

// 当有"不常用"项被移除变为空时自动折叠
const hasRarelyUsed = computed(() =>
  props.rarelyUsedItems && props.rarelyUsedItems.length > 0,
)

watch(hasRarelyUsed, (val) => {
  if (!val) {
    rarelyExpanded.value = false
  }
})

const handleClick = (id: string) => {
  emit("select", id)
}
</script>
