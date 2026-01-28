<template>
  <button class="header-action-btn" :title="title" @click="handleClick">
    <IconWrapper :name="icon" :size="size" />
  </button>
</template>

<script setup lang="ts">
import IconWrapper from '@/components/IconWrapper.vue'
import type { IconKey } from '@/config/icons'

interface Props {
  icon: IconKey
  size?: number
  title?: string
  loading?: boolean
}

interface Emits {
  (e: 'click'): void
}

const props = withDefaults(defineProps<Props>(), {
  size: 16
})

const emit = defineEmits<Emits>()

const handleClick = () => {
  if (!props.loading) {
    emit('click')
  }
}
</script>

<style scoped lang="scss">
// 直接定义样式，不使用外部 mixin
.header-action-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  outline: none;
  transition: all 0.2s ease;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--b3-theme-on-surface);
  position: relative;

  &:hover {
    background: var(--b3-theme-surface-lighter);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}
</style>
