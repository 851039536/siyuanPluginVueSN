<!-- 设置项标签：图标 + 文案 + 可选数值徽标 -->
<template>
  <label class="setting-label">
    <span class="label-icon">
      <IconWrapper
        :name="icon"
        :size="14"
      />
    </span>
    {{ text }}
    <span
      v-if="value !== undefined"
      class="setting-value"
    >{{ value }}</span>
  </label>
</template>

<script setup lang="ts">
import type { IconKey } from "@/config/icons"
import IconWrapper from "@/components/IconWrapper.vue"

interface Props {
  icon: IconKey
  text: string
  /** 可选的右侧数值徽标（如百分比、像素值） */
  value?: string
}

defineProps<Props>()
</script>

<style scoped lang="scss">
@use "../styles/SettingLabel.scss";
</style>
