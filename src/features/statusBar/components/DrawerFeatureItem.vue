<!-- 功能抽屉项组件：封装图标、标题、固定角标、分类角标、功能开关角标 -->
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
    <!-- 分类角标：仅非监控项显示，点击弹出分类分配菜单 -->
    <span
      v-if="!item.monitor"
      class="feature-drawer-item-badge badge-category"
      :class="{ active: !!item.categoryId }"
      :title="item.categoryId ? '更改分类' : '分配分类'"
      @click.stop="emit('assignCategory', item.id, $event)"
    >
      <Icon
        icon="ph:tag-simple"
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
}

const props = defineProps<Props>()

const emit = defineEmits<{
  select: [id: string]
  toggleStatusBar: [id: string]
  assignCategory: [id: string, event: MouseEvent]
  toggleEnabled: [id: string]
}>()

// 点击主体：已关闭功能不触发 select（仅开关角标可重新开启），避免调用未注册功能
const handleClick = () => {
  if (props.item.toggleable && !props.item.enabled) return
  emit("select", props.item.id)
}
</script>
