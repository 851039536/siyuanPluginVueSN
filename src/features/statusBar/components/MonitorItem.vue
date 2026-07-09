<!-- 状态栏监控项组件：图标、数值、级别颜色的统一容器 -->
<template>
  <div
    class="monitor-item"
    :class="itemClass"
    :data-level="level"
    :title="title"
    @click="$emit('click', $event)"
  >
    <Icon
      v-if="icon"
      :icon="icon"
      :width="14"
      class="monitor-icon"
    />
    <span
      v-if="$slots.default"
      class="monitor-value"
    >
      <slot />
    </span>
  </div>
</template>

<script setup lang="ts">
import type { ResourceLevel } from "../types"
import { Icon } from "@iconify/vue"

interface Props {
  icon?: string
  title?: string
  level?: ResourceLevel
  itemClass?: string
}

withDefaults(defineProps<Props>(), {
  icon: undefined,
  title: undefined,
  level: undefined,
  itemClass: undefined,
})

defineEmits<{
  click: [event: MouseEvent]
}>()
</script>
