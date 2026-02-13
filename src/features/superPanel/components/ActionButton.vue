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
@use '../styles/index.scss';
</style>
