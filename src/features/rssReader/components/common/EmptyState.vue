<!--
  RSS 空状态占位 — 无订阅源/无文章时的图标 + 标题 + 描述 + 可选操作按钮
-->
<template>
  <div class="rss-empty-state">
    <Icon
      :icon="icon"
      class="empty-icon"
    />
    <div class="empty-title">
      {{ title }}
    </div>
    <div class="empty-desc">
      {{ desc }}
    </div>
    <button
      v-if="actionText"
      class="empty-action"
      @click="emit('action')"
    >
      {{ actionText }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"

interface Props {
  icon: string
  title: string
  desc: string
  actionText?: string
}

defineProps<Props>()

const emit = defineEmits<{
  action: []
}>()
</script>

<style lang="scss">
/* 仅引组件自身样式；全局基座由 index.vue 统一引入一次（避免重复输出） */
@use "../../styles/EmptyState.scss";
</style>
