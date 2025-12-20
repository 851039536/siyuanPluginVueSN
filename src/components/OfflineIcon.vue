<template>
  <svg
    v-if="iconData"
    :width="size"
    :height="size"
    :viewBox="iconData.body.viewBox"
    :class="className"
    :style="iconStyle"
    xmlns="http://www.w3.org/2000/svg"
    xmlns:xlink="http://www.w3.org/1999/xlink"
    role="img"
  >
    <title v-if="title">{{ title }}</title>
    <g v-html="iconData.body.body"></g>
  </svg>
  <Icon
    v-else
    :icon="iconConfig.icon"
    :style="iconStyle"
    :class="className"
    @error="handleIconError"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import { getIconConfig, type IconKey } from '@/config/icons'
import { loadIcon } from '@iconify/utils'

interface Props {
  /** 图标键名 */
  name: IconKey
  /** 自定义大小 */
  size?: string | number
  /** 自定义颜色 */
  color?: string
  /** 自定义类名 */
  className?: string
  /** 标题（用于无障碍） */
  title?: string
}

const props = defineProps<Props>()

// 获取图标配置
const iconConfig = computed(() => getIconConfig(props.name))

// 图标数据（离线）
const iconData = ref<any>(null)

// 计算图标样式
const iconStyle = computed(() => {
  const style: Record<string, string> = {}

  // 尺寸
  if (props.size) {
    const size = typeof props.size === 'number' ? `${props.size}px` : props.size
    style.width = size
    style.height = size
  }

  // 颜色
  const color = props.color || iconConfig.value.color
  if (color) {
    style.color = color
  }

  return style
})

// 加载离线图标
const loadOfflineIcon = async () => {
  try {
    const iconName = iconConfig.value.icon
    if (iconName) {
      const data = await loadIcon(iconName)
      if (data) {
        iconData.value = data
      }
    }
  } catch (error) {
    console.warn(`Failed to load offline icon: ${iconConfig.value.icon}`, error)
    iconData.value = null
  }
}

// 处理图标加载错误
const handleIconError = (error: any) => {
  console.warn(`Failed to load icon: ${iconConfig.value.icon}`, error)
}

// 组件挂载时加载离线图标
onMounted(() => {
  loadOfflineIcon()
})
</script>

<style scoped>
/* 图标默认样式 */
svg {
  display: inline-block;
  vertical-align: middle;
  width: 1em;
  height: 1em;
}
</style>
