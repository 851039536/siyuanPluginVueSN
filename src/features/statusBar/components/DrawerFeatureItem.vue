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
      <IconWrapper
        :name="item.icon"
        :size="25"
      />
    </div>
    <span class="feature-drawer-item-title">{{ item.title }}</span>
    <!--
      以下三个角标为固定 16×16 的紧凑图标按钮（AGENTS_STYLE.md「.icon-btn」例外），
      故不用共享 Button（其档位最小 20px 且带 padding/min-height，需反复覆写）。
      但必须保持真实 button 语义 + aria-pressed，保证键盘可达与状态可读。
    -->
    <button
      v-if="item.pinnable"
      type="button"
      class="feature-drawer-item-badge badge-pin"
      :class="{ active: pinned }"
      :title="pinned ? i18n.unpin : i18n.pinToStatusBar"
      :aria-label="pinned ? i18n.unpin : i18n.pinToStatusBar"
      :aria-pressed="pinned"
      @click.stop="emit('toggleStatusBar', item.id)"
    >
      <IconWrapper
        :name="pinned ? 'pinFilled' : 'pinOutline'"
        :size="12"
      />
    </button>
    <!-- 分类角标：仅非监控项显示，点击弹出分类分配菜单 -->
    <button
      v-if="!item.monitor"
      type="button"
      class="feature-drawer-item-badge badge-category"
      :class="{ active: !!item.categoryId }"
      :title="item.categoryId ? i18n.changeCategory : i18n.assignCategory"
      :aria-label="item.categoryId ? i18n.changeCategory : i18n.assignCategory"
      @click.stop="emit('assignCategory', item.id, $event)"
    >
      <IconWrapper
        name="tagOutline"
        :size="12"
      />
    </button>
    <!-- 功能开关角标：仅对有 enableXxx 开关的功能显示，点击切换启用/禁用 -->
    <button
      v-if="item.toggleable"
      type="button"
      class="feature-drawer-item-badge badge-toggle"
      :class="{ active: item.enabled }"
      :title="item.enabled ? i18n.disableFeature : i18n.enableFeature"
      :aria-label="item.enabled ? i18n.disableFeature : i18n.enableFeature"
      :aria-pressed="!!item.enabled"
      @click.stop="emit('toggleEnabled', item.id)"
    >
      <IconWrapper
        :name="item.enabled ? 'toggleOn' : 'toggleOff'"
        :size="14"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import type { FeatureDrawerItem } from "../types/index"
import IconWrapper from "@/components/IconWrapper.vue"

interface Props {
  item: FeatureDrawerItem
  statusBarVisible: string[]
  i18n: Record<string, string>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  select: [id: string]
  toggleStatusBar: [id: string]
  assignCategory: [id: string, event: MouseEvent]
  toggleEnabled: [id: string]
}>()

/** 是否已 pin 到状态栏（提取为计算属性：模板中三处使用，避免重复遍历数组） */
const pinned = computed(() => props.statusBarVisible.includes(props.item.id))

// 点击主体：已关闭功能不触发 select（仅开关角标可重新开启），避免调用未注册功能
const handleClick = () => {
  if (props.item.toggleable && !props.item.enabled) return
  emit("select", props.item.id)
}
</script>
