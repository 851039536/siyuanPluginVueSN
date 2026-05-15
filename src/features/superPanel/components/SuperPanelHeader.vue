<template>
  <div class="super-panel-header">
    <div class="super-panel-title">
      <IconWrapper
        name="superPanel"
        :size="20"
      />
      <span>{{ title }}</span>
    </div>
    <div class="header-actions">
      <Button
        v-for="action in actions"
        :key="action.key"
        variant="ghost"
        size="small"
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
  i18n: {
    title?: string
    aiSettings?: string
    refresh?: string
    close?: string
  }
}

interface Emits {
  (e: "toggleAiSettings"): void
  (e: "refresh"): void
  (e: "close"): void
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
