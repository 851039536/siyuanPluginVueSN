<!-- 功能抽屉项组件：封装图标、标题、固定角标、隐藏角标、功能开关角标，主列表与不常用列表复用 -->
<template>
  <div
    class="feature-drawer-item"
    :class="{ disabled: item.toggleable && !item.enabled }"
    @click="handleClick"
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
    <!-- 功能开关角标：仅对有 enableXxx 开关的功能显示，点击切换启用/禁用 -->
    <span
      v-if="item.toggleable"
      class="feature-drawer-item-badge badge-toggle"
      :class="{ active: item.enabled }"
      :title="item.enabled ? '禁用该功能' : '启用该功能'"
      @click.stop="emit('toggleEnabled', item.id)"
    >
      <Icon
        :icon="item.enabled ? 'ph:toggle-right' : 'ph:toggle-left'"
        :width="14"
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

const props = withDefaults(defineProps<Props>(), {
  mode: "main",
})

const emit = defineEmits<{
  select: [id: string]
  toggleStatusBar: [id: string]
  toggleRarelyUsed: [id: string]
  toggleEnabled: [id: string]
}>()

// 点击主体：已关闭功能不触发 select（仅开关角标可重新开启），避免调用未注册功能
const handleClick = () => {
  if (props.item.toggleable && !props.item.enabled) return
  emit("select", props.item.id)
}
</script>
