<!-- 功能抽屉项组件：封装图标、标题、固定角标、隐藏角标，主列表与不常用列表复用 -->
<template>
  <div
    class="feature-drawer-item"
    @click="emit('select', item.id)"
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
      :class="{ active: mode === 'rarely' }"
      :title="mode === 'rarely' ? '恢复为常用' : '标记为不常用'"
      @click.stop="emit('toggleRarelyUsed', item.id)"
    >
      <Icon
        icon="ph:eye-slash"
        :width="12"
      />
    </span>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
import type { FeatureDrawerItem } from "./FeatureDrawer.vue"

interface Props {
  item: FeatureDrawerItem
  statusBarVisible: string[]
  mode?: "main" | "rarely"
}

withDefaults(defineProps<Props>(), {
  mode: "main",
})

const emit = defineEmits<{
  select: [id: string]
  toggleStatusBar: [id: string]
  toggleRarelyUsed: [id: string]
}>()
</script>
