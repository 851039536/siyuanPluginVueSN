<template>
  <div class="super-panel-header">
    <div class="header-left">
      <div class="super-panel-title">
        <IconWrapper
          name="superPanel"
          :size="20"
        />
        <span>{{ title }}</span>
      </div>
      <div class="header-tabs">
        <button
          class="header-tab"
          :class="{ 'header-tab--active': activeTab === 'features' }"
          @click="emit('changeTab', 'features')"
        >
          {{ i18n.tabFeatures || '功能列表' }}
        </button>
        <button
          class="header-tab"
          :class="{ 'header-tab--active': activeTab === 'versions' }"
          @click="emit('changeTab', 'versions')"
        >
          {{ i18n.tabVersions || '版本汇总' }}
        </button>
      </div>
    </div>
    <div class="header-actions">
      <Button
        v-for="action in actions"
        :key="action.key"
        variant="ghost"
        size="xsmall"
        :icon="action.icon"
        :icon-size="16"
        :title="action.title"
        @click="action.handler"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { IconKey } from "@/config/icons"
import { computed } from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"

interface HeaderAction {
  key: string
  icon: IconKey
  title: string
  handler: () => void
}

interface Props {
  title?: string
  activeTab?: "features" | "versions"
  i18n: Record<string, any>
}

interface Emits {
  (e: "toggleAiSettings"): void
  (e: "refresh"): void
  (e: "close"): void
  (e: "changeTab", tab: "features" | "versions"): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const actions = computed<HeaderAction[]>(() => [
  {
    key: "aiSettings",
    icon: "settings",
    title: props.i18n.aiSettings || "AI配置",
    handler: () => emit("toggleAiSettings"),
  },
  {
    key: "refresh",
    icon: "refresh",
    title: props.i18n.refresh || "刷新",
    handler: () => emit("refresh"),
  },
  {
    key: "close",
    icon: "close",
    title: props.i18n.close || "关闭",
    handler: () => emit("close"),
  },
])
</script>
