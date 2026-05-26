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
            v-for="item in featureList"
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
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
import { ref } from "vue"

interface FeatureItem {
  id: string
  icon: string
  color: string
  title: string
}

interface Props {
  visible: boolean
}

interface Emits {
  (e: "close"): void
  (e: "select", id: string): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const gridMode = ref(true)

const featureList: FeatureItem[] = [
  {
    id: "superPanel",
    icon: "mdi:view-dashboard",
    color: "#3b82f6",
    title: "超级面板",
  },
  {
    id: "video",
    icon: "mdi:video",
    color: "#6366f1",
    title: "视频管理器",
  },
  {
    id: "passwordVault",
    icon: "mdi:lock",
    color: "#22c55e",
    title: "密码箱",
  },
  {
    id: "skillsViewer",
    icon: "mdi:puzzle",
    color: "#f59e0b",
    title: "Skills 查看器",
  },
]

const handleClick = (id: string) => {
  emit("select", id)
}
</script>
