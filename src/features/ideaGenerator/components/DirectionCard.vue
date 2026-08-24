<!-- 发散方向卡片：序号 + 方向名 + 说明 + 箭头，点击选中继续深挖 -->
<template>
  <button
    type="button"
    class="gd-dir"
    @click="emit('select', direction)"
  >
    <!-- 方向序号 -->
    <span class="gd-dir-index">{{ String(index).padStart(2, "0") }}</span>
    <div class="gd-dir-content">
      <!-- 方向名 -->
      <span class="gd-dir-label">{{ direction.label }}</span>
      <!-- 方向说明 -->
      <span class="gd-dir-desc">{{ direction.description }}</span>
    </div>
    <IconWrapper
      name="chevronRight"
      :size="14"
      className="gd-dir-arrow"
    />
  </button>
</template>

<script setup lang="ts">
import IconWrapper from "@/components/IconWrapper.vue"
import type { GuideDirection } from "../types"

interface Props {
  direction: GuideDirection
  index: number
}

defineProps<Props>()
const emit = defineEmits<{ (e: "select", direction: GuideDirection): void }>()
</script>

<style lang="scss">
@use '../styles/DirectionCard.scss';
@use '../styles/index.scss';
</style>
