<template>
  <Icon
    :icon="iconConfig.icon"
    :style="iconStyle"
    :class="className"
    :title="title"
    @error="handleIconError"
  />
</template>

<script setup lang="ts">
import type { IconKey } from "@/config/icons"
import { Icon } from "@iconify/vue"
import { computed } from "vue"
import { getIconConfig } from "@/config/icons"

interface Props {
  /** 图标键名 */
  name: IconKey
  /** 自定义大小 */
  size?: string | number
  /** 自定义颜色 */
  color?: string
  /** 自定义类名 */
  className?: string
  /** 鼠标悬停提示 */
  title?: string
}

const props = defineProps<Props>()

// 获取图标配置
const iconConfig = computed(() => getIconConfig(props.name))

// 处理图标加载错误
const handleIconError = (error: any) => {
  console.warn(`Failed to load icon: ${iconConfig.value.icon}`, error)
  // 可以在这里添加备用图标逻辑
}

// 计算图标样式
const iconStyle = computed(() => {
  const style: Record<string, string> = {}

  // 尺寸
  if (props.size) {
    const size =
      typeof props.size === "number" ? `${props.size}px` : props.size
    style.width = size
    style.height = size
  }

  // 颜色（优先使用 props，其次使用配置）
  const color = props.color || iconConfig.value.color
  if (color) {
    style.color = color
  }

  return style
})
</script>

<style scoped lang="scss">
@use './styles/IconWrapper.scss';
</style>
