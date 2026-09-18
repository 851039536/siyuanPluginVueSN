<!-- 状态栏监控项组件：图标、数值、级别颜色的统一容器 -->
<template>
  <component
    :is="clickable ? 'button' : 'div'"
    class="monitor-item"
    :class="itemClass"
    :style="colorStyle"
    :data-level="level"
    :title="title"
    :type="clickable ? 'button' : undefined"
    :aria-label="clickable ? title : undefined"
    @click="$emit('click', $event)"
  >
    <!--
      两种图标来源：已注册的 IconKey（快捷项/监控项）走 IconWrapper；
      后台任务传入的原始 iconify 名（`useStatusBarTask` 为跨功能入口）走裸 Icon，
      避免被 getIconConfig 当作「未知键名」回退成 help-circle。
    -->
    <IconWrapper
      v-if="iconKey"
      :name="iconKey"
      :size="14"
      class="monitor-icon"
    />
    <Icon
      v-else-if="rawIcon"
      :icon="rawIcon"
      :width="14"
      class="monitor-icon"
    />
    <span
      v-if="$slots.default"
      class="monitor-value"
    >
      <slot />
    </span>
  </component>
</template>

<script setup lang="ts">
import type { IconKey } from "@/components/kit/icons"
import type { ResourceLevel } from "../types"
import { computed } from "vue"
import { Icon } from "@iconify/vue"
import IconWrapper from "@/components/IconWrapper.vue"

interface Props {
  /**
   * 图标名。既接受已注册的 `IconKey`（状态栏快捷项 / 监控项），
   * 也接受后台任务传入的任意 iconify 名（`useStatusBarTask` 为跨功能入口，不收窄为 IconKey）。
   * 判别：含 `:` 者为原始 iconify 名，否则视为已注册键名。
   */
  icon?: string
  title?: string
  level?: ResourceLevel
  itemClass?: string
  /** 功能品牌色（取自 FEATURE_ICONS 真源）；传了 `level` 时让位于告警色 */
  color?: string
}

const props = defineProps<Props>()

defineEmits<{
  click: [event: MouseEvent]
}>()

/** 已注册的图标键名（无冒号） */
const iconKey = computed<IconKey | undefined>(() =>
  props.icon && !props.icon.includes(":") ? props.icon as IconKey : undefined,
)

/** 原始 iconify 名（含冒号，如 `mdi:camera-marker`） */
const rawIcon = computed(() => (props.icon?.includes(":") ? props.icon : undefined))

/**
 * 配色内联样式。
 * ⚠️ 仅在**未传 level** 时生效：`data-level`（CPU/内存的 normal/medium/high 告警色）
 * 优先级必须高于功能品牌色，否则告警态会被内联色盖掉。
 */
const colorStyle = computed(() =>
  props.color && !props.level ? { color: props.color } : undefined,
)

/**
 * 是否可点击：快捷入口/后台任务项挂了 `@click` 监听（表现为 `.action-item`）。
 * 可点击时渲染为真实 `<button>` —— 原先的 `<div @click>` 无 role/tabindex，
 * 键盘用户完全无法触发这些入口。
 */
const clickable = computed(() => props.itemClass?.includes("action-item") ?? false)
</script>
