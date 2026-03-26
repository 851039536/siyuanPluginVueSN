<template>
  <Button
    variant="ghost"
    size="small"
    :icon="icon"
    :icon-size="size"
    :title="title"
    @click="handleClick"
  />
</template>

<script setup lang="ts">
import Button from '@/components/Button.vue'
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
