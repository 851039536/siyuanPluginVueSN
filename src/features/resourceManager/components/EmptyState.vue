<!-- 资源列表空/加载占位：居中图标 + 说明文案，加载态图标旋转 -->
<template>
  <div class="rm-empty">
    <!-- 占位图标（加载态传入 refresh 并 spin 旋转） -->
    <IconWrapper
      v-if="icon"
      :name="icon"
      :size="20"
      class="rm-empty__icon"
      :class="{ 'rm-empty__icon--spin': spin }"
    />
    <!-- 说明文案 -->
    <div class="rm-empty__text">{{ text }}</div>
  </div>
</template>

<script setup lang="ts">
import type { IconKey } from "@/config/icons"
import IconWrapper from "@/components/IconWrapper.vue"

interface Props {
  /** 占位图标键（已注册 Iconify 图标） */
  icon?: IconKey
  /** 说明文案 */
  text: string
  /** 加载态：图标持续旋转 */
  spin?: boolean
}

withDefaults(defineProps<Props>(), {
  icon: undefined,
  spin: false,
})
</script>

<style scoped lang="scss">
@use "../styles/EmptyState.scss";
</style>
